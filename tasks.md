# Tasks: R02 — Identity, Authentication & Authorization

**Input**: Design documents from `specs/002-identity-auth/`
**Branch**: `002-identity-auth`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

---

## Phase 1: Foundation — Contracts, Persistence, Configuration

**Purpose**: Establish shared contract types, persistence infrastructure, and configuration boundaries that every later phase depends on. No user-story logic is implemented here.

- [x] T001 [P] Create `packages/contracts/src/auth-context.ts` exporting the `Role` type (`"user" | "admin"`), the `AuthContextValue` interface (`shellMode`, `isAuthenticated`, `role`, `organizationReference`, `setShellMode`), and the `isRole` guard, per `contracts/authorization.md` § Roles and § Shell Integration
- [x] T002 [P] Extend `packages/contracts/src/shell-mode.ts` to export the existing `ShellMode` type unchanged; verify `SHELL_MODE_VALUES`, `DEFAULT_SHELL_MODE`, and `isShellMode` remain byte-for-byte identical to R01 (FR-033, FR-034)
- [x] T003 [P] Add `apps/api/pyproject.toml` extras for `bcrypt`, `httpx`, `aiosqlite`, `asyncpg`, and `alembic`; pin versions compatible with Python 3.12
- [x] T004 [P] Create `apps/api/src/mahak_api/config.py` reading env vars `MAHAK_DATABASE_URL`, `MAHAK_SESSION_STORE` (`memory` or `redis`), `MAHAK_CAPTCHA_PROVIDER` (`mock` or real), `MAHAK_OTP_PROVIDER` (`mock` or real), `MAHAK_GOOGLE_CLIENT_ID`, `MAHAK_GOOGLE_CLIENT_SECRET`, `MAHAK_SESSION_LIFETIME_MIN` (default 10080 = 7 days), `MAHAK_SIGNIN_RATE_LIMIT_WINDOW_MIN` (default 15), `MAHAK_SIGNIN_RATE_LIMIT_MAX_ATTEMPTS` (default 5), `MAHAK_REGISTER_RATE_LIMIT_WINDOW_MIN` (default 15), `MAHAK_REGISTER_RATE_LIMIT_MAX_ATTEMPTS` (default 3), `MAHAK_BCRYPT_COST` (default 12), `MAHAK_OTP_EXPIRES_IN_SEC` (default 600), `MAHAK_OTP_LENGTH` (default 6); no secrets are printed or returned in api responses (NFR-003, NFR-006)
- [x] T005 [P] Create `apps/api/src/mahak_api/database.py` with async SQLAlchemy `Engine` factory selected from `MAHAK_DATABASE_URL`; `get_session()` async generator; Alembic migration directory at `apps/api/alembic/`
- [x] T006 [P] Create `apps/api/src/mahak_api/logger.py` structured JSON logger emitting `event_id`, `user_id` (nullable), `event_type`, `ip_address`, `user_agent` (truncated to 512 chars), `timestamp`, `details` (JSONB); explicitly exclude `password`, `password_hash`, `token`, `otp_code`, `session_id`, `provider_secret`, and `organization_reference` from any log output (NFR-007); auth endpoints MUST respond within 500 ms for valid requests under normal load and within 5 seconds for rate-limited or CAPTCHA-challenged requests (NFR-004)

**Checkpoint**: Contracts compile, config reads all env vars, database engine is instantiable, logger accepts event fields without sensitive data. All Phase 1 tasks are independent `[P]` and may run in parallel.

---

## Phase 2: Foundational — Domain Models and Session Infrastructure

**Purpose**: Persistent domain models and the session store abstraction. These are strict prerequisites for all authentication flows.

- [x] T007 [P] [US2] Create `apps/api/src/mahak_api/models/user.py` — SQLAlchemy 2.x `Mapped` model `User` with columns: `id` (UUID, PK, generated on create), `email` (VARCHAR(320), nullable, unique constraint when non-null, RFC 5322 subset validation at service layer), `phone` (VARCHAR(50), nullable, unique constraint when non-null, E.164 validation at service layer), `password_hash` (VARCHAR(255), nullable — absent for Google-only accounts), `role` (VARCHAR(20), NOT NULL, constrained to `"user"` or `"admin"` via check constraint — R02 has exactly two roles; extensible for future roles), `organization_reference` (VARCHAR(255), nullable — populated only with a server-side validated invite token; invalid tokens are not stored), `created_at` (TIMESTAMPTZ, NOT NULL, defaults NOW()), `last_login_at` (TIMESTAMPTZ, nullable). A user MUST have at least one of `email`, `phone`, or a linked social identity. Unique constraints on `email` and `phone` are each conditional on non-null value (FR-005, FR-013, Q3 Option B).
- [x] T008 [P] [US2] Create `apps/api/src/mahak_api/models/social_identity.py` — SQLAlchemy 2.x `Mapped` model `SocialIdentityLink` with columns: `user_id` (UUID, FK → users.id, NOT NULL), `provider` (VARCHAR(50), NOT NULL, e.g. `"google"`), `provider_subject_id` (VARCHAR(255), NOT NULL). Unique constraint on `(provider, provider_subject_id)` — a given provider subject links to exactly one account. No provider tokens or secrets stored (Q2 Option A).
- [x] T009 [P] [US6] Create `apps/api/src/mahak_api/models/session.py` — SQLAlchemy 2.x `Mapped` model `Session` with columns: `id` (UUID, PK, internal primary key — distinct from the browser-facing token), `token` (VARCHAR(256), NOT NULL — browser-facing session token: a cryptographically random value of at least 128 bits, 256-bit recommended; stored hashed in PostgreSQL for verification), `user_id` (UUID, FK → users.id, NOT NULL), `created_at` (TIMESTAMPTZ, NOT NULL), `expires_at` (TIMESTAMPTZ, NOT NULL), `revoked_at` (TIMESTAMPTZ, nullable), `ip_address` (INET, NOT NULL). A session is valid when `revoked_at IS NULL AND NOW() < expires_at`. Multiple concurrent sessions per user are permitted. `logout-all` sets `revoked_at` on all sessions for the user (FR-009, FR-011, FR-012, FR-014, NFR-002).
- [x] T010 [P] [US6] Create `apps/api/src/mahak_api/services/session_store.py` — abstract `SessionStore` protocol with methods: `get_user_id(session_id: UUID) -> UUID | None` (fast lookup only), `create(session: Session) -> None`, `update_expires(session_id: UUID, new_expiry: datetime) -> None`, `revoke(session_id: UUID) -> None`, `revoke_all(user_id: UUID) -> None`. Implement `InMemorySessionStore` (dict-backed, for dev/test) and `RedisSessionStore` (production). **Critical rule: the SessionStore is a lookup/cache layer only — it is NEVER the authority for session validity.** Every authenticated request MUST query PostgreSQL directly to verify `revoked_at IS NULL AND NOW() < expires_at`; a SessionStore cache hit is never sufficient to authorize a request. Write rules: on creation write PostgreSQL first then SessionStore (best-effort); on revoke/update write PostgreSQL first then SessionStore (best-effort). Stale cache MUST NOT bypass revocation or expiration (research R-01, data-model.md Session § Read/write consistency rules, FR-011, FR-012).
- [x] T011 [P] [US4] Create `apps/api/src/mahak_api/services/rate_limiter.py` — sliding-window rate limiter with methods: `record(identifier: str, window_start: datetime, window_end: datetime, max_attempts: int) -> RateLimitResult`. `RateLimitResult` has fields `allowed: bool`, `retry_after_seconds: int | None`. Per-IP limits apply to sign-in and registration endpoints; per-account limits apply to sign-in only. Counters reset after the window expires. The identifier key MUST NOT be logged (FR-017, FR-018, FR-019, FR-020, FR-021). Store buckets in the same `SessionStore` abstraction (in-memory dict for dev, Redis for production).
- [x] T012 [P] [US7] Create `apps/api/alembic/versions/001_initial_auth_schema.py` — migration creating `users`, `sessions`, `social_identities` tables with all columns and constraints defined in data-model.md. Include `updown` reversible migration.
- [x] T013 [P] Create `apps/api/src/mahak_api/contracts/auth.py` — Pydantic v2 request/response schemas mirroring `contracts/auth.md`: `RegisterEmailRequest`, `RegisterPhoneRequest`, `VerifyPhoneRequest`, `SignInEmailRequest`, `SignInPhoneRequest`, `CaptchaChallengeResponse`, `AuthResponse` (shellMode field); `OAuthInitResponse` (authorizationUrl field). All response models exclude credentials, secrets, tokens, and provider keys.

