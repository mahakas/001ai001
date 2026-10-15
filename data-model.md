# Data Model: R02 — Identity, Authentication & Authorization

**Branch**: `002-identity-auth` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

---

## Scope note

R02 introduces persistent identity, session, and authorization data. R01 defined no database; R02 adds the minimal schema required for authentication and role-based access. No schema is introduced for organization management, billing, or any later-feature domain.

All column names and table names use `snake_case`. Primary keys are opaque UUIDs. Foreign keys reference the `id` column of the owning table.

---

## Entities

### User

The core identity record. A user may sign in via email/password, phone/OTP, or Google OAuth; any combination is supported on a single account.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NOT NULL | Stable identifier; generated on creation |
| `email` | VARCHAR(320) | NULL | Used for email/password sign-in; unique when present |
| `phone` | VARCHAR(50) | NULL | Used for phone/OTP sign-in; unique when present |
| `password_hash` | VARCHAR(255) | NULL | bcrypt hash; absent for Google-only accounts |
| `role` | VARCHAR(20) | NOT NULL | `user` or `admin`; extends via the role model (FR-022, FR-025) |
| `organization_reference` | VARCHAR(255) | NULL | Opaque invite token; validated server-side at registration (non-empty, ≤255 chars). Invalid → null. Resolved by a future feature (FR-029). |
| `created_at` | TIMESTAMPTZ | NOT NULL | Account creation timestamp |
| `last_login_at` | TIMESTAMPTZ | NULL | Most recent successful sign-in timestamp |

**Uniqueness rules**:
- `email` is unique when non-null.
- `phone` is unique when non-null.
- A user MAY have both `email` and `phone` populated (Q3, Option B).
- A user MUST have at least one of `email`, `phone`, or a linked social identity.

**Validation rules**:
- `email` must match a standard email format when present (RFC 5322 compliant subset).
- `phone` must match E.164 format when present.
- `password_hash` length is bounded to 255 characters (bcrypt max output).
- `role` is restricted to the declared role set (`user`, `admin`, plus any extended roles added later).
- `organization_reference` is accepted as a raw string; validated server-side for non-emptiness and length (≤ 255 chars) at registration time — invalid tokens are silently discarded and the field is set to null. No resolution to organization metadata occurs in R02 (FR-029).

**State transitions**:
```text
(created) ──▶ (active)
(active) ──▶ (revoked)   [by account deletion — future feature]
```
R02 creates users in the `active` state. Revocation is handled by later features.

---

### Session

Represents an active authenticated connection for a user. Sessions are server-side stateful; the client holds only an HttpOnly cookie containing the browser-facing session token (not the internal primary key).

**Source of truth**: PostgreSQL is the **authoritative source** for session validity (revoked_at, expires_at). The SessionStore (in-memory dict in dev/test, Redis in production) is used **only as a fast token-to-user_id lookup cache**. A SessionStore cache hit is **never sufficient** to authorize an authenticated request — every request MUST query PostgreSQL to verify `revoked_at IS NULL AND NOW() < expires_at`. This guarantees that revoked or expired sessions cannot be accepted through stale cache data.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NOT NULL | Internal primary key; distinct from the browser-facing session token (see Session.token below) |
| `token` | VARCHAR(256) | NOT NULL | Browser-facing opaque session token: a cryptographically random value of at least 128 bits (256-bit recommended). Stored hashed in PostgreSQL for verification; the plaintext is sent only in the HttpOnly cookie. Never logged or returned in API responses (NFR-002). |
| `user_id` | UUID (FK → users.id) | NOT NULL | The account this session belongs to |
| `created_at` | TIMESTAMPTZ | NOT NULL | Session creation time |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Absolute expiry; sliding refresh extends this (Q1, Option C) |
| `revoked_at` | TIMESTAMPTZ | NULL | Set when the session is explicitly terminated (logout, logout-all, revocation) |
| `ip_address` | INET | NOT NULL | Client IP at session creation |

