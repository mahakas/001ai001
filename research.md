# Research: R02 — Identity, Authentication & Authorization

**Branch**: `002-identity-auth` | **Date**: 2026-09-26

---

## R-01: Session persistence strategy

**Decision**: PostgreSQL is the **authoritative source of truth** for session metadata (userId, createdAt, expiresAt, revokedAt). An in-memory dict (dev/test) or Redis (production) `SessionStore` interface provides active token lookup and cache. The two are kept consistent by the following read/write rules:

| Operation | Store writes | Store reads | Consistency rule |
|-----------|-------------|-------------|------------------|
| Session creation | PostgreSQL (INSERT) + SessionStore (SET) | SessionStore | If PostgreSQL succeeds, SessionStore is updated; if SessionStore write fails, the session is still valid (PostgreSQL is authoritative). |
| Session read (every authenticated request) | PostgreSQL (SELECT by session id to verify revoked_at IS NULL AND expires_at > NOW()) | PostgreSQL; SessionStore used only for fast token→user_id lookup | **A cache hit MUST NOT be sufficient to authorize a request.** Every authenticated request MUST query PostgreSQL to verify the session is not revoked and not expired. SessionStore is consulted only for the fast token-to-user lookup; the authorization decision is always made from PostgreSQL state. If SessionStore has a stale entry (revoked session still in cache), PostgreSQL will find revoked_at set and reject the session. |
| Logout (single session) | PostgreSQL (UPDATE revoked_at) + SessionStore (DELETE) | SessionStore | Both writes MUST succeed; if SessionStore delete fails, the next request refreshes from PostgreSQL which will find revoked_at set. |
| Logout-all | PostgreSQL (UPDATE ALL revoked_at WHERE user_id = ?) + SessionStore (DEL all keys for user) | SessionStore | PostgreSQL is authoritative; even if SessionStore cleanup is missed, the next request sees revoked_at set. |
| Sliding refresh | PostgreSQL (UPDATE expires_at) + SessionStore (SET with new expiry) | SessionStore | Same as creation rule — PostgreSQL wins on divergence. |

**Rationale**: Stateful sessions allow explicit revocation (FR-012), support logout-all (FR-014), and avoid the complexity of JWT signature management across a monorepo. **Every authenticated request queries PostgreSQL directly to verify session validity (revoked_at IS NULL AND expires_at > NOW()); the SessionStore is used only as a fast token-to-user lookup cache and a cache hit is never sufficient to authorize a request.** This guarantees that revoked or expired sessions cannot be accepted through stale cache data. Logout-all updates PostgreSQL directly. The `ShellModeProvider` on the web client consumes the mode from `GET /api/v1/shell` without any auth-token awareness (preserving FR-046, FR-055).

**Session cookie contract**: The browser receives only an opaque session token (≥128 bits, 256-bit recommended) in an `HttpOnly; Secure; SameSite=Lax` cookie named `mahak_session`. The server stores a hash of this token; the plaintext is never returned in any API response, log, or client-side asset (NFR-002, NFR-003, NFR-006).

**Alternatives considered**:
- JWT with server-side revocation list — rejected because it adds complexity (key rotation, clock skew handling) without benefit for a single-server deployment.
- PostgreSQL-only (no cache) — rejected because every request would hit the database; the cache is needed for performance at scale.
- Redis-only (no PostgreSQL) — rejected because we need durable revocation/expiration state that survives restarts; PostgreSQL provides this natively.
- Server-side session with URL-path token — rejected because it leaks tokens in URLs and breaks the existing shell seam.

---

## R-02: Password hashing algorithm

**Decision**: bcrypt with a configurable cost factor (default cost 12, adjustable via environment variable). Argon2id is noted as an alternative but bcrypt is selected for wider ecosystem support in Python 3.12 and deterministic test behaviour.

**Rationale**: NFR-001 requires an adaptive one-way hash. bcrypt is the project's existing standard choice; argon2 would require an additional C extension. Both satisfy the constitutional requirement for credential protection (Principle IV).

**Alternatives considered**: argon2id — better resistance to GPU attacks but adds a compile-time dependency. Scrypt — acceptable but less widely supported in Python without an extra package.

---

## R-03: CAPTCHA provider abstraction

**Decision**: Define an abstract `CaptchaProvider` interface in `apps/api` with two methods: `verify(token: str, response: str) -> bool` and `challenge_html(locale: str) -> str`. Default implementation wraps reCAPTCHA v3 or hCaptcha via a configurable site key. The specific provider is resolved from the `MAHAK_CAPTCHA_PROVIDER` environment variable.