**Checkpoint**: Models compile, migration runs against SQLite, SessionStore can create/read/revoke sessions, RateLimiter enforces sliding-window limits, auth contract schemas validate correctly. All Phase 2 tasks are independent `[P]` and may run in parallel.

---

## Phase 3: User Story 1 — Account Registration (Priority: P1) 🎯 MVP Entry Gate

**Goal**: A visitor can create a MAHAK account via email/password (with CAPTCHA), phone/OTP, or Google sign-in, and the shell transitions to authenticated mode.

**Independent Test**: Register a new account via each supported method; confirm the shell transitions from public to authenticated mode; verify the eight reserved destinations become visible in the navigation.

### Implementation — User Story 1

- [x] T014 [US1] [P] Create `apps/api/src/mahak_api/services/captcha_service.py` — abstract `CaptchaProvider` protocol with `verify(token: str, response: str) -> bool` and `challenge_html(locale: str) -> str`. Implement `MockCaptchaProvider` (always returns True) and `RealCaptchaProvider` (wraps reCAPTCHA v3 or hCaptcha via configurable site key resolved from `MAHAK_CAPTCHA_PROVIDER`). Secret key is never logged or returned in any response (FR-016, FR-043).
- [x] T015 [US1] [P] Create `apps/api/src/mahak_api/services/otp_service.py` — abstract `OtpDeliveryProvider` protocol with `send(phone: str, code: str) -> None`. Implement `MockOtpProvider` (stores code in a module-level test fixture registry keyed by phone number, never logs the code) and `RealOtpProvider` (plugged via `MAHAK_OTP_PROVIDER`). OTP codes are 6-digit numeric, valid for 10 minutes, single-use. Codes are NEVER written to any log, to any api response, or to any client-side asset (NFR-007, NFR-006).
- [x] T016 [US1] [P] Create `apps/api/src/mahak_api/services/auth_service.py` — core registration logic: `register_email(email, password, captcha_token, invite)` hashes password with bcrypt (cost from config), creates `User`, optional `SocialIdentityLink` if Google-linked, validates optional `invite` token (non-empty string within VARCHAR(255) bounds; invalid → null `organization_reference`, valid → stored), returns `Session` record. `register_phone(phone, captcha_token)` validates phone format, sends OTP via `OtpDeliveryProvider`, returns OTP expiry. Verifies CAPTCHA before any account creation. Returns generic failure on duplicate email/phone — never confirms or denies existence (FR-001, FR-002, FR-003, FR-005, FR-006, FR-007).
- [x] T017 [US1] [P] Create `apps/api/src/mahak_api/routes/auth.py` — mount routes `POST /api/v1/auth/register/email`, `POST /api/v1/auth/register/phone`, `POST /api/v1/auth/register/phone/verify`, `POST /api/v1/auth/sign-in/email`, `POST /api/v1/auth/sign-in/phone`, `POST /api/v1/auth/sign-in/phone/verify`, `POST /api/v1/auth/sign-out`, `POST /api/v1/auth/sign-out-all` from `auth_service.py`. All routes that create a session set the `mahak_session` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`) and return `{shellMode: "authenticated"}`. Sign-out routes set `mahak_session=; Max-Age=0`. No response body contains credentials, secrets, or tokens (NFR-003, NFR-006).
- [x] T018 [US1] [P] Create `apps/web/src/services/AuthService.ts` — web client auth API wrapper calling `POST /api/v1/auth/register/email`, `POST /api/v1/auth/register/phone`, `POST /api/v1/auth/register/phone/verify`, `POST /api/v1/auth/sign-in/email`, `POST /api/v1/auth/sign-in/phone`, `POST /api/v1/auth/sign-in/phone/verify`, `POST /api/v1/auth/sign-out`, `POST /api/v1/auth/sign-out-all`, `GET /api/v1/auth/captcha/challenge`. All methods use `fetch` with credentials included. No token storage in memory or localStorage. Error handling returns typed error objects matching `contracts/auth.md` error response shapes.
- [x] T019 [US1] [P] Create `apps/web/src/pages/SignUpPage.tsx` — sign-up form with tabs for email/password and phone/OTP. Email/password tab includes CAPTCHA widget (loads challenge HTML from `/api/v1/auth/captcha/challenge`, submits token with registration). Phone/OTP tab shows phone input, requests OTP, then shows OTP input. Validates email format and phone E.164 format client-side. Supports Persian/Arabic/English locales with RTL/LTR layout. Keyboard navigable. 200% zoom safe. On success, calls `AuthService.register*()` and triggers shell mode transition via `AuthProvider` (FR-001, FR-002, FR-003, FR-006, NFR-008, NFR-009).
  - **Runtime dependency (previously undeclared): T037.** `SignUpPage.tsx` already calls `GET /api/v1/auth/captcha/challenge`, which T037 owns; the route does not exist in the api yet. The Phase 3 checkpoint below is **not** satisfied until T037 lands, so this checkbox marks code completion only.
- [x] T020 [US1] [P] Create `apps/web/src/pages/GoogleCallbackPage.tsx` — handles Google OAuth callback redirect. Reads `code` query parameter, calls `AuthService.googleCallback(code)`. On success, `AuthProvider` updates shell mode to authenticated; on failure, shows generic error and redirects to sign-in. No provider tokens or secrets are stored in browser application code (FR-004, FR-015, FR-042).
- [x] T021 [US1] [P] Extend `apps/web/src/providers/AuthProvider.tsx` — add `isAuthenticated`, `role`, `organizationReference` to shell context. Subscribe to `ShellModeProvider` changes; when `shellMode` becomes `authenticated`, fetch user profile from api to populate `role` and `organizationReference`. When `shellMode` becomes `public`, clear `role` and `organizationReference`. Provides `signOut()` and `signOutAll()` methods that call the auth api and then set shell mode to `public`.
  - **Runtime dependency (previously undeclared, unresolved):** the profile endpoint `GET /api/v1/auth/me` that `AuthProvider.tsx` calls is **not declared in `contracts/auth.md` and is not implemented in the api**. Ownership is **proposed** as T085, pending the `organizationReference` governance decision (see "Governance" below). The Phase 3 checkpoint below is **not** satisfied until that endpoint exists, so this checkbox marks code completion only.
- [ ] T022 [US1] Extend `apps/web/src/router/index.tsx` — add routes `/sign-in`, `/sign-up`, `/google-callback` mapped to `SignInPage`, `SignUpPage`, `GoogleCallbackPage`. Protected routes (future: module destinations) redirect unauthenticated users to `/sign-in`. The R01 navigation registry is unchanged — eight reserved destinations keep `visibilityScope = "authenticated"`.
  - **Dependency (previously undeclared): T028.** `/sign-in` cannot map to the real `SignInPage` until T028 creates it; until then `/sign-in` continues to render the R01 `SignInEntry` placeholder, which is also the redirect target of `RequireAuthenticated`. Acceptance criteria are unchanged — they simply cannot pass before T028.
  - **`[P]` removed**: T022 now has a real cross-story dependency, so it must not be scheduled in parallel with T028.
- [ ] T023 [US1] Extend `apps/web/src/i18n/fa.json`, `ar.json`, `en.json` — add auth-specific string keys: `sign_in`, `sign_up`, `email`, `password`, `phone`, `otp_code`, `otp_expires_in`, `captcha_required`, `sign_in_with_google`, `already_signed_in`, `generic_auth_failure`, `rate_limit_message`, `service_unavailable`, `session_expired`, `session_revoked`, `unauthorized_access`, `forbidden_access`, `invite_token_optional`. Ensure all keys are used in `SignInPage` and `SignUpPage`.
  - **Dependency: T028.** The "used in `SignInPage`" clause cannot be satisfied until T028 creates the page.

**Checkpoint**: A visitor can register via email/password + CAPTCHA, phone/OTP, and Google sign-in. After each successful registration the shell is in authenticated mode with the eight reserved destinations visible. All three methods have component tests and at least one E2E test.

---

## Phase 4: User Story 2 — Sign-In and Session Management (Priority: P1)

**Goal**: A registered user can sign in via any method, maintain an active session across reloads, and explicitly terminate their session.

**Independent Test**: Sign in via each method, reload the page and confirm the session persists, navigate between reserved destinations and confirm the authenticated shell remains active, then sign out and confirm the shell returns to public mode.

### Implementation — User Story 2

- [ ] T024 [US2] [P] Extend `apps/api/src/mahak_api/services/auth_service.py` — add `sign_in_email(email, password, captcha_token)`, `sign_in_phone(phone)`, `sign_in_phone_verify(phone, otp_code)`. `sign_in_email` verifies bcrypt hash, checks rate limit per IP and per account, applies adaptive CAPTCHA after threshold, returns session. `sign_in_phone` validates phone, sends OTP, returns OTP expiry. `sign_in_phone_verify` verifies single-use OTP within expiry window, creates session, updates `last_login_at`. Invalid credentials always return the same generic failure message regardless of whether the email/phone exists (FR-008, FR-013, FR-038).
- [ ] T025 [US2] [P] Create `apps/api/src/mahak_api/routes/google.py` — `GET /api/v1/auth/sign-in/google` generates PKCE `code_verifier`/`code_challenge`, stores `code_verifier` in the SessionStore keyed by a transient state ID, returns `{authorizationUrl}`. `GET /api/v1/auth/google/callback` exchanges the authorization `code` server-side via httpx to Google's token endpoint using `MAHAK_GOOGLE_CLIENT_SECRET` (never exposed to browser), verifies the Google user info email, checks `SocialIdentityLink` for matching existing account (links if match found per Q2 Option A, creates new account if no match), creates a session, sets the `mahak_session` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`), and redirects to `/` (application root). No `shellMode` query parameter is used in the production redirect. Interrupted flows (no `code` or expired code) set a flash error and redirect to `/sign-in` with a generic failure message (FR-004, FR-015, FR-042, FR-048).
- [ ] T026 [US2] [P] Extend `apps/api/src/mahak_api/routes/auth.py` — add `POST /api/v1/auth/sign-in/email`, `POST /api/v1/auth/sign-in/phone`, `POST /api/v1/auth/sign-in/phone/verify`, `POST /api/v1/auth/sign-out`, `POST /api/v1/auth/sign-out-all` routes wired to `auth_service.py` methods. Sign-out sets cookie `mahak_session=; Max-Age=0` and terminates the current session in both PostgreSQL and SessionStore. Sign-out-all revokes all sessions for the user in PostgreSQL (authoritative) and removes them from SessionStore; PostgreSQL revocation wins even if SessionStore cleanup fails (FR-010, FR-011, FR-012, FR-014).
- [ ] T027 [US2] [P] Extend `apps/web/src/services/AuthService.ts` — add `signInEmail`, `signInPhone`, `signInPhoneVerify`, `googleSignIn`, `signOut`, `signOutAll` methods. Each method handles the `mahak_session` cookie automatically via `credentials: 'include'` on fetch.
  - **Progress note (verified against source and tests): 5 of 6 methods exist and are tested** — `signInEmail`, `signInPhone`, `signInPhoneVerify`, `signOut`, `signOutAll`. **Remaining scope: `googleSignIn()`** — `POST /api/v1/auth/sign-in/google`, request `{}`, response `200 {authorizationUrl}` (`contracts/auth.md`). Do not mark this task complete from method existence alone.
