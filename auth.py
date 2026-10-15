"""R02 auth contract schemas — Pydantic v2 request/response models.

Mirrors contracts/auth.md endpoint shapes. Accepts both snake_case and
camelCase field names so the web client can send `captchaToken`, `otpCode`,
`shellMode` etc. (Pydantic v2 `populate_by_name` + field aliases).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class RegisterEmailRequest(BaseModel):
    email: str = Field(..., max_length=320, alias="email")
    password: str = Field(..., min_length=8, alias="password")
    captcha_token: str = Field(..., alias="captchaToken")
    invite: str | None = Field(default=None, max_length=255, alias="invite")

    model_config = {"populate_by_name": True}


class RegisterPhoneRequest(BaseModel):
    # Format is validated in the route handler so the api can return the
    # contract-defined 400 Bad Request instead of a framework 422.
    phone: str = Field(..., max_length=50, alias="phone")
    captcha_token: str = Field(..., alias="captchaToken")

    model_config = {"populate_by_name": True}


class VerifyPhoneRequest(BaseModel):
    # Format is validated in the route handler so the api can return the
    # contract-defined 400 Bad Request instead of a framework 422.
    phone: str = Field(..., max_length=50, alias="phone")
    otp_code: str = Field(..., max_length=16, alias="otpCode")

    model_config = {"populate_by_name": True}


class SignInEmailRequest(BaseModel):
    email: str = Field(..., alias="email")
    password: str = Field(..., alias="password")
    captcha_token: str | None = Field(default=None, alias="captchaToken")

    model_config = {"populate_by_name": True}


class SignInPhoneRequest(BaseModel):
    # Format is validated in the route handler.
    phone: str = Field(..., max_length=50, alias="phone")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AuthResponse(BaseModel):
    shell_mode: str = Field(..., alias="shellMode", pattern="^(public|authenticated)$")

    model_config = {"populate_by_name": True}


class OtpExpiresResponse(BaseModel):
    otp_expires_in: int = Field(..., ge=1, alias="otpExpiresIn")

    model_config = {"populate_by_name": True}


class CaptchaChallengeResponse(BaseModel):
    html: str

    model_config = {"populate_by_name": True}


class OAuthInitResponse(BaseModel):
    authorization_url: str = Field(..., alias="authorizationUrl")

    model_config = {"populate_by_name": True}


class RateLimitResponse(BaseModel):
    error: str = "rate_limit_exceeded"
    retry_after: int = Field(..., ge=1, alias="retryAfter", description="Seconds until the rate-limit window expires.")

    model_config = {"populate_by_name": True}
