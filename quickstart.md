# Quickstart: R02 — Identity, Authentication & Authorization

**Branch**: `002-identity-auth` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

This guide validates R02 functionality end-to-end. It runs against a local development instance with all external providers mocked (NFR-005). No live credentials are required.

---

## Prerequisites

- Node.js 22.x, pnpm 10.x
- Python 3.12+
- A running local instance of `apps/api` (see setup below)
- A running local instance of `apps/web` (see setup below)

---

## Local Setup

```powershell
# From repo root
pnpm install

# Configure the api (env vars; defaults are test-safe)
$env:MAHAK_DATABASE_URL = "sqlite+aiosqlite:///./mahak_dev.db"
$env:MAHAK_SESSION_STORE = "memory"
$env:MAHAK_CAPTCHA_PROVIDER = "mock"
$env:MAHAK_OTP_PROVIDER = "mock"
$env:MAHAK_GOOGLE_CLIENT_ID = "mock-client-id"
$env:MAHAK_GOOGLE_CLIENT_SECRET = "mock-client-secret"

# Run migrations
.\.venv\Scripts\python.exe -m alembic upgrade head --directory apps/api/alembic

# Start api (terminal 1)
.\.venv\Scripts\python.exe -m uvicorn mahak_api.main:app --reload --port 8000

# Start web (terminal 2)
pnpm --filter @mahak/web dev
```

---

## Validation Scenarios

### V-01 — Email/password registration + sign-in

**Setup**: Open `http://localhost:5173` in a browser.

**Steps**:
1. Click **Sign up**. Complete the email/password form with a valid CAPTCHA challenge (mock provider returns success immediately). Include an optional invite token: `/sign-up?invite=test-org-token-123`.
2. Verify the shell transitions to authenticated mode: the eight reserved destinations appear in the sidebar.
3. Verify the session persists: reload the page. The shell remains in authenticated mode.
4. Sign out. Verify the shell transitions back to public mode: reserved destinations disappear, sign-in/sign-up entry points reappear.
5. Sign in with the same credentials. Verify successful sign-in.

**Expected outcomes**:
- Registration creates a new account with `role = "user"`, `organization_reference = "test-org-token-123"`.
- Authenticated shell mode persists across reload.
- Sign-out terminates the session; shell returns to public mode.
- Account exists with both email and organization reference.

**Traceability**: FR-001, FR-002, FR-006, FR-008, FR-009, FR-010, FR-029, FR-030, FR-037, SC-001, SC-002, SC-006, SC-008.

---

### V-02 — Phone/OTP registration and sign-in

**Setup**: Ensure `MAHAK_OTP_PROVIDER=mock`. The mock OTP provider exposes the generated code through a test fixture (not through logs — OTP codes are never logged in production or test).

**Steps**:
1. On the sign-up page, select **Phone/OTP**. Enter a valid E.164 phone number.
2. Retrieve the mock OTP code from the test fixture (e.g. `mock_otp.get_pending_code("+1234567890")`). Enter the code on the verify page.
3. Verify account creation and shell transition to authenticated mode.
4. Sign out, then sign in via phone/OTP using the same number and a fresh OTP (retrieved from the test fixture).

**Expected outcomes**:
- Phone is stored as a unique sign-in key alongside (or without) email.
- OTP is single-use and expires after 10 minutes.
- Phone/OTP sign-in works for both registration and sign-in.
- OTP codes never appear in any log output (NFR-007).

**Traceability**: FR-001, FR-003, FR-008, FR-040, FR-041, SC-001.

---

### V-03 — Google OAuth sign-in (mock)

**Setup**: Ensure `MAHAK_GOOGLE_PROVIDER=mock`. The mock provider accepts any authorization code and returns a verified Google identity.

**Steps**:
1. On the sign-in page, click **Sign in with Google**.
2. The api redirects through the OAuth flow; the callback completes with a mock Google identity and establishes a server session (`mahak_session` cookie is set).
3. The browser is redirected to the application root (`/`). The shell's `ShellModeProvider` calls `GET /api/v1/shell` and resolves `shellMode = "authenticated"` from the session.
4. If no account exists with that Google identity, verify a new account is created.
5. If an account already exists with the same email, verify the Google identity is linked to the existing account (no duplicate account created).
6. Verify the URL does NOT contain a `shellMode` query parameter (production flow uses session, not URL param).

**Expected outcomes**:
- First Google sign-in creates a new account.
- Subsequent Google sign-in with the same verified email links to the existing account (Q2, Option A).
- No provider credentials reach the browser.

**Traceability**: FR-004, FR-015, FR-042, FR-048, Q2.

---

### V-04 — Account enumeration protection

**Steps**:
1. Attempt to sign in with a non-existent email and any password.
2. Attempt to sign in with an existing email and a wrong password.
3. Compare the two error messages.

**Expected outcomes**:
- Both produce the same generic "sign-in failed" message.
- No indication of which field was incorrect (FR-013, FR-038).

**Traceability**: FR-005, FR-013, FR-038.

---

### V-05 — Rate limiting

**Steps**:
1. From a single IP, attempt sign-in 6 times with invalid credentials (default limit: 5 per 15 minutes).
2. On the 6th attempt, verify a rate-limit response is returned with a retry-after time.
3. Wait for the rate-limit window to expire (or set `MAHAK_SIGNIN_RATE_LIMIT_WINDOW_MIN=1` and wait 1 minute for a faster check).
4. Attempt sign-in again; verify the request is accepted.