- [ ] T028 [US2] [P] Create `apps/web/src/pages/SignInPage.tsx` — sign-in form with tabs for email/password, phone/OTP, and Google sign-in button. Email/password tab shows email + password inputs and adaptive CAPTCHA widget (shown only after threshold of failed attempts from the same IP — determined server-side; the API response indicates whether a captcha token is required). Phone/OTP tab shows phone input, requests OTP, then shows OTP input. Google button initiates OAuth flow via `AuthService.googleSignIn()`. Keyboard navigable. RTL/LTR correct for all locales. 200% zoom safe. On success, `AuthProvider` updates to authenticated; on failure, shows generic error message (FR-008, FR-013, FR-038, NFR-008, NFR-009).
- [ ] T029 [US2] [P] Extend `apps/web/src/providers/ShellModeProvider.tsx` — extend to read the `mahak_session` cookie from the browser, call `GET /api/v1/shell` on mount and on session change; resolve `shellMode` from the response. When the session cookie is absent or the shell response returns `public`, clear auth context. The existing `?shellMode=authenticated|public` query override continues to work as an explicit test harness mechanism only (not used in production flows). Transitions between public and authenticated MUST NOT reload the page or restructure the shell frame (FR-033, FR-034, FR-037).
- [ ] T030 [US2] [P] Create `apps/web/tests/component/SignInPage.test.tsx` — component tests for SignInPage: renders all three sign-in tabs; email/password form with CAPTCHA widget; phone/OTP form with two-step flow; Google sign-in button; generic error message on invalid credentials; keyboard tab order reaches all controls; RTL layout correct in `fa` locale; works at 200% zoom.
  - **Depends on T028** (the page under test) and, for its Google-tab criterion, **T025 + T027's remaining `googleSignIn()`**.
  - **Required companion of T028**; T028's acceptance criteria cannot be verified without it.