**Rationale**: FR-016 and FR-017 require CAPTCHA at registration and adaptive challenge on sign-in. An abstract interface keeps the provider swappable and testable (NFR-005). A mock provider is supplied for deterministic tests.

**Alternatives considered**: Hard-coding reCAPTCHA — rejected because it violates the constitution's provider-agnostic principle (Principle III) and makes tests non-deterministic. No CAPTCHA — rejected because FR-016 is mandatory.

---

## R-04: Google OAuth 2.0 flow design

**Decision**: Use the standard OAuth 2.0 authorization-code flow with PKCE. The web client redirects to the Google authorization endpoint via the api's `/api/v1/auth/sign-in/google` route. The callback (`/api/v1/auth/google/callback`) exchanges the code for tokens server-side, verifies the Google user info, creates or matches an account, establishes a server-side session (sets the `mahak_session` cookie), and then **redirects to the application root (`/`)**. The `ShellModeProvider` on the web client then calls `GET /api/v1/shell` to resolve the authenticated mode from the active session. The R01 `GET /api/v1/shell` contract remains unchanged — no `shellMode` query parameter is used in production.

A `?shellMode=authenticated|public` override continues to exist as an **explicitly test-only harness mechanism** preserved from R01 for deterministic testing (not used in production flows).

**Rationale**: PKCE is required for public clients per OAuth 2.1 best practice. Keeping the token exchange server-side ensures credentials never reach the browser (NFR-003). Redirecting to the application root (not a URL with `shellMode` query parameter) ensures the production shell mode is authoritative via the session — matching the R01 shell contract exactly. The identity-linking abstraction uses a `SocialIdentityLink` table keyed by provider + provider_subject_id, decoupling Google-specific logic from the User model.

**Alternatives considered**: Direct client-side Google Sign-In — rejected because it exposes the Client Secret to the browser. Implicit flow — rejected as deprecated and insecure. Redirecting with `?shellMode=authenticated` — rejected because it makes the shell mode authoritative through a query parameter rather than the session, violating the R01 contract stability principle.

---

## R-05: OTP delivery abstraction

**Decision**: Define an abstract `OtpDeliveryProvider` interface with `send(phone: str, code: str) -> None`. Default implementation is a no-op logger in dev; a real SMS/voice provider (Twilio, etc.) is plugged in via `MAHAK_OTP_PROVIDER=twilio` (or equivalent). OTP codes are 6-digit numeric, valid for 10 minutes, single-use.