**Expected outcomes**:
- The 6th attempt is rejected with a clear rate-limit message.
- After the window expires, the user can retry normally.
- The rate-limit response does NOT indicate whether the target account exists.

**Traceability**: FR-017, FR-018, FR-019, FR-020, FR-021, SC-004.

---

### V-06 — Session expiration and revocation

**Steps**:
1. Sign in and note the session.
2. Set the session lifetime to a short value for testing (e.g. `MAHAK_SESSION_LIFETIME_MIN=1`).
3. Wait for the session to expire.
4. Attempt an authenticated action (navigate to any destination).
5. Verify the shell transitions to public mode and redirects to sign-in with a session-expired message.
6. Sign in again, then use the **Sign out all** control.
7. Verify all sessions (including the current one) are terminated.

**Expected outcomes**:
- Expired session is detected and redirects to sign-in (FR-011, FR-039).
- Revoked session is treated as terminated immediately (FR-012).
- Logout-all terminates all concurrent sessions (FR-014).

**Traceability**: FR-011, FR-012, FR-014, FR-039, SC-002, SC-009.

---

### V-07 — Role-based authorization

**Steps**:
1. Sign in as a regular `user`-role account.
2. Navigate directly to an admin-only route (e.g. `/admin`).
3. Verify the shell presents an unauthorized-access message without exposing protected content.
4. Sign in as an `admin`-role account (seeded in test data or via database direct insert).
5. Navigate to the same route; verify the admin content is accessible.

**Expected outcomes**:
- `user` role cannot access admin routes (FR-023, FR-045, FR-046).
- `admin` role can access admin routes (FR-024).
- Unauthorized access is handled gracefully without exposing internal logic.

**Traceability**: FR-022, FR-023, FR-024, FR-028, SC-008.

---

### V-08 — CAPTCHA enforcement

**Steps**:
1. Attempt email/password registration without providing a CAPTCHA token.
2. Verify the registration is rejected with a clear "CAPTCHA required" message.
3. Attempt registration with a valid CAPTCHA token (mock returns success).
4. Verify registration succeeds.
5. Simulate repeated failed sign-ins from the same IP to trigger the adaptive CAPTCHA challenge on sign-in.
6. Complete the CAPTCHA and verify sign-in proceeds.

**Expected outcomes**:
- CAPTCHA is required on registration (FR-016).
- Adaptive CAPTCHA challenge triggers after the threshold of failed sign-ins (FR-017).
- CAPTCHA failures are handled safely without account enumeration (FR-043).

**Traceability**: FR-002, FR-016, FR-017, FR-043, SC-005.

---

### V-09 — Provider failure resilience

**Steps**:
1. Set `MAHAK_GOOGLE_PROVIDER=mock` and simulate the Google provider being unreachable by stopping the mock endpoint.
2. Attempt email/password sign-in; verify it still works.
3. Attempt phone/OTP sign-in; verify it still works.
4. Restore the mock provider; verify Google sign-in works again.

**Expected outcomes**:
- A single provider failure does NOT block other authentication methods (NFR-010).
- Service-unavailable errors are presented safely without stack traces (FR-047).

**Traceability**: FR-047, NFR-010.

---

### V-10 — R01 shell contract preservation

**Steps**:
1. Sign in to establish an authenticated session. Verify the `mahak_session` cookie is set with `HttpOnly; Secure; SameSite=Lax` attributes (inspect via browser dev tools).
2. Call `GET /api/v1/shell` with the session cookie.
3. Verify the response shape is unchanged from the R01 contract (same fields, same `ShellMode` values).
4. Sign out and call the same endpoint.
5. Verify the response returns `shellMode: "public"`.
6. Verify the response body contains no credentials, secrets, tokens, or password hashes.
7. Verify the `mahak_session` cookie is cleared (Max-Age=0) after sign-out.

**Expected outcomes**:
- The endpoint path `/api/v1/shell` is unchanged (FR-033).
- The response schema is identical to R01 (FR-034).
- `shellMode` is resolved from the active session (not hardcoded).
- No sensitive data appears in the response (NFR-003, NFR-006, SC-007, SC-012).

**Traceability**: FR-033, FR-034, FR-037, NFR-003, NFR-006, SC-007, SC-012.

---

### V-11 — Accessibility and localization

**Steps**:
1. Set the interface locale to `fa` (Persian/RTL). Open the sign-in page.
2. Verify all labels, placeholders, and error messages are in Persian and the layout is RTL.
3. Set the locale to `ar` (Arabic/RTL). Repeat the verification.
4. Set the locale to `en` (English/LTR). Repeat the verification.
5. Tab through the sign-in form using only the keyboard. Verify every interactive control is reachable.
6. Zoom the browser to 200%. Verify no content is clipped, overlapped, or unreachable.

**Expected outcomes**:
- All three locales render correctly with proper RTL/LTR layout (NFR-009, SC-010).
- Keyboard navigation reaches every control (FR-035, NFR-009).
- 200% zoom is supported without layout breakage (NFR-008).

**Traceability**: FR-035, NFR-008, NFR-009, SC-010.

---

## Running the automated validation suites

```powershell
# API unit and contract tests (Python)
.\.venv\Scripts\python.exe -m pytest apps/api/tests/ -v

# Web unit and component tests (Vitest)
pnpm --filter @mahak/web test --run

# Playwright E2E tests (desktop-chromium only for auth flows)
pnpm --filter @mahak/web exec playwright test --project=desktop-chromium

# Python compilation gate
python -m compileall apps/api
```

All suites must pass for R02 to be considered validated.
