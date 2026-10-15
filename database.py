"""
MAHAK API database engine factory and session helper.

Provides an async SQLAlchemy Engine selected from MAHAK_DATABASE_URL, an async
session generator (get_session), and a helper to run Alembic migrations.
The Alembic directory is ``apps/api/alembic/``.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from . import config

_engine = create_async_engine(
    config.DATABASE_URL,
    echo=False,
)

_session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

# ---------------------------------------------------------------------------
# Migration helpers
# ---------------------------------------------------------------------------

ALEMBIC_INI_PATH = str(Path(__file__).resolve().parent.parent.parent.parent / "alembic.ini")
ALEMBIC_VERSIONS_PATH = str(Path(__file__).resolve().parent.parent / "alembic" / "versions")


def upgrade_head() -> None:
    """Run Alembic ``upgrade head`` against the current DATABASE_URL."""
    alembic_cfg = Config(ALEMBIC_INI_PATH)
    alembic_cfg.set_main_option("script_location", ALEMBIC_VERSIONS_PATH)
    alembic_cfg.set_main_option("sqlalchemy.url", config.DATABASE_URL)
    command.upgrade(alembic_cfg, "head")


async def upgrade_head_async() -> None:
    """Run Alembic upgrade in an event loop context."""
    await asyncio.to_thread(upgrade_head)


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a scoped async SQLAlchemy session and close it when done."""
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def close_engine() -> None:
    """Dispose of the engine (call on application shutdown)."""
    await _engine.dispose()