**Read/write consistency rules** — PostgreSQL is authoritative for every auth decision:
1. On **session creation**: write to PostgreSQL first, then update SessionStore (best-effort). If SessionStore write fails, the session is still valid (PostgreSQL is authoritative).
2. On **session read / every authenticated request**: query PostgreSQL directly to verify `revoked_at IS NULL AND NOW() < expires_at`. SessionStore may be consulted for a fast token→user_id lookup, but the authorization decision is ALWAYS made from PostgreSQL state. A stale cache entry (containing a revoked/expired session) is never accepted as valid.
3. On **single-session logout**: update `revoked_at` in PostgreSQL AND remove from SessionStore (best-effort). If SessionStore removal fails, the next request finds `revoked_at` set in PostgreSQL and rejects the session.
4. On **logout-all**: update `revoked_at` on all sessions for the user in PostgreSQL AND remove all session entries for that user from SessionStore (best-effort). PostgreSQL is authoritative — stale cache cannot bypass revocation.
5. On **sliding refresh**: update `expires_at` in PostgreSQL AND refresh the SessionStore entry with the new expiry (best-effort). Same divergence rule as creation.

**Rules**:
- A session is **valid** when `revoked_at IS NULL` AND `NOW() < expires_at`.
- A session is **expired** when `NOW() >= expires_at` AND `revoked_at IS NULL`.
- A session is **revoked** when `revoked_at IS NOT NULL`.
- Multiple concurrent sessions per user are permitted (edge case "Concurrent sign-in from multiple devices").
- `logout-all` sets `revoked_at` on all sessions for the user in PostgreSQL; SessionStore cleanup is best-effort.
- **Auth decision rule**: every authenticated request queries PostgreSQL for `revoked_at IS NULL AND NOW() < expires_at`. SessionStore is never the sole authority for session validity.
- `ip_address` is logged for audit but is not used for session binding (session is bound by `id` only).

**State transitions**:
```text
(created) ──▶ (valid) ──▶ (expired)    [natural expiry]
             ──▶ (revoked)              [logout / logout-all / revocation]
```

---

### SocialIdentityLink

Links a third-party identity (Google, future providers) to a User account. Enables Q2 (Option A): a Google sign-in matching an existing email/password account links rather than creating a duplicate.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `user_id` | UUID (FK → users.id) | NOT NULL | The account this identity is linked to |
| `provider` | VARCHAR(50) | NOT NULL | Provider identifier, e.g. `"google"` |
| `provider_subject_id` | VARCHAR(255) | NOT NULL | The provider's unique subject identifier for this user |

**Uniqueness rules**:
- The combination `(provider, provider_subject_id)` is unique — a given provider subject can be linked to exactly one account.
- A user MAY have multiple social identity links (future extensibility), but R02 only defines `google`.

**Rules**:
- During Google sign-in, the provider's verified email is checked against existing users first. If a match is found, the Google identity is linked to that existing account (no duplicate account created).
- If no match is found, a new user is created and the link is established.
- The provider credentials (Client ID, Client Secret) are never stored in this table.

---

### RateLimitBucket

Tracks failed authentication attempts per identifier for rate-limit enforcement. Stored in the session store (in-memory dict or Redis); not a persistent database table.

| Field | Type | Notes |
|-------|------|-------|
| `identifier` | string | The rate-limit key: IP address or account email/phone |
| `attempt_count` | integer | Number of failed attempts in the current window |
| `window_start` | timestamp | Start of the current sliding window |
| `window_end` | timestamp | End of the current sliding window (`window_start` + window duration) |

**Rules**:
- A new bucket is created on the first failed attempt from an identifier.
- Each failed attempt increments `attempt_count`.
- On a successful sign-in or registration, the bucket is cleared.
- The bucket expires automatically when `NOW() > window_end`.
- Per-IP limits apply to both sign-in and registration (FR-018, FR-019).
- Per-account limits apply to sign-in only (FR-017).
- Thresholds are configurable via environment variables (see research R-06).

