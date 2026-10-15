# Implementation Plan: R02 — Identity, Authentication & Authorization

**Branch**: `002-identity-auth` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-identity-auth/spec.md`

## Summary

R02 establishes the identity, authentication, and authorization foundation for MAHAK. It adds server-side account registration (email/password with CAPTCHA, phone/OTP, Google OAuth 2.0), stateful session management with configurable lifetime and sliding refresh, role-based authorization (user/admin, extensible), rate limiting, CAPTCHA, and organization-ready identity boundaries — all while preserving the R01 shell contract (`ShellMode` values, `GET /api/v1/shell` schema, navigation semantics) intact. The shell's `ShellModeProvider` transitions from R01's public-default resolution to session-aware resolution without any contract change.

Technical approach (from Phase 0 research): extend the existing pnpm workspace monorepo (`apps/api` FastAPI + Python 3.12, `apps/web` React 19 + Vite 7, `packages/contracts` TypeScript). Introduce SQLAlchemy 2.x async with Alembic migrations in `apps/api`. Authentication providers (CAPTCHA, Google OAuth, OTP delivery) are abstracted behind interfaces with mock implementations for deterministic tests. **PostgreSQL is the authoritative session store**; an in-memory dict (dev/test) or Redis `SessionStore` provides active-token cache with explicit consistency rules that guarantee revocation cannot be bypassed by stale cache data. The web client consumes the existing `GET /api/v1/shell` endpoint; R02 makes the api resolve `shellMode` from the active session cookie rather than a hardcoded default. Google OAuth redirects to the application root — no `shellMode` query parameter is used in production.

## Technical Context

**Language/Version**: TypeScript 5.x (web + contracts), Python 3.12 (api)

**Primary Dependencies**: React 19, Vite 7, React Router 7, pnpm 10 workspace; FastAPI + Uvicorn (api); SQLAlchemy 2.x (async) + Alembic (migrations); bcrypt; httpx (api tests); Vitest, React Testing Library, jest-axe, Playwright (testing).

**Storage**: PostgreSQL is the **authoritative source** for session validity (revoked_at, expires_at), user identity, and social identity linkage. Three tables: `users`, `sessions`, `social_identities`. Active session-token lookup: in-memory dict (dev/test) or Redis (production) via `SessionStore` interface, used **only as a fast token-to-user lookup cache** — a cache hit is never sufficient to authorize a request. Every authenticated request queries PostgreSQL directly. No ORM business logic — pure persistence layer.

**Testing**: Vitest (unit + component), React Testing Library (behavioral), Playwright (viewport/RTL/theme/a11y E2E), jest-axe (automated accessibility), pytest + FastAPI test client (api contract). External providers (Google, CAPTCHA, OTP) are mocked in all automated tests (NFR-005).

**Target Platform**: Modern desktop and mobile browsers (current and previous major version); local development on Windows/Linux/macOS; production on Linux servers.

**Project Type**: Web application (monorepo: web client + api + shared contracts), adding authentication and authorization capabilities.

**Performance Goals**: Authentication endpoints respond within 500 ms for valid requests under normal load; rate-limited or CAPTCHA-challenged requests complete within 5 seconds (NFR-004). Shell transitions between public/authenticated modes complete without page reload (FR-045).

**Constraints**: No credentials, secrets, or tokens in the browser (NFR-006); no account enumeration (FR-005, FR-013); provider credentials remain server-side (NFR-003); the R01 shell contract (`GET /api/v1/shell` path, response schema, `ShellMode` values) remains unchanged (FR-033, FR-034); authentication pages support Persian/Arabic/English with RTL/LTR and 200% zoom (NFR-008, NFR-009).

**Scale/Scope**: 1 web application shell, 3 auth methods (email/password, phone/OTP, Google), 2 roles (`user`, `admin`), 5 shell regions/states extended with auth context, ~20 new api routes, ~15 new web client components/pages/providers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / how the plan satisfies it |
|-----------|--------|--------------------------------------|
| **I. Product Integrity & Architectural Discipline** | **PASS** | R02 respects the layer separation: `apps/api` owns authentication/session/authorization logic; `apps/web` owns shell integration via the existing `ShellModeProvider` seam; `packages/contracts` carries no runtime auth logic (only `Role` type and `ShellMode` type extensions if needed). No cross-layer shortcuts — the web client never imports from a Python module. Domain separation is structural: the `AuthorizationPolicy` protocol keeps auth policy separate from feature business logic (FR-053, FR-054). |
| **I. Core domains independently evolvable** | **PASS** | The `User`, `Session`, and `SocialIdentityLink` entities are owned by `apps/api`. Later features (R05 chat, R27 admin) bind to the `shellMode` contract and the `role` field without modifying R02's auth implementation. The `AuthorizationPolicy` protocol is extensible (FR-025). |
| **I. Web-first and API-first** | **PASS** | R02 is a web application auth layer consuming the existing API boundary. The `GET /api/v1/shell` endpoint remains the single shell-mode seam; all auth routes are under `/api/v1/auth/...`. Future mobile clients can reuse the same api routes. |
| **II. AI, Knowledge & Evidence Integrity** | **N/A in R02** | R02 performs no AI calls, no retrieval, and no knowledge handling. Reserved module identities are inert (R01). |
| **III. Modularity, Provider Agnosticism** | **PASS** | CAPTCHA, Google OAuth, and OTP delivery are abstracted behind interfaces (`CaptchaProvider`, `GoogleAuthProvider`, `OtpDeliveryProvider`). Each provider is swappable via environment variable without changing the auth flow. No provider SDK is hard-coded into the shell or contracts (Principle III). |
| **IV. Security, Privacy & Operational Safety** | **PASS** | Passwords are hashed with bcrypt (NFR-001). Session tokens are 256-bit cryptographically random (NFR-002). Provider credentials remain server-side (NFR-003). No account enumeration — uniform error messages (FR-005, FR-013). Rate limiting protects against brute-force and credential stuffing (FR-018, FR-019). Security events are logged without sensitive data (NFR-007). Admin actions are role-gated (FR-022–FR-024). |
| **V. Test-Backed Development** | **PASS** | Every planned unit carries test coverage: unit (pytest + Vitest), component (RTL + jest-axe), E2E (Playwright), api contract (pytest). All external providers are mocked for deterministic tests (NFR-005). Python `compileall` gate is included. |
| **V. Python `compileall` validation** | **PASS (trivially)** | R02 extends `apps/api` with new Python modules; `python -m compileall apps/api` is included in the validation command set and will pass once the modules exist. |
| **V. Observability** | **PASS (auth-level)** | Security-relevant events (sign-in success/failure, session create/terminate, account create, rate-limit trigger) are logged through the api logger with structured fields and no secret data (NFR-007). Shell-level observability continues via the existing browser logger. |
| **Security & Cross-Platform Constraints** | **PASS** | Desktop/tablet/mobile breakpoints, Persian/Arabic RTL + English LTR, Light/Dark/System themes, and accessibility requirements are all first-class plan components. Auth pages inherit the R01 theme and direction system. |
| **Development Workflow & Quality Gates** | **PASS** | This plan is produced from the approved spec + clarifications; tasks will be traceable to FR/NFR ids (see Traceability). Failures are fixed at source; no test weakening is permitted. |

**Gate result: PASS — no violations, no Complexity Tracking entries required.**
The Constitution Check is re-evaluated after Phase 1 design at the end of this plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-identity-auth/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── auth.md
│   └── authorization.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── web/                          # User Experience layer (extends R01)
│   ├── src/
│   │   ├── App.tsx                    # (extended: T086 — mounts AuthProvider inside ShellModeProvider)
│   │   ├── shell/
│   │   │   ├── AppShell.tsx          # (unchanged from R01)
│   │   │   ├── regions/
│   │   │   │   ├── HeaderRegion.tsx      # (extended: sign-in/sign-up wired to auth flows)
│   │   │   └── navigation/
│   │   │       ├── NavigationRegistry.tsx # (unchanged — destinations stay authenticated-scoped)
│   │   ├── providers/
│   │   │   ├── ShellModeProvider.tsx     # (extended: session-aware mode resolution)
│   │   │   ├── ShellPreferences.ts       # (unchanged — shell prefs stay in localStorage)
│   │   │   └── AuthProvider.tsx          # (NEW — auth context: isAuthenticated, role, orgRef)
│   │   ├── pages/
│   │   │   ├── SignInPage.tsx            # (NEW — sign-in form: email/password, phone/OTP, Google)
│   │   │   ├── SignUpPage.tsx            # (NEW — sign-up form: email/password with CAPTCHA, phone/OTP)
│   │   │   └── GoogleCallbackPage.tsx    # (NEW — Google OAuth callback handler)
│   │   ├── services/
│   │   │   ├── AuthService.ts            # (NEW — auth api client: register, signIn, signOut, etc.)
│   │   │   └── ShellApiClient.ts         # (extends R01: adds session-aware shellMode fetch)
│   │   ├── i18n/
│   │   │   ├── fa.json                   # (extended: auth-specific strings)
│   │   │   ├── ar.json                   # (extended: auth-specific strings)
│   │   │   └── en.json                   # (extended: auth-specific strings)
│   │   └── router/
│   │       └── index.tsx                 # (extended: add /sign-in, /sign-up, /google-callback routes)
│   ├── tests/
│   │   ├── unit/                       # (extends: AuthProvider, AuthService unit tests)
│   │   ├── component/                  # (extends: SignInPage, SignUpPage, AuthProvider component tests)
│   │   └── e2e/                        # (extends: auth flow E2E tests)
│   └── package.json
│
└── api/                           # Application/API layer (extends R01)
    ├── src/mahak_api/
    │   ├── main.py                     # (extended: mount auth routers)
    │   ├── routes/
    │   │   ├── shell.py                # (extended: session-aware shellMode resolution)
    │   │   ├── auth.py                 # (NEW — registration, sign-in, sign-out routes)
    │   │   ├── google.py               # (NEW — Google OAuth flow routes)
    │   │   └── captcha.py              # (NEW — CAPTCHA challenge endpoint)
    │   ├── contracts/
    │   │   └── shell.py                # (extended: add session-related constants)
    │   ├── services/
    │   │   ├── auth_service.py         # (NEW — registration, sign-in, session management)
    │   │   ├── session_store.py        # (NEW — abstract session store interface + in-memory impl)
    │   │   ├── rate_limiter.py         # (NEW — per-IP and per-account rate limiting)
    │   │   ├── captcha_service.py      # (NEW — CAPTCHA provider interface + mock impl)
    │   │   ├── otp_service.py          # (NEW — OTP generation, delivery interface, mock impl)
    │   │   └── google_auth_service.py  # (NEW — Google OAuth 2.0 + PKCE flow)
    │   ├── models/
    │   │   ├── user.py                 # (NEW — SQLAlchemy User model)
    │   │   ├── session.py              # (NEW — SQLAlchemy Session model)
    │   │   └── social_identity.py      # (NEW — SQLAlchemy SocialIdentityLink model)
    │   └── contracts/
    │       └── auth.py                 # (NEW — auth request/response schemas)
    ├── tests/
    │   ├── test_auth_routes.py         # (NEW — auth endpoint contract tests)
    │   ├── test_session_store.py       # (NEW — session store unit tests)
    │   ├── test_rate_limiter.py        # (NEW — rate limiter unit tests)
    │   ├── test_captcha_service.py     # (NEW — captcha service unit tests)
    │   └── test_otp_service.py         # (NEW — OTP service unit tests)
    ├── pyproject.toml
    └── README.md
│
packages/
└── contracts/                      # shared contract definitions (extends R01)
    ├── src/
    │   ├── shell-mode.ts               # (extended: add AuthContext type)
    │   ├── navigation.ts               # (unchanged)
    │   ├── viewport.ts                 # (unchanged)
    │   ├── theme.ts                    # (unchanged)
    │   ├── direction.ts                # (unchanged)
    │   └── feature-availability.ts     # (unchanged)
    └── package.json
│
alembic/                            # (NEW — database migrations)
├── versions/
│   └── 001_initial_auth_schema.py    # (NEW — users, sessions, social_identities tables)
└── env.py
```

