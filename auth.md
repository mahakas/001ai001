# Contract: Authentication — Auth Routes

**Branch**: `002-identity-auth` | **Date**: 2026-09-26 | **Traces to**: FR-001–FR-015, FR-033–FR-048

## Purpose

Defines the authentication api routes that R02 adds alongside the stable R01 `GET /api/v1/shell` endpoint. All paths are versioned under `/api/v1/auth`. The response shapes are stable; later features extend with their own routes.

---

## Session cookie contract

All authenticated routes (except Google OAuth redirects) share this cookie convention:

- The browser receives **only** a server-side session reference in an HttpOnly cookie.
- The cookie name is `mahak_session`.
- The cookie value is an opaque session token (at least 128 bits of cryptographic randomness; 256-bit recommended), distinct from the internal database primary key. The server stores only a hash of this token (NFR-002).
- **HttpOnly** — the cookie is inaccessible to client-side JavaScript at all times (NFR-006).
- **Secure** — required in production; the cookie MUST NOT be transmitted over plain HTTP in production.
- **SameSite=Lax** — protects against CSRF; compatible with the R01 web/API boundary.
- The cookie is **never** included in any JSON response body, header, or client-side asset.
- No session token is exposed to browser application code; the `ShellModeProvider` derives session state exclusively from `GET /api/v1/shell`.
- The cookie is scoped to the api domain and is not shared across origins.

---

## Endpoints

### `POST /api/v1/auth/register/email`

**Purpose**: Register a new account via email/password with CAPTCHA.

**Request** — `application/json`:

```json
{
  "email": "user@example.com",
  "password": "string (>= 8 chars)",
  "captchaToken": "string",
  "invite": "string (optional)"
}
```

**Response** — `201 Created`, `application/json`:

```json
{
  "shellMode": "authenticated"
}
```

**Set-cookie**: `mahak_session=<session-id>; HttpOnly; Secure; SameSite=Lax; Path=/`

**Field rules**:
- `email` — valid email format, unique among existing accounts.
- `password` — minimum 8 characters; complexity rules deferred to operator config.
- `captchaToken` — required; validated server-side against the CAPTCHA provider.
- `invite` — optional opaque token; validated server-side at the identity boundary (non-empty string within VARCHAR(255) bounds). A valid token is stored as `organization_reference`; an invalid or missing token results in a null reference (FR-029).

**Error responses**:
- `400 Bad Request` — invalid input format (missing fields, malformed email).
- `409 Conflict` — email already exists (response body is a generic message; does NOT confirm or deny existence, FR-005).
- `429 Too Many Requests` — rate-limited (body includes `retryAfter` seconds, FR-019).
- `503 Service Unavailable` — CAPTCHA provider unreachable (FR-047).

---

### `POST /api/v1/auth/register/phone`

**Purpose**: Initiate phone/OTP registration by sending an OTP to the provided number.

**Request** — `application/json`:

```json
{
  "phone": "+1234567890",
  "captchaToken": "string"
}
```

**Response** — `202 Accepted`, `application/json`:

```json
{
  "otpExpiresIn": 600
}
```

**Field rules**:
- `phone` — E.164 format; unique among existing accounts.
- `captchaToken` — required (CAPTCHA is required on all email/password and phone registration submissions to prevent bot-driven account creation).
- `otpExpiresIn` — seconds until the OTP expires (default 600 = 10 minutes).

**Error responses**:
- `400 Bad Request` — invalid phone format.
- `409 Conflict` — phone already exists (generic message, no enumeration, FR-005).
- `429 Too Many Requests` — rate-limited (FR-019).
- `503 Service Unavailable` — OTP delivery provider unreachable.

---

### `POST /api/v1/auth/register/phone/verify`

**Purpose**: Complete phone/OTP registration by verifying the OTP code.

**Request** — `application/json`:

```json
{
  "phone": "+1234567890",
  "otpCode": "123456"
}
```

**Response** — `201 Created`, `application/json`:

```json
{
  "shellMode": "authenticated"
}
```

**Set-cookie**: `mahak_session=<session-id>; HttpOnly; Secure; SameSite=Lax; Path=/`

**Error responses**:
- `400 Bad Request` — malformed OTP code.
- `410 Gone` — OTP expired (FR-041).
- `422 Unprocessable Entity` — OTP invalid (FR-040).
- `429 Too Many Requests` — rate-limited.

---

### `POST /api/v1/auth/sign-in/email`

**Purpose**: Sign in with email/password.

**Request** — `application/json`:

```json
{
  "email": "user@example.com",
  "password": "string",
  "captchaToken": "string (required after adaptive threshold)"
}
```

**Response** — `200 OK`, `application/json`:

```json
{
  "shellMode": "authenticated"
}
```

**Set-cookie**: `mahak_session=<session-id>; HttpOnly; Secure; SameSite=Lax; Path=/`

**Error responses**:
- `401 Unauthorized` — generic sign-in failure (does not distinguish unknown email vs wrong password, FR-013, FR-038).
- `429 Too Many Requests` — rate-limited (FR-018).
- `400 Bad Request` — CAPTCHA required but not provided (FR-043).
- `503 Service Unavailable` — auth service unreachable.

---

