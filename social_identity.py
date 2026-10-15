"""R02 social identity linkage model.

Links a third-party identity (Google, future providers) to a User account.
Enables Q2 Option A: verified Google identity matching an existing account is
linked rather than creating a duplicate.

Unique constraint on (provider, provider_subject_id) ensures a given provider
subject links to exactly one account. Provider credentials are NEVER stored here.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .user import Base


class SocialIdentityLink(Base):
    __tablename__ = "social_identities"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    provider_subject_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("provider", "provider_subject_id", name="uq_social_provider_subject"),
    )