**Structure Decision**: Extend the existing R01 monorepo structure. `apps/api` gains new routes, services, and models. `apps/web` gains new pages, providers, and services. `packages/contracts` gains an `AuthContext` type extension. No new top-level workspace units are created — R02 stays within `apps/api`, `apps/web`, and `packages/contracts`.

## Complexity Tracking

> No Constitution Check violations require justification. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Architecture Overview

### Layered view

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Browser client — apps/web  (User Experience layer)                  │
│                                                                      │
│  AppShell (R01, unchanged)                                           │
│    │                                                                 │
│    ├── providers:                                                      │
│    │   ├── ThemeProvider              (R01, unchanged)               │
│    │   ├── DirectionProvider          (R01, unchanged)               │
│    │   ├── ViewportClassProvider      (R01, unchanged)               │
│    │   ├── ShellModeProvider          (R01 extended: session-aware)  │
│    │   └── AuthProvider               (NEW: isAuthenticated, role)  │
│    ├── pages:                                                        │
│    │   ├── SignInPage                 (NEW)                          │
│    │   ├── SignUpPage                 (NEW)                          │
│    │   └── GoogleCallbackPage         (NEW)                          │
│    ├── services:                                                     │
│    │   ├── AuthService                (NEW — auth api client)        │
│    │   └── ShellApiClient             (R01 extended)                 │
│    └── i18n resources extended        (fa/ar/en auth strings)        │
│                                                                      │
└───────────────┬──────────────────────────────────────────────────────┘
                │  HTTP (versioned JSON, no credentials in browser)
                │  no provider secrets, no module data, no AI calls