- [x] T031 [US2] [P] Create `apps/web/tests/component/SignUpPage.test.tsx` — component tests for SignUpPage: renders email/password tab with CAPTCHA; phone/OTP tab with two-step flow; validates email format and phone E.164 format client-side; shows generic failure on duplicate email without confirming existence; keyboard navigable; RTL correct.
  - **Verified complete**: the file exists at the declared path with 24 passing tests covering every listed criterion (verified in the 221-test web suite).

**Checkpoint**: Sign-in via all three methods works. Session persists across reload. Sign-out terminates session and returns shell to public mode. All component tests pass.

---

## Phase 5: User Story 3 — Authorization and Role-Based Access (Priority: P1)

**Goal**: Authenticated users access only the features their role permits. The authorization system is extensible for future roles.

**Independent Test**: Sign in as a user and as an admin; verify admin-only actions are unavailable to regular users; verify unauthorized access redirects to the sign-in entry point.

### Implementation — User Story 3

- [ ] T032 [US3] [P] Create `apps/api/src/mahak_api/services/authorization.py` — `AuthorizationPolicy` protocol with `check(role: str, action: str) -> bool`. Default `RoleBasedPolicy` implementation uses a `RolePermissions` map keyed by role string. R02 ships with exactly two roles: `user` (no admin actions) and `admin` (all actions). New roles are added by extending the map — no shell code changes required (FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028).
- [ ] T033 [US3] [P] Create `apps/api/src/mahak_api/middleware/auth.py` — FastAPI dependency that extracts the `mahak_session` cookie, uses `SessionStore` for fast token-to-user_id lookup, then **queries PostgreSQL directly to verify `revoked_at IS NULL AND NOW() < expires_at`** before accepting the session as authenticated. Loads the `User` record, checks expiration and revocation from PostgreSQL (not from cache), and attaches `user`, `session`, and `role` to the request state. Expired or revoked sessions cause a redirect to sign-in with session-expired or session-revoked message (FR-011, FR-012, FR-039).
- [ ] T034 [US3] [P] Create `apps/api/src/mahak_api/middleware/authorization.py` — FastAPI dependency using `AuthorizationPolicy.check(role, action)` to guard admin-only routes. Unauthorized access returns a generic error without exposing internal authorization logic. Wrong-role access returns a generic forbidden message (FR-023, FR-024, FR-045, FR-046).
- [ ] T035 [US3] [P] Extend `apps/web/src/providers/AuthProvider.tsx` — on shell mode `authenticated`, fetch user profile including `role` from the api; expose `role` and `organizationReference` in the auth context. When `shellMode` changes to `public`, clear both. When the session expires or is revoked, transition to `public` and clear context (FR-027, FR-032).
- [ ] T036 [US3] [P] Extend `apps/web/src/router/index.tsx` — add route guards that check `AuthProvider.isAuthenticated` and `AuthProvider.role` before rendering module destinations. Unauthenticated access redirects to `/sign-in`. Wrong-role access to admin routes presents a generic message (FR-028).
  - **Runtime dependency (previously undeclared): T086.** The guards read `AuthProvider.isAuthenticated`/`.role`, but `AuthProvider` is not mounted in `App.tsx`, so `useAuth()` throws. `/sign-in` must also be a real page (T028) for the redirect to be meaningful.

**Checkpoint**: User-role account cannot access admin-only content. Admin-role account can. Unauthorized access redirects to sign-in without exposing protected content. Component tests cover both roles.

---

## Phase 6: User Story 4 — CAPTCHA and Abuse Resistance (Priority: P2)

**Goal**: Authentication endpoints are protected against automated abuse while remaining usable for legitimate users.

**Independent Test**: Submit multiple rapid sign-in attempts from the same IP and observe the rate-limit response; submit a registration without a valid CAPTCHA and observe rejection; submit a registration with a valid CAPTCHA and observe acceptance.

### Implementation — User Story 4

- [ ] T037 [US4] [P] Extend `apps/api/src/mahak_api/services/captcha_service.py` — `MockCaptchaProvider` supports a test-only mode where it rejects all tokens except a fixture-provided valid token. `RealCaptchaProvider` wraps the configured CAPTCHA service. The `captcha.py` route at `GET /api/v1/auth/captcha/challenge` returns locale-aware HTML (RTL for `fa`/`ar`, LTR for `en`) and binds the challenge token to the session with a 5-minute lifetime (FR-016, FR-043).
  - **Blocked-by consumer (previously undeclared): T019 depends on this task.** `SignUpPage.tsx` already calls `GET /api/v1/auth/captcha/challenge` on mount; the route does not exist in the api yet. The Phase 3 checkpoint above cannot pass until this task lands. `contracts/auth.md` already declares the route, so no contract work is needed here — only the `captcha.py` route file and its router mount.
- [ ] T038 [US4] [P] Extend `apps/api/src/mahak_api/services/rate_limiter.py` — add `check_sign_in(ip: str, account_identifier: str | None) -> RateLimitResult` and `check_register(ip: str) -> RateLimitResult`. Per-IP counters apply to both sign-in and registration. Per-account counters apply to sign-in only. After the configurable threshold of consecutive failures, the response indicates a CAPTCHA challenge is required. The blocked state expires automatically when the sliding window ends. No account existence is revealed at any point (FR-017, FR-018, FR-019, FR-020, FR-021).
  - **Dependent (previously undeclared): T028.** T028's adaptive CAPTCHA requirement ("threshold of failed attempts from the same IP — determined server-side") depends on `check_sign_in`, and this task must land before that criterion can pass.
- [ ] T039 [US4] [P] Create `apps/api/tests/test_rate_limiter.py` — unit tests: per-IP sign-in rate limit blocks after threshold and unblocks after window expires; per-account sign-in rate limit is independent of per-IP; registration rate limit is independent; blocked response does not indicate whether the target account exists; counters reset after window expiry; 100% of rate-limited IPs are blocked for the full window and unblocked after expiry (SC-003, SC-004).
- [ ] T040 [US4] [P] Create `apps/api/tests/test_captcha_service.py` — unit tests: mock provider accepts valid token and rejects invalid; real provider delegates to configured service; challenge HTML is locale-aware (RTL class for `fa`/`ar`, LTR for `en`); challenge token expires after configurable lifetime.
- [ ] T041 [US4] Extend `apps/web/tests/e2e/a11y-keyboard.spec.ts` — add tests verifying CAPTCHA challenge appears after repeated failed sign-in attempts and that CAPTCHA failure produces a clear message (part of existing E2E file per plan structure).

