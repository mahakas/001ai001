"""R02 user identity model.

Columns:
  - id: stable UUID primary key
  - email: nullable, unique when present (RFC 5322 validated at service layer)
  - phone: nullable, unique when present (E.164 validated at service layer)
  - password_hash: nullable (absent for Google-only accounts)
  - role: "user" or "admin" (check constraint); extensible for future roles
  - organization_reference: nullable invite token (validated at registration)
  - created_at / last_login_at

A user MUST have at least one sign-in key (email, phone, or SocialIdentityLink).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Role constraint: allows "user", "admin", and future extensions.
_ROLE_CHECK = CheckConstraint(
    "role IN ('user', 'admin')",
    name="ck_users_role",
)


class Base(DeclarativeBase):
    """SQLAlchemy base for all R02 models."""


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="user",
        server_default="user",
    )
    organization_reference: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
    last_login_at: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (_ROLE_CHECK,)
