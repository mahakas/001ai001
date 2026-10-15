"""API-side mirror of the shared shell contracts.

The canonical definitions live in ``packages/contracts`` (TypeScript); this
module mirrors the same values so the api response cannot drift from the
contract the web client is built against (plan.md, "Integration
Considerations"; research.md R-04). The mirror is intentionally value-only —
no business logic (FR-053, FR-054).
"""

from __future__ import annotations

from typing import Final, Literal

# --- ShellMode (contracts/shell-mode.md) -------------------------------------
# Exactly two values; no third ("loading" / "unknown") mode is permitted.
SHELL_MODE_PUBLIC: Final = "public"
SHELL_MODE_AUTHENTICATED: Final = "authenticated"
SHELL_MODE_VALUES: Final = (SHELL_MODE_PUBLIC, SHELL_MODE_AUTHENTICATED)

ShellMode = Literal["public", "authenticated"]

# R01 resolves ``public`` as the default; R02 later makes the resolution
# session-aware while preserving the two values and this schema.
DEFAULT_SHELL_MODE: Final = SHELL_MODE_PUBLIC

# --- Availability (contracts/navigation.md) ----------------------------------
Availability = Literal["reserved", "available"]
VISIBILITY_AUTHENTICATED: Final = "authenticated"

# --- Feature availability (contracts/api.md) ---------------------------------
# In R01 every destination module is ``reserved``; a later feature flips its
# own entry to ``available``.
R01_FEATURE_AVAILABILITY: Final = {
    "GENERAL_CHAT": "reserved",
    "CONVERSATIONS": "reserved",
    "PROJECTS": "reserved",
    "PRIVATE_TEACHER": "reserved",
    "FILES": "reserved",
    "SEARCH": "reserved",
    "SETTINGS": "reserved",
    "ADMIN_CONTROL_CENTER": "reserved",
}

# --- Locales (contracts/theme.md, data-model.md) -----------------------------
SUPPORTED_LOCALES: Final = ("fa", "ar", "en")
LOCALE_DIRECTION_MAP: Final = {"fa": "rtl", "ar": "rtl", "en": "ltr"}

# --- Contract version --------------------------------------------------------
API_VERSION: Final = "v1"
API_PREFIX: Final = "/api/v1"