**Checkpoint**: Rate limiting blocks after threshold with correct retry-after time. CAPTCHA is required on registration and adaptively on sign-in. No account enumeration via any response.

---

## Phase 7: User Story 5 — Organization-Ready Identity Boundaries (Priority: P2)

**Goal**: The identity system supports an optional organization reference supplied as an opaque invite token at registration, without implementing organization management.

**Independent Test**: Create a user with and without an invite token; verify the organization reference is stored correctly; verify authentication and authorization work the same whether or not the reference is populated.

### Implementation — User Story 5

- [ ] T042 [US5] [P] Extend `apps/api/src/mahak_api/services/auth_service.py` — `register_email()` and `register_phone()` accept an optional `invite` parameter. When present, the value is validated server-side against a lightweight R02 invite-token validation contract (e.g. non-empty string within VARCHAR(255) bounds, opaque format — no resolution to organization metadata). A valid token is stored in `User.organization_reference`; an invalid or malformed token is silently discarded and `organization_reference` is set to null. The account is always created regardless of invite token validity. No organization-management API or UI exists in R02; the token is never resolved to an org name or used for org-scoped authorization (FR-029, FR-030, FR-031, FR-032, Q4 Option B).
- [ ] T043 [US5] [P] Extend `apps/web/src/providers/AuthProvider.tsx` — include `organizationReference` in the auth context derived from the session/user profile. The value is available for downstream features but is NOT rendered in any R02 UI element (FR-031).
- [ ] T044 [US5] [P] Create `apps/web/tests/component/ReservedDestination.test.tsx` — component test that activates each of the eight reserved destinations and asserts the defined unavailable state is presented without implying the feature exists (T104 from convergence, FR-013, FR-050).
- [ ] T045 [US5] [P] Create `apps/web/tests/e2e/organization-ref.spec.ts` — E2E test: register with a valid invite token in the URL (`/sign-up?invite=test-org-token-123`); verify the account is created with the organization reference stored; verify the shell transitions to authenticated mode normally; verify no organization-management UI is shown; register with an invalid invite token; verify the account is created successfully with a null organization reference; register without an invite token; verify the account is created with a null organization reference (FR-029, FR-030, FR-031, FR-032, Q4 Option B).

**Checkpoint**: Accounts with and without organization references authenticate and authorize identically. No org-management functionality exists in R02.

---

## Phase 8: User Story 6 — Error and Recovery States (Priority: P2)

**Goal**: Every authentication error produces a safe, clear message with a recovery path where one exists. No sensitive details are exposed.

**Independent Test**: Trigger each defined error condition and verify the shell presents the correct message, the session state is consistent, and a recovery path exists where applicable.

### Implementation — User Story 6

- [ ] T046 [US6] [P] Extend `apps/api/src/mahak_api/services/auth_service.py` — all sign-in and registration paths return uniform error messages: invalid credentials never indicate which field was wrong; OTP invalid/expired returns distinct messages from each other but both are clear and offer retry; CAPTCHA failure is clear; rate-limit response includes retry-after seconds; service-unavailable responses include a retry option and never expose stack traces or internal error details; Google callback failure is generic (FR-038, FR-039, FR-040, FR-041, FR-042, FR-043, FR-044, FR-045, FR-046, FR-047, FR-048).
- [ ] T047 [US6] [P] Extend `apps/web/src/pages/SignInPage.tsx` and `SignUpPage.tsx` — display localized error messages from the api response. Map each error type to a user-friendly message key in the i18n resources. Ensure error messages never reveal whether an account exists.
- [ ] T048 [US6] [P] Create `apps/web/tests/component/a11y-error-states.test.tsx` — component tests verifying that each error state (invalid credentials, expired session, invalid OTP, expired OTP, CAPTCHA failure, rate limit, service unavailable) is announced to assistive technology via the `AnnouncementProvider` polite live region and is visible in the correct locale (fa, ar, en).
- [ ] T049 [US6] [P] Create `apps/api/tests/test_auth_error_messages.py` — unit tests verifying each error path returns the correct HTTP status and a generic message body without sensitive data.

**Checkpoint**: Every error condition produces a safe message. No account enumeration. No provider error leakage. All error states are localized and accessible.

---

## Phase 9: User Story 7 — R01 Shell Integration (Priority: P1)

**Goal**: The R01 shell transitions seamlessly between public and authenticated modes when the session state changes, without page reload or layout restructuring.

**Independent Test**: Sign in from the public shell, confirm the navigation set changes to include the eight reserved destinations and the account area appears; sign out, confirm the shell returns to the public navigation set.

### Implementation — User Story 7

- [ ] T050 [US7] [P] Extend `apps/api/src/mahak_api/routes/shell.py` — modify `GET /api/v1/shell` to resolve `shellMode` from the active session cookie. On every request, query PostgreSQL directly to verify the session is valid (`revoked_at IS NULL AND NOW() < expires_at`); the SessionStore is used only for fast token-to-user_id lookup. When a valid session exists in PostgreSQL, return `"authenticated"`; when no valid session exists, return `"public"`. The response schema, field names, and availability map remain identical to the R01 contract. No credentials, secrets, or user data in the response (FR-033, FR-034, FR-035, FR-036, FR-037).
- [ ] T051 [US7] [P] Extend `apps/web/src/providers/ShellModeProvider.tsx` — on mount, call `GET /api/v1/shell` with the session cookie. If the response returns `shellMode: "authenticated"`, set the shell mode and populate `AuthProvider` context. If `public`, clear auth context. On any session loss (expired, revoked, absent cookie), transition to `public` and redirect to sign-in. The test harness `?shellMode=authenticated|public` query override continues to work as an explicit test-only mechanism (not used in production) (FR-033, FR-034, FR-037, SC-012).
  - **Scope note:** this task owns session-aware mode resolution in `ShellModeProvider.tsx` only. Mounting `AuthProvider` in the application root is **not** folded in here — it is assigned to T086 below.
