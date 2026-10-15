"""
MAHAK API configuration — reads all runtime settings from environment variables.

No secrets are printed or returned in api responses (NFR-003, NFR-006).
All values documented in research R-06 and data-model.md.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_URL: str = os.getenv(
    "MAHAK_DATABASE_URL",
    "sqlite+aiosqlite:///./mahak_dev.db",
)

# ---------------------------------------------------------------------------
# Session store backend
# ---------------------------------------------------------------------------
SESSION_STORE: Literal["memory", "redis"] = os.getenv(
    "MAHAK_SESSION_STORE",
    "memory",
)

# ---------------------------------------------------------------------------
# CAPTCHA provider
# ---------------------------------------------------------------------------
CAPTCHA_PROVIDER: Literal["mock", "real"] = os.getenv(
    "MAHAK_CAPTCHA_PROVIDER",
    "mock",
)
CAPTCHA_SITE_KEY: str = os.getenv("MAHAK_CAPTCHA_SITE_KEY", "")

# ---------------------------------------------------------------------------
# OTP delivery provider
# ---------------------------------------------------------------------------
OTP_PROVIDER: Literal["mock", "twilio", "other"] = os.getenv(
    "MAHAK_OTP_PROVIDER",
    "mock",
)
OTP_SENDER_PHONE: str | None = os.getenv("MAHAK_OTP_SENDER_PHONE", None)

# ---------------------------------------------------------------------------
# Google OAuth 2.0
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_ID: str = os.getenv("MAHAK_GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.getenv("MAHAK_GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI: str = os.getenv(
    "MAHAK_GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/google/callback",
)

# ---------------------------------------------------------------------------
# Session lifetime
# ---------------------------------------------------------------------------
SESSION_LIFETIME_MIN: int = int(os.getenv("MAHAK_SESSION_LIFETIME_MIN", "10080"))

# ---------------------------------------------------------------------------
# Rate-limit thresholds
# ---------------------------------------------------------------------------
SIGNIN_RATE_LIMIT_WINDOW_MIN: int = int(
    os.getenv("MAHAK_SIGNIN_RATE_LIMIT_WINDOW_MIN", "15")
)
SIGNIN_RATE_LIMIT_MAX_ATTEMPTS: int = int(
    os.getenv("MAHAK_SIGNIN_RATE_LIMIT_MAX_ATTEMPTS", "5")
)
REGISTER_RATE_LIMIT_WINDOW_MIN: int = int(
    os.getenv("MAHAK_REGISTER_RATE_LIMIT_WINDOW_MIN", "15")
)
REGISTER_RATE_LIMIT_MAX_ATTEMPTS: int = int(
    os.getenv("MAHAK_REGISTER_RATE_LIMIT_MAX_ATTEMPTS", "3")
)

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
BCRYPT_COST: int = int(os.getenv("MAHAK_BCRYPT_COST", "12"))

# ---------------------------------------------------------------------------
# OTP settings
# ---------------------------------------------------------------------------
OTP_EXPIRES_IN_SEC: int = int(os.getenv("MAHAK_OTP_EXPIRES_IN_SEC", "600"))
OTP_LENGTH: int = int(os.getenv("MAHAK_OTP_LENGTH", "6"))


def get_session_lifetime() -> int:
    """Return the session lifetime in minutes.

    Default is 7 days (10080 minutes). Configurable via MAHAK_SESSION_LIFETIME_MIN.
    """
    return SESSION_LIFETIME_MIN
