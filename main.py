"""FastAPI application bootstrap for the MAHAK api.

Creates the app, mounts the versioned route prefix ``/api/v1``, and exposes no
secrets or credentials of any kind (NFR-006). R01 mounts exactly one router —
the shell contract router. R02 additionally mounts the auth router.
"""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .contracts import shell as contract
from .routes import shell as shell_route
from .routes import auth as auth_route


def create_app() -> FastAPI:
    """Build the FastAPI application with the versioned api prefix."""
    app = FastAPI(
        title="MAHAK API",
        version=__version__,
        description=(
            "Application/API boundary for the MAHAK platform. R01 exposes the "
            "shell contract; R02 adds authentication endpoints."
        ),
    )

    app.include_router(shell_route.router)
    app.include_router(auth_route.router)

    return app


app = create_app()

__all__ = ["app", "create_app", "contract"]