### `POST /api/v1/auth/sign-in/phone`

**Purpose**: Initiate phone/OTP sign-in by sending an OTP.

**Request** — `application/json`:

```json
{
  "phone": "+1234567890"
}
```

**Response** — `202 Accepted`, `application/json`:

```json
{
  "otpExpiresIn": 600
}
```

**Error responses**:
- `400 Bad Request` — invalid phone format.
- `429 Too Many Requests` — rate-limited.

---

### `POST /api/v1/auth/sign-in/phone/verify`

**Purpose**: Complete phone/OTP sign-in by verifying the OTP code.

**Request** — `application/json`:

```json
{
  "phone": "+1234567890",
  "otpCode": "123456"
}
```

**Response** — `200 OK`, `application/json`:

```json
{
  "shellMode": "authenticated"
}
```

**Set-cookie**: `mahak_session=<session-id>; HttpOnly; Secure; SameSite=Lax; Path=/`

**Error responses**:
- `400 Bad Request` — malformed OTP code.
- `410 Gone` — OTP expired (FR-041).
- `422 Unprocessable Entity` — OTP invalid (FR-040).
- `429 Too Many Requests` — rate-limited.

---

### `POST /api/v1/auth/sign-in/google`

**Purpose**: Begin Google OAuth 2.0 flow with PKCE. Returns the authorization URL.

**Request** — `application/json`:

```json
{}
```

**Response** — `200 OK`, `application/json`:

```json
{
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Notes**:
- PKCE is generated server-side; the `code_verifier` is stored in the session and the `code_challenge` is sent in the authorization request.
- The user is redirected to `authorizationUrl`; upon completion, Google redirects back to the callback.
- The shell does not receive any provider tokens or secrets (NFR-003).

---

### `GET /api/v1/auth/google/callback`

**Purpose**: Complete the Google OAuth 2.0 flow. Exchanges the authorization code for tokens, verifies the Google identity, creates or matches an account, and establishes an authenticated server session.

**Request**: Query parameter `code` (authorization code from Google).

**Response** — `302 Found`, redirect to the application root (`/`).

**Notes**:
- The callback exchanges the code server-side; no provider credentials reach the browser.
- A server-side session is created and the `mahak_session` cookie is set (HttpOnly; Secure; SameSite=Lax).
- If the verified Google email matches an existing account, the Google identity is linked to that account (Q2, Option A).
- If no match exists, a new account is created.
- An interrupted flow (no `code` parameter, expired code) sets a failure flash message and redirects to the sign-in page with a generic failure message (FR-042, FR-048).
- The shell's `ShellModeProvider` reads the session from the cookie and calls `GET /api/v1/shell` to resolve `shellMode = "authenticated"` — no `shellMode` query parameter is used in production (R01 contract preserved, FR-033, FR-034).

---

### `POST /api/v1/auth/sign-out`

**Purpose**: Terminate the current session and transition the shell to public mode.

**Request**: Requires a valid `mahak_session` cookie.

**Response** — `200 OK`, `application/json`:

```json
{
  "shellMode": "public"
}
```

**Set-cookie**: `mahak_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

**Notes**:
- Only the current session is terminated (FR-010).
- `logout-all` is a separate endpoint (see below).

---

### `POST /api/v1/auth/sign-out-all`

**Purpose**: Terminate ALL active sessions for the current account (FR-014).

**Request**: Requires a valid `mahak_session` cookie.

**Response** — `200 OK`, `application/json`:

```json
{
  "shellMode": "public"
}
```

**Set-cookie**: `mahak_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

---

### `GET /api/v1/auth/captcha/challenge`

**Purpose**: Return a fresh CAPTCHA challenge HTML snippet. Called by the client before registration or adaptive sign-in challenges.

**Request**: Query parameter `locale` (`fa`, `ar`, or `en`).

**Response** — `200 OK`, `application/json`:

```json
{
  "html": "<div class=\"captcha-container\">...</div>"
}
```

**Notes**:
- The HTML is locale-aware (RTL for `fa`/`ar`, LTR for `en`).
- The challenge token is bound to the session and has a configurable lifetime (default 5 minutes).

---

## Safety rules

1. No endpoint returns credentials, secrets, tokens, provider keys, or password hashes (NFR-003, NFR-006).
2. No endpoint returns different messages for "user not found" vs "wrong password" (FR-013, FR-038).
3. Rate-limited responses do not indicate whether the target account exists (FR-021).
4. Provider errors are never exposed to the client (FR-047).
5. OTP codes are NEVER logged by the production logger at any point (NFR-007); test fixtures access OTP codes through a deterministic test-only hook (see research R-05).
6. The `GET /api/v1/shell` endpoint path and response shape remain unchanged (FR-033, FR-034).
7. The session cookie is never reflected in any JSON response body, header, or client-side asset (session cookie contract, above).

---

## Extension rules

1. New authentication methods (e.g. Apple sign-in) add new routes under `/api/v1/auth/...` without modifying existing routes.
2. Later features add their own versioned business routes under `/api/v1/...` separate from the auth routes.
3. The `shellMode` field in auth responses is for client convenience; the shell's mode is ultimately driven by the session state checked against `GET /api/v1/shell`.