---

### AuthenticationEvent

A structured log record for security-relevant events. Persisted in the api's log sink (not a database table in R02; may be persisted to a log aggregator in production).

| Field | Type | Notes |
|-------|------|-------|
| `event_id` | UUID | Unique event identifier |
| `user_id` | UUID | Nullable — null for unauthenticated events |
| `event_type` | enum | `sign_in_success`, `sign_in_failure`, `session_created`, `session_terminated`, `account_created`, `rate_limit_triggered`, `captcha_challenge` |
| `ip_address` | INET | Client IP |
| `user_agent` | VARCHAR(512) | Truncated to 512 characters |
| `timestamp` | TIMESTAMPTZ | Event timestamp |
| `details` | JSONB | Optional structured details (never contains passwords, tokens, OTP codes) |

**Rules**:
- Sensitive fields (passwords, tokens, OTP codes, provider secrets) are NEVER included in any event (NFR-007).
- `user_agent` is truncated to 512 characters to prevent log injection.
- Events are emitted synchronously on the critical path but MUST NOT block authentication if the log sink fails (fire-and-forget with error suppression).

---

## Role model

R02 defines exactly two roles with placeholder hooks for extension (FR-022, FR-025):

| Role | Description | Admin actions available |
|------|-------------|------------------------|
| `user` | Ordinary account holder | None |
| `admin` | Platform administrator | All admin actions (defined by future R27) |

**Extensibility rule**: New roles are added by extending the `role` column's allowed values and the `RolePermissions` map. The shell's route guards and the `AuthorizationPolicy` protocol consume roles generically — no shell code changes are required when a new role is added (FR-025).

---

## Organization reference boundary

The `organization_reference` field on `User` is an opaque invite token supplied at registration (Q4, Option B). In R02:

- It is accepted as a raw string from the registration URL query parameter and validated server-side (non-empty, ≤ 255 chars). Invalid tokens are silently discarded and the field is set to null.
- It is stored only when validation passes; no resolution to organization metadata occurs in R02 — no API endpoint queries it and no org-scoped authorization is implemented.
- It is carried into the session context but is NOT exposed in any api response or shell UI.
- It does NOT affect authentication, session management, or authorization in R02.
- A future feature resolves the token and binds the user to an organization (FR-031, FR-032).

---

## Relationship map

```text
User (1) ──── (N) Session          — one user has many sessions (PostgreSQL authoritative; SessionStore cache)
User (1) ──── (N) SocialIdentityLink — one user has many linked identities
User (1) ──── (1) RateLimitBucket   — per-account rate limit (keyed by email/phone, stored in SessionStore)
IP Address ─── (N) RateLimitBucket  — per-IP rate limit (keyed by IP, stored in SessionStore)
```

---

## Validation rules summary

- Exactly two roles in R02: `user`, `admin` (FR-022).
- A user MUST have at least one sign-in key (email, phone, or Google link).
- Email and phone are individually unique when present (Q3, Option B).
- The Session table has two distinct fields: `id` (UUID primary key, internal use only) and `token` (VARCHAR(256), browser-facing opaque session token, at least 128 bits of cryptographic randomness, stored hashed in PostgreSQL). The plaintext token is sent only in the HttpOnly cookie; the hash is stored for verification. Never logged or returned in API responses (NFR-002).
- PostgreSQL is the authoritative store for session metadata (expiration, revocation); SessionStore (in-memory/Redis) is a cache layer with documented consistency rules.
- Passwords are stored as bcrypt hashes; plaintext is never persisted (NFR-001).
- No credential, secret, or token appears in any api response or client-side asset (NFR-003, NFR-006).
- OTP codes are NEVER logged by production code or test fixtures (NFR-007).
- All authentication events are logged without sensitive data (NFR-007).
- The invite token is validated server-side at registration; invalid tokens are discarded. No org-management endpoint exists in R02 (FR-031).