- [ ] T086 [US7] Create the `AuthProvider` mount in `apps/web/src/App.tsx` — mount `AuthProvider` **inside** `ShellModeProvider` so the auth context consumes the existing shell-mode seam. Purpose: T021 created the provider but no file mounts it, so `useAuth()` throws and the provider is dead code at runtime. Must not introduce a parallel shell-state system; `AuthProvider` consumes `useShellMode()` exclusively (plan boundary rule 2, `plan.md`). Update `tests/utils/shell-tree.tsx` so the shared shell test tree includes the provider, and keep every existing web test green.
  - **File scope:** `apps/web/src/App.tsx`; `apps/web/tests/utils/shell-tree.tsx`.
  - **Dependencies:** T021 (complete).
  - **Must land before:** T028 ("on success, `AuthProvider` updates to authenticated") and T036 ("guards that check `AuthProvider.isAuthenticated`") can pass their runtime acceptance criteria.
  - **Acceptance criteria:** (1) `AuthProvider` is mounted inside `ShellModeProvider` in `App.tsx`; (2) no second source of shell truth is introduced; (3) `useAuth()` resolves without throwing inside the app; (4) no `document.cookie` read and no `localStorage`/`sessionStorage` auth state (NFR-006); (5) the full web suite stays green.
  - **New task — a T051 file-scope amendment was rejected:** T051 is `[P]` single-file and owns session-aware mode resolution, not application composition. Folding `App.tsx` into it would break the `[P]` "different files" rationale and mix two concerns. Placed in Phase 9 (US7) as the shell-composition story, with the prerequisite edges to T028/T036 recorded explicitly.
- [ ] T052 [US7] [P] Extend `apps/web/src/shell/regions/HeaderRegion.tsx` — wire the existing sign-in/sign-up header actions to navigate to `/sign-in` and `/sign-up` respectively when `shellMode` is `public`. When `shellMode` is `authenticated`, replace these with the account area (user role indicator and sign-out control) without restructuring the header region (FR-035, FR-036).
- [ ] T053 [US7] [P] Create `apps/web/tests/e2e/shell-transition.spec.ts` — E2E tests: sign in → shell transitions to authenticated without reload, eight destinations appear, account area replaces sign-in entry points; sign out → shell returns to public, destinations disappear, sign-in entry points reappear; expired session → shell transitions to public on next authenticated request; revoked session → same behavior. No page reload occurs during any transition (FR-037, SC-006, SC-008, SC-009).
- [ ] T054 [US7] [P] Create `apps/api/tests/test_shell_contract.py` — api contract test verifying `GET /api/v1/shell` returns the exact R01 response shape (same fields, same enum values, same availability map) with `shellMode` resolved from the active session. No credentials or secrets in the response body (FR-033, FR-034, SC-012).

**Checkpoint**: Shell transitions between public and authenticated without reload. The `GET /api/v1/shell` contract is preserved byte-for-byte. E2E tests verify all transition paths.

---

## Phase 10: UX, Security, and Resilience

**Goal**: Authentication pages are accessible, localized, responsive, and resilient to provider failures. Security boundaries are enforced end-to-end.

**Independent Test**: Auth pages render correctly in all three locales with correct RTL/LTR; are fully keyboard-operable; handle provider failures gracefully; contain zero leaked credentials or secrets.

### Implementation — Phase 10

- [ ] T055 [P] Extend `apps/web/src/pages/SignInPage.tsx` and `SignUpPage.tsx` — ensure all form labels, placeholders, error messages, and button text use i18n keys from `fa.json`, `ar.json`, `en.json`. Direction (RTL/LTR) follows the active locale automatically via the R01 `DirectionProvider`. Responsive layout works at desktop, tablet, and mobile viewports (NFR-008, NFR-009).
- [ ] T056 [P] Create `apps/web/tests/e2e/auth-localization.spec.ts` — E2E tests: open sign-in and sign-up pages in `fa` (RTL), `ar` (RTL), and `en` (LTR) locales; verify all labels and placeholders render in the correct language and direction; tab through forms in each locale and verify focus order is correct; verify 200% zoom does not clip or overlap any control (NFR-008, NFR-009, SC-010).
- [ ] T057 [P] Create `apps/web/tests/e2e/provider-failure.spec.ts` — E2E tests: simulate Google provider unreachable (mock returns 503); verify email/password and phone/OTP sign-in remain functional; simulate OTP provider failure; verify other methods remain functional; verify service-unavailable message is shown with a retry option and no stack trace is exposed (NFR-010, FR-047).
- [ ] T058 [P] Create `apps/api/tests/test_security_assertions.py` — tests verifying: (1) no password hash appears in any api response or log; (2) no session token appears in any JSON response body; (3) no provider secret (Google Client Secret, CAPTCHA secret, OTP provider key) is logged or returned; (4) no OTP code appears in any log record under any circumstance; (5) rate-limit responses do not indicate account existence; (6) sign-in error responses are identical for known and unknown accounts (NFR-001, NFR-002, NFR-003, NFR-006, NFR-007, FR-005, FR-013, FR-021; SC-005).
- [ ] T059 [P] Create `apps/api/tests/test_secret_exposure_scan.py` — automated scan that parses all api response schemas, all logger emit calls, and all test fixtures to assert that no field named `password`, `password_hash`, `token`, `secret`, `otp_code`, `client_secret`, or `provider_key` is present in any output. Fails the build if any leak is detected (NFR-003, NFR-006, SC-007).

**Checkpoint**: All auth pages are localized, accessible, responsive, and resilient. Zero secret exposure in any code path.

---

## Phase 11: Tests and Quality Gates

**Goal**: Complete test coverage across all layers, deterministic mocked-provider tests, and all project validation gates passing.

### Unit Tests

