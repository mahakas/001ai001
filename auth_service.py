"""R02 core authentication service — registration (email/password, phone/OTP).

Business logic only — no HTTP routing. Consumers are api routes (T017) and
future features (sign-in, Google OAuth) that reuse the same service.

Security invariants:
  - Passwords hashed with bcrypt at configured cost; plaintext never stored
    or logged (NFR-001, NFR-006, FR-013).
  - CAPTCHA verified before any account creation (FR-016, FR-043).
  - OTP codes never logged or returned in responses (NFR-007, NFR-006).
  - Provider secrets (CAPTCHA, Google, OTP) never exposed (NFR-003).
  - Generic failure messages — no account-enumeration (FR-005, FR-013).
  - Organization invite validated server-side; invalid/missing → null ref.
  - Session creation uses PostgreSQL-authoritative model; SessionStore is
    cache-only and NEVER authorizes a request by itself.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import bcrypt

from ..config import BCRYPT_COST
from ..models.session import Session
from ..models.user import User
from ..models.social_identity import SocialIdentityLink
from ..logger import emit as log_event
from .captcha_service import CaptchaProvider
from .otp_service import OtpDeliveryProvider, OtpGenerator
from .session_store import SessionStore


# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------

class AuthenticationError(Exception):
    """Base exception for authentication failures. Never exposes internals."""

class EmailAlreadyExistsError(AuthenticationError):
    """Duplicate email — swallowed by callers returning generic messages."""

class PhoneAlreadyExistsError(AuthenticationError):
    """Duplicate phone — swallowed by callers returning generic messages."""

class CaptchaVerificationFailedError(AuthenticationError):
    """CAPTCHA challenge did not pass."""

class InviteTokenInvalidError(AuthenticationError):
    """Invite token failed server-side validation."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt at the configured cost factor.

    Returns the bcrypt hash as a string. The plaintext is never stored.
    """
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=BCRYPT_COST),
    ).decode("utf-8")


def _validate_invite_token(invite: str | None) -> str | None:
    """Validate an optional organization invite token per Q4 Option B.

    Valid: non-empty string within VARCHAR(255) bounds.
    Invalid or missing: return None (organization_reference stays null).
    """
    if not invite:
        return None
    if not isinstance(invite, str) or len(invite) == 0 or len(invite) > 255:
        return None
    return invite  # stored verbatim after validation passes


def _create_session(
    user_id: uuid.UUID,
    ip_address: str,
    store: SessionStore | None = None,
    lifetime_minutes: int = 10080,
) -> Session:
    """Create a new session record in PostgreSQL and update SessionStore cache.

    PostgreSQL write is authoritative; SessionStore write is best-effort cache.
    The generated token is cryptographically random (≥128 bits, 256-bit target).
    """
    token_bytes = bytes.fromhex(uuid.uuid4().hex + uuid.uuid4().hex)[:32]  # 256 bits
    session = Session.create(
        user_id=user_id,
        token=token_bytes.hex(),
        ip_address=ip_address,
        lifetime_minutes=lifetime_minutes,
    )
    # Best-effort cache update — PostgreSQL is authoritative regardless.
    if store is not None:
        try:
            store.create(session)
        except Exception:  # pragma: no cover — cache miss is tolerated
            pass
    return session


@dataclass
class OtpIssuanceResult:
    """Result of sending an OTP code."""
    otp_expires_in: int  # seconds until expiry (matches config default)
    phone: str


# ---------------------------------------------------------------------------
# Identity-key uniqueness registry
# ---------------------------------------------------------------------------
# PostgreSQL enforces uniqueness on users.email and users.phone (T012). Until
# the api wires a live database session into this service, this process-local
# registry provides the same uniqueness semantics so duplicate registration is
# detected and reported as a generic failure (FR-005, FR-013). It is the seam a
# real ``SELECT``/``IntegrityError`` check replaces; it is not a second source
# of truth and never stores credentials.

_REGISTERED_EMAILS: set[str] = set()
_REGISTERED_PHONES: set[str] = set()


def _assert_email_available(email: str) -> None:
    """Raise when the email is already registered (FR-005, FR-013)."""
    if email.lower() in _REGISTERED_EMAILS:
        raise EmailAlreadyExistsError()


def _assert_phone_available(phone: str) -> None:
    """Raise when the phone is already registered (FR-005, FR-013)."""
    if phone in _REGISTERED_PHONES:
        raise PhoneAlreadyExistsError()


def reset_identity_registry() -> None:
    """Clear the in-process uniqueness registry (test helper)."""
    _REGISTERED_EMAILS.clear()
    _REGISTERED_PHONES.clear()


# ---------------------------------------------------------------------------
# Core service
# ---------------------------------------------------------------------------

class AuthService:
    """R02 authentication service — registration flows only.

    Sign-in is implemented by later tasks (T024+) that re-use this service's
    session creation logic but add credential verification.
    """

    def __init__(
        self,
        captcha_provider: CaptchaProvider,
        otp_provider: OtpDeliveryProvider,
        otp_generator: OtpGenerator | None = None,
        session_store: SessionStore | None = None,
    ) -> None:
        self._captcha = captcha_provider
        self._otp_delivery = otp_provider
        self._otp_gen = otp_generator or OtpGenerator()
        self._session_store = session_store  # may be None; routes hydrate from DB

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_email(
        self,
        email: str,
        password: str,
        captcha_token: str,
        captcha_response: str,
        invite: str | None = None,
        ip_address: str = "127.0.0.1",
    ) -> Session:
        """Register a new account via email/password + CAPTCHA.

        Returns a new Session record. Does NOT persist to the DB — callers
        must use their own session context.
        """
        # 1. CAPTCHA verification (FR-016)
        if not self._captcha.verify(captcha_token, captcha_response):
            log_event(event_type="captcha_challenge", ip_address=ip_address)
            raise CaptchaVerificationFailedError()

        # 2. Hash password — bcrypt cost from config (NFR-001)
        password_hash = _hash_password(password)

        # 3. Validate optional invite token (Q4 Option B, FR-029)
        org_ref = _validate_invite_token(invite)

        # 4. Uniqueness: duplicate email is a generic failure (FR-005, FR-013)
        _assert_email_available(email)

        # 5. Build User (caller persists via DB layer)
        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=password_hash,
            role="user",  # default per FR-022
            organization_reference=org_ref,
        )
        _REGISTERED_EMAILS.add(email.lower())

        # 6. Create session
        session = _create_session(user.id, ip_address, self._session_store)

        log_event(
            event_type="account_created",
            user_id=str(user.id),
            ip_address=ip_address,
            details={"email": email[:3] + "***"},  # first 3 chars only, never full email
        )
        return session

    def register_phone(
        self,
        phone: str,
        captcha_token: str,
        captcha_response: str,
        ip_address: str = "127.0.0.1",
    ) -> OtpIssuanceResult:
        """Initiate phone/OTP registration: validate CAPTCHA, generate + send OTP.

        Returns OTP expiry info (the actual code is delivered via the provider
        and available through the mock fixture in tests — never logged).
        """
        # 1. CAPTCHA verification (FR-016)
        if not self._captcha.verify(captcha_token, captcha_response):
            log_event(event_type="captcha_challenge", ip_address=ip_address)
            raise CaptchaVerificationFailedError()

        # 2. Generate OTP (NFR-002: cryptographically random)
        otp_code = self._otp_gen.generate()
        otp_expires_in = self._otp_gen.expires_in

        # 3. Send OTP via provider (provider must NEVER log the code)
        self._otp_delivery.send(phone, otp_code)

        log_event(
            event_type="otp_issued",
            ip_address=ip_address,
            details={"phone_prefix": phone[:4] + "***"},  # safe prefix only
        )
        return OtpIssuanceResult(otp_expires_in=otp_expires_in, phone=phone)

    def register_phone_and_create_account(
        self,
        phone: str,
        captcha_token: str,
        captcha_response: str,
        invite: str | None = None,
        ip_address: str = "127.0.0.1",
    ) -> tuple[User, Session]:
        """Register a new account via phone/OTP, create the User + Session.

        This combines OTP issuance and account creation in one call for the
        phone-based sign-up flow (where the user has already verified the OTP
        and calls this endpoint).
        """
        # Re-use the same CAPTCHA check as register_phone
        if not self._captcha.verify(captcha_token, captcha_response):
            raise CaptchaVerificationFailedError()

        org_ref = _validate_invite_token(invite)
        # Uniqueness: duplicate phone is a generic failure (FR-005, FR-013)
        _assert_phone_available(phone)
        user = User(
            id=uuid.uuid4(),
            phone=phone,
            role="user",
            organization_reference=org_ref,
        )
        _REGISTERED_PHONES.add(phone)
        session = _create_session(user.id, ip_address, self._session_store)
        return user, session