┌───────────────▼──────────────────────────────────────────────────────┐
│  apps/api — Application/API layer (Python/FastAPI, extends R01)      │
│                                                                      │
│  /api/v1/shell   →  session-aware shellMode resolution               │
│  /api/v1/auth/register/email    →  email/password registration       │
│  /api/v1/auth/register/phone    →  initiate phone OTP registration   │
│  /api/v1/auth/register/phone/verify → complete phone OTP registration │
│  /api/v1/auth/sign-in/email     →  email/password sign-in            │
│  /api/v1/auth/sign-in/phone     →  initiate phone OTP sign-in        │
│  /api/v1/auth/sign-in/phone/verify  → complete phone OTP sign-in     │
│  /api/v1/auth/sign-in/google    →  begin Google OAuth flow           │
│  /api/v1/auth/google/callback   →  complete Google OAuth flow        │
│  /api/v1/auth/sign-out          →  terminate current session          │
│  /api/v1/auth/sign-out-all      →  terminate all sessions            │
│  /api/v1/auth/captcha/challenge →  get CAPTCHA challenge HTML         │
│                                                                      │
│  Services: auth_service, session_store, rate_limiter,                │
│            captcha_service, otp_service, google_auth_service         │
│  Models: User, Session, SocialIdentityLink                           │
│  Migrations: Alembic (users, sessions, social_identities tables)     │
│                                                                      │
└───────────────┬──────────────────────────────────────────────────────┘
                │  imports the contract definitions