- [ ] T060 [P] [US1] Create `apps/api/tests/services/test_auth_service.py` — unit tests: email registration creates user with correct role default (`user`), stores bcrypt hash (verifiable by re-hashing), validates invite token (valid token stored, invalid token results in null organization_reference, missing token results in null), returns uniform error on duplicate email, applies CAPTCHA check before account creation, respects rate limit on registration, handles OTP generation and single-use verification, handles Google identity linking (existing account match vs. new account creation), handles concurrent sessions per user.
  - **Path corrected:** the declared path was `apps/api/tests/test_auth_service.py`; the file actually lives at `apps/api/tests/services/test_auth_service.py` (19 tests, collected via `testpaths = ["tests"]` in `pyproject.toml`).
  - **Do not mark complete.** Covered: registration, bcrypt hashing, invite-token validation, CAPTCHA blocking, OTP generation and single-use handling, session id/token separation. **Not yet covered:** registration rate limiting, Google identity linking (match vs. new account), and concurrent sessions per user — all of which belong to later tasks (`T038`, `T025`, `T060`'s own remaining scope).
- [ ] T061 [P] [US6] Create `apps/api/tests/test_session_store.py` — unit tests: in-memory store create/read(revoke)/revoke-all; Redis store interface contract; **critical security assertion**: a revoked session in the cache is rejected on every PostgreSQL query (no bypass through stale cache); sliding refresh updates both stores; expired sessions are rejected by PostgreSQL on every request; logout-all revokes all sessions in PostgreSQL even if SessionStore cleanup is missed.
- [ ] T062 [P] [US2] Create `apps/api/tests/test_auth_routes.py` — api contract tests: all auth endpoint response shapes match `contracts/auth.md`; session cookie attributes are correct (`HttpOnly; Secure; SameSite=Lax`); sign-out clears cookie; sign-out-all terminates all sessions; Google callback redirects to `/` without `shellMode` query param; shell contract `GET /api/v1/shell` returns session-aware `shellMode`; all endpoints complete within NFR-004 timing bounds (500 ms valid, 5 s worst case); all auth events are logged with structured fields and zero sensitive data (NFR-004, NFR-005, NFR-007).
  - **Partially satisfied — do not mark complete.** The declared file exists at `apps/api/tests/test_auth_routes.py` with 18 passing tests covering response shapes, cookie attributes, sign-out/sign-out-all, and the security assertions. **Not yet covered:** the Google callback contract (`T025`), session-aware `shellMode` contract (**T050/T054**, a different task), NFR-004 timing assertions, and structured auth-event logging.
- [ ] T063 [P] [US4] Create `apps/api/tests/test_session_expiration.py` — unit tests: session expires after lifetime; sliding refresh extends expiry on activity; expired session causes shell to return `public`; revoked session is rejected immediately by PostgreSQL on every request; revoked session cannot be revived by SessionStore cache staleness (stale cache hit is never sufficient for authorization).

### Component Tests

- [ ] T064 [P] [US1] Create `apps/web/tests/unit/AuthProvider.test.tsx` — component tests: initial state is `isAuthenticated: false`, `role: null`; after sign-in, `isAuthenticated: true`, `role: "user"`; after sign-out, returns to public state; after session expiry, transitions to public; organization reference is carried in context but not rendered in UI.
  - **Path corrected:** the declared path was `apps/web/tests/component/AuthProvider.test.tsx`; the file actually lives at `apps/web/tests/unit/AuthProvider.test.tsx` (11 tests, collected by the existing `tests/**` include and passing in the 221-test web suite). Vitest collects both directories, so no runner change is needed — only this correction.
  - **Remaining criteria not yet covered:** the session-expiry-to-public transition, and an explicit assertion that the organization reference is carried in context but **not rendered** in any UI element. Do not mark this task complete until both are added.
- [ ] T065 [P] [US3] Create `apps/web/tests/component/AuthorizationGuard.test.tsx` — component tests: user-role account cannot access admin route (redirects to sign-in with generic message); admin-role account can access admin route; role change mid-session is enforced on next request.
- [x] T066 [P] [US2] Create `apps/web/tests/component/GoogleCallbackPage.test.tsx` — component tests: successful callback transitions to authenticated shell; interrupted flow (no code) shows generic error and redirects to sign-in; no provider tokens are stored in browser.
  - **Verified complete**: the file exists at the declared path with 8 passing tests covering every listed criterion (success redirect to `/` on the cookie-backed shell, missing-code and failure redirect to `/sign-in`, empty storage and cookie), plus no-leak and loading coverage.

### E2E Tests

- [ ] T067 [P] [US1] Create `apps/web/tests/e2e/auth-registration.spec.ts` — E2E tests for V-01 (email/password registration + sign-in with optional invite token), V-02 (phone/OTP registration), V-03 (Google OAuth sign-in with mock provider). Each test verifies shell transition to authenticated mode and back to public on sign-out. OTP codes obtained from test fixture, never from logs (SC-001, SC-002).
- [ ] T068 [P] [US2] Create `apps/web/tests/e2e/auth-session.spec.ts` — E2E tests for V-04 (account enumeration protection — identical error for unknown email and wrong password), V-05 (rate limiting — blocks after threshold, unblocks after window), V-06 (session expiration and revocation — expired session redirects to sign-in; logout-all terminates all sessions), V-10 (R01 shell contract preservation — `GET /api/v1/shell` shape unchanged, session cookie attributes verified via DevTools).
- [ ] T069 [P] [US3] Create `apps/web/tests/e2e/auth-authorization.spec.ts` — E2E tests for V-07 (role-based authorization — user cannot access admin routes, admin can; role change enforced on next request).
- [ ] T070 [P] [US4] Create `apps/web/tests/e2e/auth-captcha.spec.ts` — E2E tests for V-08 (CAPTCHA enforcement — registration without CAPTCHA rejected; registration with valid CAPTCHA succeeds; adaptive CAPTCHA challenge on sign-in after threshold; CAPTCHA failure produces clear message).
- [ ] T071 [P] [US6] Create `apps/web/tests/e2e/auth-errors.spec.ts` — E2E tests for V-09 (provider failure resilience — Google provider down, email/phone still work; OTP provider down, email/Google still work), V-11 (accessibility and localization — fa/ar/en RTL/LTR rendering, keyboard navigation, 200% zoom).

### Project Validation Gates

- [ ] T072 Create `apps/api/tests/conftest.py` — pytest fixtures: `mock_otp_provider` (test fixture registry for OTP codes, cleared per test), `mock_captcha_provider` (test fixture for valid/invalid CAPTCHA tokens), `mock_google_provider` (test fixture for OAuth flow), `test_database` (SQLite in-memory database with migrations applied), `test_session_store` (in-memory session store), `client` (FastAPI test client with auth middleware).
- [ ] T073 [P] Run `python -m compileall apps/api` — constitution Principle V Python compilation gate. Must pass with zero errors.
- [ ] T074 [P] Run `pnpm --filter @mahak/web test --run` — all Vitest unit and component tests must pass; covers all registration, sign-in, authorization, CAPTCHA, organization, error, and shell-integration scenarios with external providers mocked (NFR-005, SC-011).
- [ ] T075 [P] Run `pnpm --filter @mahak/web exec playwright test --project=desktop-chromium` — all Playwright E2E tests must pass.
- [ ] T076 [P] Run `.\.venv\Scripts\python.exe -m pytest apps/api/tests/ -v` — all pytest api contract and unit tests must pass; covers all auth endpoints, session lifecycle, rate limiting, captcha, OTP, and security assertions with mocked providers (NFR-005, SC-011).
- [ ] T077 [P] Run `pnpm --filter @mahak/web exec playwright test --project=desktop-chromium --grep "V-0[1-9]|V-1[01]"` — execute all quickstart validation scenarios (V-01 through V-11) as a regression gate.
- [ ] T078 [P] Run secret exposure scan: `python scripts/scan_secrets.py` (or equivalent — implemented as T059) — must find zero leaks.

**Checkpoint**: All 48 FRs and 10 NFRs are covered by automated tests. All test suites pass deterministically with mocked providers. `python -m compileall apps/api` passes. All 12 Success Criteria are validated by at least one test.

---

## Phase 12: Quickstart and Final Validation

**Purpose**: End-to-end validation against the quickstart scenarios and final traceability check.

- [ ] T079 Run all quickstart validation scenarios from `quickstart.md` (V-01 through V-11) and record results. Each scenario must pass with the mock provider configuration.
- [ ] T080 [P] Verify all 48 FRs and 10 NFRs are traceable to at least one task in this file. No requirement is orphaned.
- [ ] T081 [P] Verify all 12 Success Criteria (SC-001 through SC-012) have at least one validating task.
- [ ] T082 [P] Verify all four clarified decisions (Q1–Q4) are represented in tasks: Q1 (configurable session lifetime + sliding refresh — T004, T026, T061, T063), Q2 (Google identity linking — T016, T025, T060), Q3 (email + phone on same account — T007, T016, T024, T060), Q4 (opaque invite token with server-side validation at identity boundary only — T016, T042, T044, T045, T060).
- [ ] T083 Verify no `[NEEDS CLARIFICATION]` markers remain in any R02 artifact. Verify no template placeholders remain.
- [ ] T084 [P] Verify no later-roadmap-feature business logic is present: no billing, no chat, no projects, no Teacher, no knowledge pipeline, no admin console beyond role-gating, no model gateway. Reserved module destinations show the unavailable state (R01 behavior preserved).

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies. All tasks are `[P]` and can run in parallel.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion. All tasks are `[P]` and can run in parallel.
- **Phase 3+ (User Stories)**: All depend on Phase 2 completion. Stories can proceed in parallel once Phase 2 is done.
- **Phase 10 (UX/Security)**: Depends on Phases 3–9 completion (needs pages and services to exist). Tasks within are `[P]`.
- **Phase 11 (Tests)**: Depends on Phases 3–10 completion (needs implementation to test). Within-phase tasks are `[P]`.
- **Phase 12 (Quickstart)**: Depends on Phase 11 completion.

### User Story Dependencies

- **US1 (Registration)**: Depends on Phase 2 (models + session store + config). Independent from US2–US7 once Phase 2 is complete **except T022 and T023**, which require T028 (US2) because their task text names `SignInPage`.
- **US2 (Sign-in/Sessions)**: Depends on Phase 2 and US1 (needs auth_service foundation). Parallelizable with US3 once Phase 2 is done.
- **US3 (Authorization)**: Depends on Phase 2 (User model). Parallelizable with US1, US2 once Phase 2 is complete.
- **US4 (CAPTCHA/Abuse)**: Depends on Phase 2 (rate_limiter). Parallelizable with US1–US3 once Phase 2 is complete.
- **US5 (Organization)**: Depends on Phase 2 (User model). Parallelizable with US1–US4 once Phase 2 is complete.
- **US6 (Error States)**: Depends on Phases 3–5 (needs auth flows to produce errors). Parallelizable with US7 once earlier phases are done.
- **US7 (R01 Shell Integration)**: Depends on Phases 2–6 (needs session store and shell contract). Must complete before Phase 10 UX tests.

### Governance — `organizationReference` in API responses (BLOCKING, not yet decided)

`data-model.md` (line 177) states the organization reference "is carried into the session context but is **NOT exposed in any api response**", while `spec.md` FR-032 says it "MUST be available in the session context for downstream features to read" and `contracts/authorization.md` declares `organizationReference` on `AuthContextValue`. The current `AuthProvider` implementation already returns it from the api via `AuthService.me()`.

**Until this is decided, no `/api/v1/auth/me` contract may be written and no task may be created for it.** Proposed owner (task **T085**, not added to this file yet): declare the route and response schema in `contracts/auth.md` first, then implement the route, the Pydantic schema, authorization, and the T062 conformance tests. Option A (permit the field with explicit authorization and privacy constraints) and Option B (omit it and derive the client requirement another way) are both viable; the implications of each are in the planning reconciliation report.

### Parallel Opportunities

- All Phase 1 `[P]` tasks (T001–T006) run in parallel.
- All Phase 2 `[P]` tasks (T007–T013) run in parallel.
- All Phase 3 `[P]` tasks (T014–T023) run in parallel within the phase, **except T022**, which now has a cross-story dependency on T028.
- All Phase 4 `[P]` tasks (T024–T031) run in parallel within the phase.
- All Phase 5 `[P]` tasks (T032–T036) run in parallel within the phase.
- US1, US2, US3, US4, US5 can be implemented in parallel after Phase 2.
- All Phase 10 `[P]` tasks (T055–T059) run in parallel.
- All Phase 11 `[P]` test tasks (T060–T078) run in parallel.
- All Phase 12 `[P]` tasks (T080–T084) run in parallel.

### Recorded Runtime Dependencies (must clear before the affected checkpoints pass)

- **T019 → T037** — `SignUpPage.tsx` already calls `GET /api/v1/auth/captcha/challenge`, which does not exist yet. Phase 3's checkpoint is blocked until T037 lands.
- **T021 → proposed T085 (governance-gated)** — `AuthProvider.tsx` already calls `GET /api/v1/auth/me`, which is neither declared in `contracts/auth.md` nor implemented. Blocked pending the `organizationReference` decision above.
- **T028 → T086** — `SignInPage` requires a mounted `AuthProvider`; at runtime it is currently dead code.
- **T036 → T086** — role-aware route guards require a mounted `AuthProvider`.
- **T028 → T030** — T028's acceptance criteria cannot be verified without its required companion test.

### Within Each User Story

- Tests (where marked) are written alongside or before implementation.
- Models before services before routes before web client integration.
- Story complete before moving to the next priority.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundation (T001–T006)
2. Complete Phase 2: Foundational models and session infrastructure (T007–T013)
3. Complete Phase 3: User Story 1 — registration via all three methods (T014–T023)
4. **STOP and VALIDATE**: Run V-01 (email/password), V-02 (phone/OTP), V-03 (Google) from quickstart.md independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Phase 1 + Phase 2 → Foundation ready
2. Add US1 (Registration) → Test V-01/V-02/V-03 → Deploy/Demo (MVP!)
3. Add US2 (Sign-in/Sessions) → Test V-04/V-05/V-06 → Deploy/Demo
4. Add US3 (Authorization) → Test V-07 → Deploy/Demo
5. Add US4 (CAPTCHA/Abuse) → Test V-08 → Deploy/Demo
6. Add US5 (Organization) → Test V-02 extended → Deploy/Demo
7. Add US6 (Error States) → Test V-09 → Deploy/Demo
8. Add US7 (Shell Integration) → Test V-10/V-11 → Deploy/Demo
9. Complete Phase 10 + Phase 11 + Phase 12 → Full validation

### Parallel Team Strategy

With multiple developers:
1. Team completes Phase 1 + Phase 2 together
2. Once Phase 2 is done:
   - Developer A: US1 (Registration)
   - Developer B: US2 (Sign-in/Sessions)
   - Developer C: US3 (Authorization)
   - Developer D: US4 (CAPTCHA/Abuse)
   - Developer E: US5 (Organization)
3. After US1–US5 complete: US6 (Errors) and US7 (Shell Integration) in parallel
4. Phase 10 (UX/Security) and Phase 11 (Tests) in parallel
5. Phase 12 (Quickstart) last

---

## Notes

- `[P]` tasks = different files, no dependencies within the phase **and no dependency on tasks in later phases**
- `[Story]` label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD where applicable)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No tasks implement password reset, account deletion, 2FA, additional social providers, device management, full organization management, multi-tenant routing, org-scoped authorization, Admin Control Center, AI Copilot, Chat, Projects, Files, Knowledge/RAG, Voice, Memory, Billing, or AI Model Gateway
- No `[NEEDS CLARIFICATION]` markers remain
- No template placeholders remain
