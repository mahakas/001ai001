"""
MAHAK security event logger — structured JSON output.

Emits one record per security-relevant event with fields:
  - event_id        (UUID)
  - user_id         (UUID | None)
  - event_type      (str)
  - ip_address      (str)
  - user_agent      (str, truncated to 512 chars)
  - timestamp       (ISO 8601 UTC)
  - details         (dict, optional)

Sensitive fields are **never** included: ``password``, ``password_hash``,
``token``, ``otp_code``, ``session_id``, ``provider_secret``,
``organization_reference``. The caller passes ``event_type`` and optional
``user_id`` / ``details``; the logger rejects any value whose key matches a
prohibited set before emitting the record (NFR-007).
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("mahak.security")


# Fields that must never appear in any log record.
_PROHIBITED_KEYS: frozenset[str] = frozenset({
    "password",
    "password_hash",
    "token",
    "otp_code",
    "session_id",
    "provider_secret",
    "organization_reference",
})

_USER_AGENT_MAX_LEN = 512


def _clean_details(details: dict[str, Any] | None) -> dict[str, Any] | None:
    """Strip prohibited keys from the details dict before logging."""
    if not details:
        return None
    cleaned = {k: v for k, v in details.items() if k not in _PROHIBITED_KEYS}
    return cleaned or None


def emit(
    *,
    event_type: str,
    user_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict[str, Any] | None = None,
) -> str:
    """Emit a structured JSON security event and return the event_id.

    Never includes sensitive fields; silently drops them from ``details``.
    """
    event_id = secrets.token_hex(16)  # 32 hex chars = 128-bit ID
    record = {
        "event_id": event_id,
        "user_id": user_id,
        "event_type": event_type,
        "ip_address": ip_address,
        "user_agent": (user_agent or "")[:_USER_AGENT_MAX_LEN],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": _clean_details(details),
    }
    # Remove None details so the JSON is compact.
    if record["details"] is None:
        del record["details"]

    try:
        logger.info(json.dumps(record, default=str))
    except Exception:  # pragma: no cover — fire-and-forget
        pass

    return event_id