┌───────────────▼──────────────────────────────────────────────────────┐
│  packages/contracts — shared contract seam (extends R01)             │
│  ShellMode · Role · AuthContext · (existing types unchanged)         │
└──────────────────────────────────────────────────────────────────────┘
```

### Boundary rules

1. `apps/web` MUST NOT import from `apps/api`; it consumes auth routes through the `AuthService` client (FR-055).
2. `apps/web` MUST NOT contain authentication business logic; auth state is owned by the `AuthProvider` which consumes the api (FR-053, FR-054).
3. `packages/contracts` MUST remain free of business logic; it carries only `Role`, `AuthContext`, and any shared type extensions (FR-053, FR-056, FR-057).
4. `apps/api` MUST NOT render UI and MUST NOT return secrets; auth responses carry only `shellMode` and generic messages (NFR-006).
5. Provider credentials (Google Client Secret, CAPTCHA site secret, OTP provider keys) MUST remain server-side in environment variables; they MUST NEVER appear in any api response or client asset (NFR-003).
6. The `GET /api/v1/shell` endpoint path and response schema MUST remain unchanged from R01 (FR-033, FR-034).
7. No layer MAY depend on a specific AI provider, model, or vendor (spec non-requirements; constitution Principle III).

## Component / Module Boundaries

| Planned unit | Layer | Owns | Must not do | Traces to |
|--------------|-------|------|-------------|-----------|
| `ShellModeProvider` (extended) | web | session-aware mode resolution; subscribes to auth events | must not implement authentication logic | FR-033, FR-034, FR-037 |
| `AuthProvider` | web | auth context (isAuthenticated, role, organizationReference); subscribes to shell-mode changes | must not hold credential logic; must not implement auth flows | FR-027, FR-032 |
| `SignInPage` | web | sign-in form (email/password, phone/OTP, Google); handles error states | must not contain business logic; delegates to `AuthService` | FR-008, FR-013, FR-038 |
| `SignUpPage` | web | sign-up form (email/password with CAPTCHA, phone/OTP); handles error states | must not contain business logic; delegates to `AuthService` | FR-001, FR-002, FR-005 |
| `GoogleCallbackPage` | web | handles Google OAuth callback redirect; navigates to shell after auth | must not expose provider tokens; must not handle token exchange | FR-004, FR-015, FR-042 |
| `AuthService` | web | auth api client: register, sign-in, sign-out, sign-out-all, captcha challenge | must not store credentials; must not implement provider logic | FR-001–FR-015 |
| `auth_service.py` | api | registration, sign-in, session lifecycle, role enforcement | must not render UI; must not expose provider secrets | FR-001–FR-015, FR-022–FR-028 |
| `session_store.py` | api | abstract session storage (in-memory / Redis); create, read, expire, revoke sessions | must not store password hashes; must not leak session tokens | FR-009, FR-011, FR-012 |
| `rate_limiter.py` | api | per-IP and per-account rate limiting with sliding windows | must not reveal account existence; must not block legitimate users indefinitely | FR-017, FR-018, FR-019, FR-020 |
| `captcha_service.py` | api | CAPTCHA provider interface; challenge generation and verification | must not expose CAPTCHA secret; must not fail open on provider error | FR-016, FR-043 |
| `otp_service.py` | api | OTP generation, delivery interface, expiration, single-use enforcement; OTP codes are NEVER logged by production code (NFR-007) | must not log OTP codes; must not persist OTP codes long-term; must not expose codes in any log or response | FR-003, FR-040, FR-041 |
| `google_auth_service.py` | api | Google OAuth 2.0 + PKCE flow; token exchange; identity linking; establishes server session and sets `mahak_session` cookie; redirects to app root (no `shellMode` query param in production) | must not expose Client Secret; must not create duplicate accounts; must not use `shellMode` query param for production redirect | FR-004, FR-015, FR-042 |
| `User` model | api | persistent user identity (email, phone, passwordHash, role, orgRef) | must not store plaintext passwords; must not expose passwordHash in responses | FR-022, NFR-001 |
| `Session` model | api | persistent session record (userId, expiresAt, revokedAt) | must not store session tokens in plaintext; must enforce revocation | FR-009, FR-011, FR-012 |
| `SocialIdentityLink` model | api | persistent social identity linkage (userId, provider, providerSubjectId) | must not store provider tokens; must enforce uniqueness | FR-004, Q2 |
| `auth.py` route | api | `/api/v1/auth/register/*`, `/api/v1/auth/sign-in/*`, `/api/v1/auth/sign-out` | must not return secrets or provider errors | FR-001–FR-015, FR-038–FR-048 |
| `google.py` route | api | `/api/v1/auth/sign-in/google`, `/api/v1/auth/google/callback` | must not expose Client Secret; must not leak provider errors | FR-004, FR-042 |
| `captcha.py` route | api | `/api/v1/auth/captcha/challenge` | must not expose CAPTCHA secret | FR-016, FR-043 |
| `ShellModeProvider` (web extended) | web | session-aware `shellMode` resolution via cookie + `/api/v1/shell` | must not hardcode `authenticated`; must fallback to `public` on session loss | FR-033, FR-034 |
| `packages/contracts` (extended) | contracts | `Role` type, `AuthContext` type extension | must not contain runtime auth logic | FR-022, FR-025 |
| `Logger` (api extended) | api | security event logging (no sensitive fields) | must not log passwords, tokens, OTP codes, or provider secrets | NFR-007 |

## Deferred Decision Resolution

Per the spec, two decisions were reserved for this plan. Both are resolved here without expanding R02 scope.

### D-01 — Database engine for development vs. production

**Decision**: SQLite with `aiosqlite` for development and test; PostgreSQL with `asyncpg` for production. The connection string is selected via the `MAHAK_DATABASE_URL` environment variable. SQLAlchemy 2.x async engine handles both. Alembic migrations are shared between both engines.

**Rationale**: This matches the project's existing R01 pattern (minimal local dev setup) while supporting production-grade PostgreSQL. The abstraction layer means the web client and api contracts are database-agnostic.

**Spec consistency**: Consistent with NFR-005 (deterministic tests) and the constitution's requirement for reliable storage (Principle I).

### D-02 — Session store vs. authoritative database

**Decision**: PostgreSQL is the **authoritative source of truth** for session validity (revoked_at, expires_at). An in-memory dict (dev/test) or Redis (production) `SessionStore` interface provides fast token-to-user_id lookup. **Critical rule: every authenticated request MUST query PostgreSQL directly to verify `revoked_at IS NULL AND NOW() < expires_at`; a SessionStore cache hit is never sufficient to authorize a request.** This eliminates the stale-cache-bypass risk entirely — even if SessionStore contains a revoked session, PostgreSQL will reject it on every request. Logout-all updates PostgreSQL directly; SessionStore cleanup is best-effort.

**Rationale**: Pure in-memory or pure-Redis sessions lose revocation state on restart. Pure-PostgreSQL sessions hit the database on every request. The hybrid approach gives performance (fast cache lookup for token→user_id) with security (PostgreSQL authoritative auth decision on every request). The explicit rule — "cache hit ≠ authorization" — makes the safety guarantee testable and verifiable.

**Spec consistency**: Consistent with FR-011, FR-012 (session expiration/revocation are authoritative and cannot be bypassed) and NFR-005 (deterministic tests via mock cache with explicit PostgreSQL fallback assertions).

## Testing Strategy

### Levels and tooling

| Level | Tool | Covers | Traces to |
|-------|------|--------|-----------|
| Unit | pytest + Vitest | auth service, session store, rate limiter, captcha service, otp service, Google auth service, role policy | FR-008–FR-021, FR-022–FR-028, FR-038–FR-048 |
| Component | React Testing Library + jest-axe | SignInPage, SignUpPage, AuthProvider, GoogleCallbackPage, error states, keyboard navigation | FR-001–FR-007, FR-035–FR-037, FR-038–FR-048 |
| E2E | Playwright | full auth flows (register, sign-in, sign-out, Google OAuth, phone OTP), session persistence, rate limiting, CAPTCHA challenge, RTL/LTR, zoom | FR-001–FR-015, FR-022–FR-028, FR-033–FR-048, NFR-008, NFR-009, SC-001–SC-010 |
| API contract | pytest + FastAPI test client | auth route response shapes, error codes, safety rules (no secrets in responses), session-aware shellMode | FR-033, FR-034, NFR-003, NFR-006, SC-012 |
| Compilation | `python -m compileall apps/api` | constitution Principle V Python gate | NFR-005 |

### Validation suites

**Auth flow validation** — for each registration and sign-in method (email/password, phone/OTP, Google): successful flow transitions shell to authenticated mode; invalid input produces correct error; rate limit triggers after threshold; CAPTCHA is enforced where required.

**Session lifecycle validation** — session persists across reload within lifetime; expired session redirects to sign-in; revoked session redirects to sign-in; logout terminates session; logout-all terminates all sessions; concurrent sessions are independent.

**Authorization validation** — user-role account cannot access admin actions; admin-role account can; role change is enforced on next request; unauthorized access redirects to sign-in without exposing content.

**CAPTCHA validation** — registration without CAPTCHA is rejected; registration with valid CAPTCHA succeeds; adaptive CAPTCHA challenge triggers after threshold failed sign-ins; CAPTCHA failure produces clear message.

**Rate limiting validation** — per-IP rate limit blocks after threshold; per-account sign-in rate limit blocks after threshold; blocked users see rate-limit message with retry time; limit resets after window expires.

**Account enumeration protection** — sign-in with unknown email produces same error as wrong password; registration with existing email produces generic failure; rate-limited response does not indicate account existence.

**Provider failure resilience** — when Google provider is unreachable, email/password and phone/OTP sign-in remain functional; when OTP provider is unreachable, email/password and Google sign-in remain functional; service-unavailable message is shown with retry option.

**RTL/LTR validation** — auth pages render correctly in `fa`, `ar`, `en` with correct direction; form fields, labels, and buttons mirror correctly; keyboard navigation works in both directions.

**Accessibility validation** — auth forms are keyboard-operable; focus indicators are visible; skip-to-main works; error messages are announced to assistive technology; 200% zoom is supported.

### Quality gates

- All unit, component, E2E, and api contract tests pass deterministically.
- `python -m compileall apps/api` passes.
- No test may be disabled or weakened to make a failure pass (constitution, Development Workflow gates).
- External services (Google, CAPTCHA, OTP provider) are mocked; R02 has no live provider by construction (NFR-005).

## Integration Considerations

- The web client and the api share contract definitions through `packages/contracts`. R02 extends the contracts with `Role` and `AuthContext` types; existing types (`ShellMode`, `NavigationDestination`, etc.) are unchanged.
- The `ShellModeProvider` in `apps/web` is extended to consume session-aware mode from the api. The test harness `?shellMode=authenticated|public` override continues to work for deterministic testing (preserving R01 test patterns).
- The api is deliberately minimal: R02 adds auth routes under `/api/v1/auth/...` and extends `/api/v1/shell` to be session-aware. The shell endpoint path and response schema are stable (FR-033).
- The web client MUST function with the api unreachable: shell preferences, viewport class, direction, theme, and offline indication resolve locally; auth routes simply fail with a service-unavailable message (NFR-010).
- No environment secrets are required to run R02 tests. The validation commands in `quickstart.md` run without credentials (NFR-006).
- Integration with future features (R05 chat, R27 admin) is by the existing `shellMode` + `role` contract; they bind to `AuthProvider.isAuthenticated` and `AuthProvider.role` without modifying R02 auth code.
- Database migrations are managed by Alembic. R02 introduces one migration (001) creating the three tables. Future features add their own migrations.

## Traceability — Requirements to Planned Work

| Planned unit | Requirements covered |
|--------------|----------------------|
| `auth_service.py` + `User` model | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-013, FR-015, FR-029, FR-030, FR-031, FR-032, FR-038, FR-040, FR-041, FR-042, FR-047, FR-048, NFR-001, NFR-003, NFR-007 |
| `session_store.py` + `Session` model | FR-009, FR-010, FR-011, FR-012, FR-014, FR-039, FR-046, NFR-002 |
| `rate_limiter.py` | FR-017, FR-018, FR-019, FR-020, FR-021, FR-044 |
| `captcha_service.py` + `captcha.py` route | FR-016, FR-043, NFR-004 |
| `otp_service.py` | FR-003, FR-040, FR-041, NFR-007 |
| `google_auth_service.py` + `google.py` route + `SocialIdentityLink` model | FR-004, FR-015, FR-042, FR-048, Q2 |
| `shell_cookie_contract` | FR-033, FR-034, NFR-003, NFR-006 |
| `AuthProvider` (web) | FR-027, FR-032, FR-037 |
| `ShellModeProvider` (extended) | FR-033, FR-034, FR-037 |
| `SignInPage` (web) | FR-008, FR-013, FR-038, NFR-008, NFR-009 |
| `SignUpPage` (web) | FR-001, FR-002, FR-005, FR-006, FR-007, NFR-008, NFR-009 |
| `GoogleCallbackPage` (web) | FR-004, FR-015, FR-042 |
| `AuthService` (web client) | FR-001–FR-015, FR-033–FR-048 |
| `AuthorizationPolicy` + role checks | FR-022, FR-023, FR-024, FR-025, FR-026, FR-028, FR-045, FR-046 |
| Logger (api extended) | NFR-007 |
| `packages/contracts` (extended) | FR-022, FR-025, FR-053, FR-055–FR-057 |
| `apps/api` auth routes | FR-033, FR-034, NFR-003, NFR-006 |
| Test suites (unit/component/e2e/api) | NFR-005, SC-001–SC-012 |

Requirements with no dedicated unit — by design:

- **FR-035, FR-036**: Satisfied by the existing R01 `HeaderRegion` (sign-in/sign-up entry points) and `NavigationRegistry` (eight reserved destinations). R02 wires them to auth flows without changing the shell layout.
- **NFR-008, NFR-009**: Satisfied by inheriting the R01 theme, direction, and accessibility infrastructure. Auth pages use the same CSS tokens and landmark structure.
- **NFR-010**: Satisfied by the abstract provider interfaces — each provider can fail independently without affecting the others.

Uncovered requirement check: all 48 functional requirements and all 10 non-functional requirements map to at least one planned unit above.

## Constitution Check — Post-Design Re-evaluation

Re-checked against the Phase 1 design (contracts, data model, project structure):

1. **Layer separation (Principle I)** — PASS. `apps/web`, `apps/api`, and `packages/contracts` remain the three workspace units. Auth business logic lives in `apps/api/services/`; the web client consumes it through `AuthService` only. No cross-layer shortcut exists.
2. **Independent domain evolution (Principle I)** — PASS. The `User`, `Session`, and `SocialIdentityLink` models are owned by the api. Later features bind to the `shellMode` + `role` contract without touching R02 auth code. The `AuthorizationPolicy` protocol is extensible.
3. **Web-first / API-first (Principle I)** — PASS. The api holds all auth logic; the web client is the first consumer of the versioned auth routes. Future mobile clients can reuse the same api.
4. **No authentication bypass, no secret exposure (Principle IV)** — PASS. Passwords are hashed (bcrypt). Session tokens are HttpOnly cookies. Provider credentials are server-side environment variables. No credential appears in any api response or client asset. Account enumeration is prevented by uniform error messages.
5. **Test-backed development (Principle V)** — PASS. Every planned unit has an assigned test level; the Python `compileall` gate is included; tests are deterministic with mocked external providers.
6. **Accessibility, i18n, theme, responsiveness (Cross-Platform Constraints)** — PASS. Auth pages inherit R01's theme, direction, and accessibility infrastructure. RTL/LTR is verified in E2E. Keyboard navigation and 200% zoom are covered.
7. **No scope expansion** — PASS. Nothing outside the R02 spec is designed: no billing, no chat, no projects, no Teacher, no knowledge pipeline, no admin console, no model gateway. Reserved module destinations remain inert. Password reset, account deletion, and 2FA are deferred.

**Final gate result: PASS.** No deviations from MUST-level principles, so no Complexity Tracking entries and no amendment is required. The plan is ready for `/speckit.tasks`.
