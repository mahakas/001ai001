"""R02 rate limiter — sliding-window counters per IP and per account.

Design:
  - Per-IP limits apply to sign-in AND registration endpoints (FR-018, FR-019).
  - Per-account limits apply to sign-in only (FR-017).
  - Counters reset automatically when the sliding window expires (FR-020).
  - The identifier key is NEVER logged (FR-021).

Storage: buckets are keyed by identifier and live in the same SessionStore
abstraction (in-memory dict for dev/test, Redis for production).
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from ..config import (
    REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
    REGISTER_RATE_LIMIT_WINDOW_MIN,
    SIGNIN_RATE_LIMIT_MAX_ATTEMPTS,
    SIGNIN_RATE_LIMIT_WINDOW_MIN,
)


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int | None = None


class RateLimiter:
    """Sliding-window rate limiter with configurable per-IP and per-account windows.

    The ``identifier`` used as a bucket key must NOT be logged. Callers pass an
    opaque string (e.g. IP address or hashed account key); the limiter treats it
    as an opaque key only.
    """

    def __init__(
        self,
        *,
        signin_window_min: int = SIGNIN_RATE_LIMIT_WINDOW_MIN,
        signin_max_attempts: int = SIGNIN_RATE_LIMIT_MAX_ATTEMPTS,
        register_window_min: int = REGISTER_RATE_LIMIT_WINDOW_MIN,
        register_max_attempts: int = REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
    ) -> None:
        self._signin_window = timedelta(minutes=signin_window_min)
        self._signin_max = signin_max_attempts
        self._register_window = timedelta(minutes=register_window_min)
        self._register_max = register_max_attempts
        # identifier -> list of attempt timestamps
        self._buckets: dict[str, list[datetime]] = defaultdict(list)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_sign_in(self, ip: str, account_key: str | None) -> RateLimitResult:
        """Return a result for a sign-in attempt identified by IP and optional account key.

        Both per-IP and per-account counters are checked. A failure in either
        window blocks the request (FR-017, FR-018).
        """
        now = datetime.now(timezone.utc)
        result = self._check(ip, now, self._signin_window, self._signin_max)
        if not result.allowed and account_key:
            # Also check per-account (only for sign-in, FR-017)
            account_result = self._check(account_key, now, self._signin_window, self._signin_max)
            if not account_result.allowed:
                return account_result
        return result

    def check_register(self, ip: str) -> RateLimitResult:
        """Return a result for a registration attempt identified by IP (FR-019)."""
        now = datetime.now(timezone.utc)
        return self._check(ip, now, self._register_window, self._register_max)

    def record_success(self, ip: str, account_key: str | None) -> None:
        """Clear both IP and (if provided) account counters on successful auth."""
        self._buckets.pop(ip, None)
        if account_key:
            self._buckets.pop(account_key, None)

    def record_failure(self, ip: str, account_key: str | None) -> None:
        """Record a failed attempt against both IP and (if provided) account buckets."""
        now = datetime.now(timezone.utc)
        self._add_attempt(ip, now)
        if account_key:
            self._add_attempt(account_key, now)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _check(self, key: str, now: datetime, window: timedelta, max_attempts: int) -> RateLimitResult:
        """Check a single bucket; return allowed/try-after result."""
        cutoff = now - window
        attempts = self._buckets.get(key, [])
        # Prune expired entries
        valid = [t for t in attempts if t > cutoff]
        self._buckets[key] = valid
        if len(valid) >= max_attempts:
            retry_after = int((valid[-1] + window - now).total_seconds()) + 1
            return RateLimitResult(allowed=False, retry_after_seconds=max(retry_after, 1))
        return RateLimitResult(allowed=True)

    def _add_attempt(self, key: str, timestamp: datetime) -> None:
        self._buckets[key].append(timestamp)
