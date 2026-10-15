"""R02 session store — abstract protocol and concrete implementations.

The SessionStore is a lookup/cache layer only. It is NEVER the authority for
session validity. Every authenticated request MUST query PostgreSQL directly
to verify revoked_at IS NULL AND NOW() < expires_at (research R-01,
data-model.md § Session Read/write consistency rules).

A cache hit in SessionStore is never sufficient to authorize a request.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime

from ..models.session import Session


class SessionStore(ABC):
    """Abstract session store interface.

    Methods:
      get_user_id(session_id: UUID) -> UUID | None
        Fast token-to-user lookup. Does NOT validate revocation/expiry.
      create(session: Session) -> None
        Writes to the store (best-effort; PostgreSQL is authoritative).
      update_expires(session_id: UUID, new_expiry: datetime) -> None
        Sliding-refresh expiry update (best-effort).
      revoke(session_id: UUID) -> None
        Best-effort removal from cache.
      revoke_all(user_id: UUID) -> None
        Best-effort removal of all entries for a user from cache.
    """

    @abstractmethod
    def get_user_id(self, session_id: uuid.UUID) -> uuid.UUID | None: ...

    @abstractmethod
    def create(self, session: Session) -> None: ...

    @abstractmethod
    def update_expires(self, session_id: uuid.UUID, new_expiry: datetime) -> None: ...

    @abstractmethod
    def revoke(self, session_id: uuid.UUID) -> None: ...

    @abstractmethod
    def revoke_all(self, user_id: uuid.UUID) -> None: ...


class InMemorySessionStore(SessionStore):
    """Dict-backed session store for development and tests."""

    def __init__(self) -> None:
        self._store: dict[uuid.UUID, uuid.UUID] = {}  # session_id -> user_id

    def get_user_id(self, session_id: uuid.UUID) -> uuid.UUID | None:
        return self._store.get(session_id)

    def create(self, session: Session) -> None:
        self._store[session.id] = session.user_id

    def update_expires(self, session_id: uuid.UUID, new_expiry: datetime) -> None:
        # The store only tracks session_id → user_id mapping.
        # Expiry is managed in PostgreSQL; this method is a no-op for the cache.
        pass

    def revoke(self, session_id: uuid.UUID) -> None:
        self._store.pop(session_id, None)

    def revoke_all(self, user_id: uuid.UUID) -> None:
        self._store = {
            sid: uid for sid, uid in self._store.items() if uid != user_id
        }


class RedisSessionStore(SessionStore):
    """Redis-backed session store (production).

    This is a skeletal implementation — production must connect to a real Redis
    instance configured via environment variables. The contract matches
    InMemorySessionStore exactly.
    """

    def __init__(self, host: str = "localhost", port: int = 6379) -> None:
        self._host = host
        self._port = port
        # Lazy connection — not attempted at import time.
        self._client: object | None = None

    def _ensure_client(self) -> object:
        if self._client is None:
            import redis  # lazy import; may fail if not installed
            self._client = redis.Redis(host=self._host, port=self._port, decode_responses=True)  # type: ignore[assignment]
        return self._client

    def get_user_id(self, session_id: uuid.UUID) -> uuid.UUID | None:
        client = self._ensure_client()
        val = client.get(f"mahak:sessions:{session_id}")
        return uuid.UUID(val) if val else None

    def create(self, session: Session) -> None:
        client = self._ensure_client()
        client.setex(
            f"mahak:sessions:{session.id}",
            int((session.expires_at - session.created_at).total_seconds()),
            str(session.user_id),
        )

    def update_expires(self, session_id: uuid.UUID, new_expiry: datetime) -> None:
        client = self._ensure_client()
        ttl = max(int((new_expiry - datetime.now(tz=timezone.utc)).total_seconds()), 0)
        client.expire(f"mahak:sessions:{session_id}", ttl)

    def revoke(self, session_id: uuid.UUID) -> None:
        client = self._ensure_client()
        client.delete(f"mahak:sessions:{session_id}")

    def revoke_all(self, user_id: uuid.UUID) -> None:
        # Scan-and-delete pattern; in production, consider a separate index.
        client = self._ensure_client()
        pattern = "mahak:sessions:*"
        for key in client.scan_iter(match=pattern):
            if client.get(key) == str(user_id):
                client.delete(key)
