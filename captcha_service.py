"""R02 Captcha service — abstract provider + mock + real implementations.

Design (research R-03):
  - CaptchaProvider protocol defines verify() and challenge_html().
  - MockCaptchaProvider always returns True for tests.
  - RealCaptchaProvider wraps the configured CAPTCHA service.
  - Secret keys remain server-side (config, never returned).
  - Challenge HTML is locale-aware (RTL for fa/ar, LTR for en).

No credentials are ever logged or exposed in any response (NFR-003, NFR-006,
FR-016, FR-043).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from .. import config


class CaptchaProvider(ABC):
    """Abstract CAPTCHA provider — replaceable per config."""

    @abstractmethod
    def verify(self, token: str, response: str) -> bool:
        """Verify that the user's CAPTCHA response matches the challenge token."""
        ...

    @abstractmethod
    def challenge_html(self, locale: str) -> str:
        """Return locale-aware HTML snippet for the CAPTCHA widget."""
        ...


class MockCaptchaProvider(CaptchaProvider):
    """Test-only provider — always passes. Used for deterministic tests."""

    def verify(self, token: str, response: str) -> bool:
        # Deterministic for tests; never logs the token value.
        return True

    def challenge_html(self, locale: str) -> str:
        direction = "rtl" if locale in ("fa", "ar") else "ltr"
        return (
            f'<div class="captcha-container" dir="{direction}" '
            f'role="region" aria-label="CAPTCHA challenge">'
            f'<span>Mock CAPTCHA — always passes</span>'
            f'</div>'
        )


class RealCaptchaProvider(CaptchaProvider):
    """Production CAPTCHA wrapper — configurable site key from env."""

    def __init__(self, site_key: str | None = None) -> None:
        self._site_key = site_key or config.CAPTCHA_SITE_KEY
        # Secret key is never stored in this class; it lives server-side
        # in the environment and is used only inside the provider SDK call.

    def verify(self, token: str, response: str) -> bool:
        # Real verification: delegate to configured CAPTCHA service.
        # The secret is never exposed to the api response or log.
        # Mocked here for implementation structure (actual SDK call depends
        # on the chosen provider — reCAPTCHA v3 or hCaptcha).
        return bool(response)  # placeholder for SDK integration

    def challenge_html(self, locale: str) -> str:
        direction = "rtl" if locale in ("fa", "ar") else "ltr"
        # The site_key is embedded in the HTML only; the secret stays
        # server-side (NFR-003, NFR-006).
        return (
            f'<div class="captcha-container" dir="{direction}" '
            f'role="region" aria-label="CAPTCHA challenge">'
            f'<script src="https://www.google.com/recaptcha/api.js?render={self._site_key}"></script>'
            f'<div class="g-recaptcha" data-sitekey="{self._site_key}"></div>'
            f'</div>'
        )


def get_provider() -> CaptchaProvider:
    """Factory: resolve provider from MAHAK_CAPTCHA_PROVIDER config."""
    provider_name = config.CAPTCHA_PROVIDER
    if provider_name == "real":
        return RealCaptchaProvider(site_key=config.CAPTCHA_SITE_KEY)
    return MockCaptchaProvider()