**OTP testing safety**: OTP codes are **never logged** by the production logger under any circumstance (this includes the mock provider's dev behaviour). For deterministic testing, the mock OTP provider exposes the generated code through a **test fixture / test hook** — a module-level registry accessible only when `MAHAK_OTP_PROVIDER=mock` and the test framework has initialised the fixture. Production code never accesses this fixture. The fixture is scoped to the test process and is cleared after each test.

**Rationale**: FR-003 requires phone/OTP registration. Abstracting the delivery channel keeps tests deterministic (NFR-005) and allows swapping providers without changing the auth flow. Never logging OTP codes is required by NFR-007 (no sensitive data in security events) and NFR-001 (credential protection).

**Alternatives considered**: Hard-coding Twilio — rejected because it violates provider agnosticism (Principle III). Email-based OTP — out of scope; R02 uses phone/OTP only. Logging OTP codes for test convenience — rejected because it would weaken production security logging (NFR-007 violation).

---

## R-06: Rate-limiting implementation

**Decision**: Sliding-window counters stored in the same `SessionStore` (in-memory dict for dev, Redis for production). Per-IP limits apply to both sign-in and registration endpoints. Per-account limits apply to sign-in only. Thresholds are configurable via environment variables: `MAHAK_SIGNIN_RATE_LIMIT_WINDOW_MIN`, `MAHAK_SIGNIN_RATE_LIMIT_MAX_ATTEMPTS`, `MAHAK_REGISTER_RATE_LIMIT_WINDOW_MIN`, `MAHAK_REGISTER_RATE_LIMIT_MAX_ATTEMPTS`. Default: 5 sign-in attempts per 15 minutes per IP; 3 registration attempts per 15 minutes per IP.

**Rationale**: FR-018 and FR-019 require rate limiting per IP with sliding windows. Using the same store as sessions avoids an extra dependency in dev. Deterministic tests mock the store directly.

**Alternatives considered**: Fixed-window counters — simpler but allow burst attacks at window boundaries. IP-only (no per-account) — insufficient for protecting individual accounts. Separate Redis dependency — rejected for dev simplicity; the abstraction allows it in production.

---

## R-07: Session lifetime and sliding refresh

**Decision**: Session lifetime is a configurable timedelta (default 7 days). On each authenticated request, if the remaining lifetime is less than half the total lifetime, the session's `expiresAt` is extended by the full lifetime (sliding refresh). The `ShellModeProvider` on the web client is unaware of this logic; it only observes the `shellMode` value returned by `/api/v1/shell`.

**Rationale**: Q1 (Option C) specified configurable lifetime with sliding refresh. Half-life threshold prevents premature expiry during active use while still expiring idle sessions.

**Alternatives considered**: Fixed lifetime without refresh — rejected because it forces re-authentication during active sessions. Absolute expiry with re-authentication token — adds complexity not required by R02.

---

## R-08: Organization reference handling in R02

**Decision**: The invite token from the registration URL is accepted as a raw string field on the User entity (`organization_reference`). R02 validates the token format server-side (non-empty string within VARCHAR(255) bounds); a valid token is stored verbatim in the user record. The token is never resolved against an external organization management system, and no organization-management API or UI is implemented in R02. The value is carried into the session context but is not exposed in the `GET /api/v1/shell` response (NFR-006). A future feature resolves the token and binds the user to an organization.

**Rationale**: Q4 (Option B) specified opaque invite-token input. This keeps R02 scoped to the identity boundary only (FR-031) without introducing organization-management functionality.

**Alternatives considered**: Validating the token against a future org registry — rejected because it couples R02 to R27. Exposing the org name in the shell — rejected because no org UI exists in R02. Ignoring the token — rejected because FR-029 requires it to be stored.

---

## R-09: Database strategy

**Decision**: SQLAlchemy 2.x with async support (`asyncpg` for PostgreSQL, `aiosqlite` for SQLite). Schemas are defined via SQLAlchemy `Mapped` declarations; migrations use Alembic. R02 introduces three tables: `users`, `sessions`, `social_identities`. The `users` table has optional `email`, `phone`, `password_hash`, `role`, `organization_reference` columns. The `sessions` table has `id`, `user_id`, `created_at`, `expires_at`, `revoked_at`, `ip_address`. The `social_identities` table has `user_id`, `provider`, `provider_subject_id`.

**Rationale**: SQLAlchemy 2.x aligns with the project's Python 3.12 stack and provides both sync and async APIs. Alembic is the standard migration tool. The schema is minimal — only what R02 needs, nothing from later features.

**Alternatives considered**: Raw SQL — rejected because it lacks migration tooling and type safety. Django ORM — rejected because it couples the project to Django. Prisma — rejected because the api is Python/FastAPI, not Node.js.

---

## R-10: Authorization policy abstraction

**Decision**: Define an `AuthorizationPolicy` protocol with a single method `check(role: str, action: str) -> bool`. The default implementation uses a role-to-permissions map (`RolePermissions`). R02 ships with exactly two roles: `user` (no admin actions) and `admin` (all actions). Future roles are added by extending the map; the shell's route guards consume the policy through the protocol, so no shell code changes are needed (FR-025).

**Rationale**: FR-022–FR-028 require an extensible role model. A protocol-based policy keeps the authorization logic separate from the shell (Principle I, FR-053).

**Alternatives considered**: Hard-coded role checks in each route — rejected because it violates the extensibility requirement (FR-025). ABAC (attribute-based) — overkill for R02; RBAC is sufficient.

---

## R-11: Security event logging

**Decision**: The existing `logger/index.ts` (browser logger, NFR-006 compliant) is extended with a new server-side logger in `apps/api` that emits structured JSON records. Events include `sign_in_success`, `sign_in_failure`, `session_created`, `session_terminated`, `account_created`, `rate_limit_triggered`. Sensitive fields (passwords, tokens, OTP codes, provider secrets) are excluded by construction. The browser logger continues to log shell-level state changes (mode, viewport, theme, etc.).

**Rationale**: NFR-007 requires structured logging of security events without sensitive data. Reusing the existing logger pattern keeps the architecture consistent. OTP codes are never included in any log record, under any circumstance — including mock provider behaviour in development (see R-05).

**Alternatives considered**: Centralized observability platform — out of scope for R02. Plain-text logs — rejected because structured JSON is required for machine parsing (Principle V).
