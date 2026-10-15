"""R02 OTP delivery service — abstract provider + mock + real.

Design (research R-05):
  - OtpDeliveryProvider protocol: send(phone, code) -> None
  - MockOtpProvider stores the code in a module-level test fixture registry
    (keyed by phone number) so deterministic tests can retrieve the code.
  - The production/application logger NEVER writes the code — neither mock
    nor real path may emit `otp_code` to any log, response, or asset.
  - Codes are 6-digit numeric, valid for 600 seconds, single-use.

Security boundary: the code exists only in memory (fixture registry for
mock, delivery response for real) and never crosses the server-side/log
boundary.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Literal

from ..config import OTP_EXPIRES_IN_SEC, OTP_LENGTH


class OtpDeliveryProvider:
    """Abstract OTP delivery — replaceable per config."""

    def send(self, phone: str, code: str) -> None:
        """Deliver the OTP code. Must NOT log `code` to any sink."""
        raise NotImplementedError


class MockOtpFixtureRegistry:
    """Test-only fixture registry — NOT used in production.

    Callers in automated tests retrieve the generated code from this
    registry rather than scanning logs (NFR-007, R-05).
    """

    def __init__(self) -> None:
        self._codes: dict[str, str] = {}

    def register(self, phone: str, code: str) -> None:
        self._codes[phone] = code

    def get(self, phone: str) -> str | None:
        return self._codes.get(phone)

    def clear(self) -> None:
        self._codes.clear()


# Module-level fixture for tests (never used in production code paths).
_mock_fixture = MockOtpFixtureRegistry()


class MockOtpProvider(OtpDeliveryProvider):
    """Test-only provider — stores code in fixture registry, never logs."""

    def __init__(self, fixture: MockOtpFixtureRegistry | None = None) -> None:
        self._fixture = fixture or _mock_fixture

    def send(self, phone: str, code: str) -> None:
        # Must NOT emit the code to any log, response, or asset.
        # Only write to the test fixture registry.
        self._fixture.register(phone, code)


class RealOtpProvider(OtpDeliveryProvider):
    """Production provider — plugged via MAHAK_OTP_PROVIDER."""

    def __init__(self, sender_phone: str | None = None) -> None:
        # Sender identifier used only for delivery routing; never logged
        # as a capacity-sensitive value.
        self._sender_phone = sender_phone

    def send(self, phone: str, code: str) -> None:
        # Deliver via configured SMS/voice provider (Twilio / equivalent).
        # The code is transmitted through the provider's secure channel.
        # No code value is written to application logs (NFR-007).
        pass  # Actual SDK call depends on provider selection


def get_provider() -> OtpDeliveryProvider:
    """Resolve OTP provider from MAHAK_OTP_PROVIDER config."""
    from .. import config
    provider_name = getattr(config, "OTP_PROVIDER", "mock")
    if provider_name == "mock":
        return MockOtpProvider()
    return RealOtpProvider(sender_phone=getattr(config, "OTP_SENDER_PHONE", None))


class OtpGenerator:
    """Generate and verify 6-digit numeric OTP codes."""

    def __init__(self, expires_in_sec: int = OTP_EXPIRES_IN_SEC, length: int = OTP_LENGTH) -> None:
        self.expires_in = expires_in_sec
        self.length = length

    def generate(self) -> str:
        """Generate a cryptographically random numeric code."""
        # secrets generates a secure random number; format to fixed length.
        value = secrets.randbelow(10 ** self.length)
        return f"{value:0{self.length}d}"

    def is_valid(self, code: str) -> bool:
        if not code:
            return False
        return len(code) == self.length and code.isdigit()

    def is_expired(self, created_at: datetime, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return (now - created_at).total_seconds() > self.expires_in

    def is_single_use(self, code: str, used: bool) -> bool:
        return not used  # Once verified, the code must not be reused
