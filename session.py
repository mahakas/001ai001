"""R02 session model.

Columns:
  - id: internal UUID primary key (distinct from browser-facing token)
  - token: opaque browser-facing session token, 256-bit random, stored hashed
  - user_id: FK to users.id
  - created_at / expires_at / revoked_at / ip_address

Session validity: valid when revoked_at IS NULL AND NOW() < expires_at.

PostgreSQL is authoritative for expiration and revocation. Every authenticated
request MUST query PostgreSQL directly; the SessionStore cache layer is never
sufficient to authorize a request on its own.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy base (shared with user.py / social_identity.py)."""


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    token: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ip_address: Mapped[str] = mapped_column(INET, nullable=False)

    @property
    def is_valid(self) -> bool:
        """True when the session has not been revoked and has not expired."""
        return self.revoked_at is None and datetime.now(timezone.utc) < self.expires_at

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        token: str,
        ip_address: str,
        lifetime_minutes: int = 10080,
    ) -> "Session":
        """Factory: create a new valid session record."""
        now = datetime.now(timezone.utc)
        return cls(
            id=uuid.uuid4(),
            token=token,
            user_id=user_id,
            created_at=now,
            expires_at=now + timedelta(minutes=lifetime_minutes),
            revoked_at=None,
            ip_address=ip_address,
        )
