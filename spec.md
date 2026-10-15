# Feature Specification: R02 — Identity, Authentication & Authorization

**Feature Branch**: `002-identity-auth`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Allow users and administrators to securely register, authenticate, manage sessions, and operate according to roles and permissions. Includes email/password, phone/OTP, Google authentication, CAPTCHA requirements, rate limiting, roles, permissions, authorization boundaries, and organization-ready identity boundaries. Integrates with the R01 public/authenticated shell boundary while preserving the stable R01 shell contract."

**Roadmap Traceability**: `ROADMAP.md` → entry **R02 — Identity, Authentication & Authorization** (Phase A — Platform Foundation; depends on R01; R03, R05, R07, R08 depend on this).

**Governing Document**: `.specify/memory/constitution.md` — Principles I (architectural discipline), IV (security/privacy boundaries), V (test-backed development), plus the *Security & Cross-Platform Constraints* section.

## Dependencies on R01

R02 extends the R01 shell boundary defined in `specs/001-platform-app-shell/spec.md` and its contracts (`shell-mode.md`, `api.md`, `navigation.md`). Specifically:

- The `ShellMode` values (`public` / `authenticated`) and their navigation-set semantics remain unchanged.
- The `GET /api/v1/shell` endpoint path, response schema, and stability rules are preserved (contracts/api.md extension rule 4).
- R02 makes the server-side resolution of `shellMode` session-aware; the web client's `ShellModeProvider` consumes the value through the same seam.
- The eight reserved navigation destinations keep `visibilityScope = "authenticated"` (contracts/navigation.md); no R01 navigation contract change is required.
- Sign-in and sign-up entry points, defined in the R01 header region as public global actions, become wired to real authentication flows.

---

## Clarifications

### Session 2026-09-26

- Q: What is the minimal role taxonomy for R02? → A: R02 establishes exactly two roles — `user` and `admin` — as the starting point. The architecture MUST support future role addition without redesign. A full role taxonomy (e.g. org-admin, teacher-admin) is deferred to R27 (Admin Control Center) for specification; R02's authorization contract includes an extensible role model with placeholder policy hooks (FR-027, FR-028). **[CLARIFIED — no [NEEDS CLARIFICATION] marker needed]**

- Q: Should R02 implement organization membership or boundaries? → A: R02 establishes the *identity boundary* for organizations (a user can be associated with zero or one organization at registration time, with the organization field present in the user identity contract) but does NOT implement organization management, multi-tenant routing, or org-scoped authorization. That is scoped to R27. **[CLARIFIED — no [NEEDS CLARIFICATION] marker needed]**

- Q: What is the session lifetime and refresh strategy? → A: R02 uses server-side sessions with a configurable lifetime set by the operator and a default of 7 days. Sessions support sliding refresh on activity so an actively used session does not expire prematurely. A configuration mechanism is defined in the api layer; the shell consumes only the resolved `shellMode` value and is unaware of the lifetime policy. **[CLARIFIED — option C selected]**

- Q: How should account enumeration be protected? → A: R02 returns a uniform error message for both "email not found" and "wrong password" on the login endpoint, preventing email enumeration. This is standard practice and aligns with the constitution's security principle. **[CLARIFIED — no [NEEDS CLARIFICATION] marker needed]**

- Q: Where must CAPTCHA appear in the email/password flow? → A: CAPTCHA is required on the registration endpoint (to prevent bot-driven account creation) and on the login endpoint after a configurable number of failed attempts from the same IP (adaptive challenge, not every login). **[CLARIFIED — no [NEEDS CLARIFICATION] marker needed]**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Registration (Priority: P1)

A new visitor wants to create a MAHAK account so they can access the authenticated shell and its reserved module destinations. They choose to register via email/password (with CAPTCHA), phone/OTP, or Google sign-in, receive confirmation that their account was created, and are redirected into the authenticated shell.

**Why this priority**: Without the ability to create an account, no user can reach the authenticated shell. Registration is the entry gate for every downstream feature (chat, projects, Teacher, etc.) and is the minimum viable capability for R02 to deliver value.

**Independent Test**: Register a new account via each supported method, confirm the shell transitions from public to authenticated mode, and verify the eight reserved destinations become visible in the navigation.

**Acceptance Scenarios**:

1. **Given** a visitor is on the public shell, **When** they activate the sign-up entry point and complete the email/password registration form (including a valid CAPTCHA response), **Then** a new account is created, the shell transitions to authenticated mode, and the reserved navigation destinations become visible.
2. **Given** a visitor is on the public shell, **When** they activate the sign-up entry point and complete phone/OTP registration (enter a valid phone number, receive and enter the OTP), **Then** a new account is created, the shell transitions to authenticated mode, and the reserved navigation destinations become visible.
3. **Given** a visitor is on the public shell, **When** they activate the sign-up entry point and complete Google sign-in, **Then** a new account is created (or an existing account is matched), the shell transitions to authenticated mode, and the reserved navigation destinations become visible.
4. **Given** a visitor attempts to register with an email that is already in use, **When** they submit the registration form, **Then** the system presents a generic registration-failure message that does not confirm or deny whether the email exists.
5. **Given** a visitor attempts to register without completing the CAPTCHA challenge (where required), **When** they submit the registration form, **Then** the system rejects the request and presents a clear CAPTCHA-required message.
6. **Given** a visitor submits an invalid or malformed phone number during phone/OTP registration, **When** they submit the form, **Then** the system rejects the request before sending an OTP and presents a clear validation message.

---

### User Story 2 - Sign-In and Session Management (Priority: P1)

A registered user wants to sign in to their MAHAK account using any supported method, maintain an active session across page reloads and navigation, and explicitly terminate their session when finished.

**Why this priority**: Authentication is the fundamental bridge between the public and authenticated shells. Without reliable sign-in and session management, no authenticated feature is reachable. This story is the core of R02.

**Independent Test**: Sign in via each method, reload the page and confirm the session persists, navigate between reserved destinations and confirm the authenticated shell remains active, then sign out and confirm the shell returns to public mode.

**Acceptance Scenarios**:

1. **Given** a registered user enters valid credentials on the sign-in page, **When** they submit the form, **Then** the shell transitions to authenticated mode and persists the session across page reloads within the session lifetime.
2. **Given** a user has an active authenticated session, **When** they reload the browser, **Then** the shell remains in authenticated mode without requiring re-authentication.
3. **Given** a user has an active authenticated session, **When** they navigate between reserved destinations, **Then** the session remains valid and the navigation continues to function.
4. **Given** a user activates the sign-out control, **When** they confirm (or the sign-out is immediate), **Then** the session is terminated, the shell transitions to public mode, and all reserved destinations disappear from the navigation.
5. **Given** a user's session has expired (time-based lifetime elapsed), **When** they attempt any authenticated action, **Then** the shell redirects them to the sign-in entry point and presents an appropriate session-expired message.
6. **Given** a user's session has been revoked (e.g. by an admin action or security event), **When** they attempt any authenticated action, **Then** the shell treats the session as terminated and redirects to the sign-in entry point.
7. **Given** a user attempts to sign in with invalid credentials, **When** the system verifies the attempt, **Then** the system presents a generic sign-in-failure message that does not distinguish between wrong password and unknown email.
8. **Given** a user exceeds the allowed failed-sign-in attempts within the rate-limit window, **When** they submit another sign-in attempt, **Then** the system rejects the request with a rate-limit message and does not reveal whether the account exists.

---

### User Story 3 - Authorization and Role-Based Access (Priority: P1)

An authenticated user (or administrator) navigates MAHAK and accesses only the features and data their role permits. Administrators have broader authorization boundaries than ordinary users. The authorization system enforces these boundaries consistently across all shell destinations.

**Why this priority**: The constitution requires explicit and role-aware authorization (Principle IV). R02 must establish the authorization contract so later features (R05 chat, R27 admin) can rely on it without redefining it.

**Independent Test**: Sign in as a user and as an admin, verify that admin-only actions are unavailable to regular users, and verify that unauthorized access to a protected route redirects to the appropriate entry point.

**Acceptance Scenarios**:

1. **Given** a user with the `user` role navigates to a destination that requires admin authorization, **When** they attempt to access it, **Then** the shell presents an unauthorized-access message and does not expose the protected content.
2. **Given** an administrator with the `admin` role navigates to an admin-only destination, **When** they access it, **Then** the shell presents the authorized content without interruption.
3. **Given** an unauthenticated visitor attempts to reach any authenticated destination directly by URL, **When** they navigate to that URL, **Then** the shell redirects them to the sign-in entry point (no protected content is exposed).
4. **Given** a user's session is valid but their role has been changed (e.g. demoted from admin to user), **When** they perform an action requiring the former role, **Then** the shell enforces the updated role and denies the action.
5. **Given** the shell is in authenticated mode, **When** a user accesses any reserved destination whose feature is not yet implemented, **Then** the shell presents the defined unavailable state (R01 behavior is preserved).
6. **Given** a future feature introduces a new role, **When** the authorization contract is extended, **Then** the existing shell navigation and route-guard behavior adapts without redesign (the role model is extensible per FR-028).

---

### User Story 4 - CAPTCHA and Abuse Resistance (Priority: P2)

MAHAK must protect its authentication endpoints against automated abuse (bot-driven account creation, credential stuffing, brute-force sign-in attempts) without imposing unnecessary friction on legitimate users.

**Why this priority**: The constitution mandates abuse protections for authentication endpoints (Principle IV). CAPTCHA and rate limiting are safety-critical for the integrity of the platform, though they are secondary to the core sign-in/sign-up flows.

**Independent Test**: Submit multiple rapid sign-in attempts from the same IP and observe the rate-limit response; submit a registration without a valid CAPTCHA and observe rejection; submit a registration with a valid CAPTCHA and observe acceptance.

**Acceptance Scenarios**:

1. **Given** a visitor initiates email/password registration, **When** they submit the form without a valid CAPTCHA response, **Then** the registration is rejected with a clear message explaining that CAPTCHA verification is required.
2. **Given** a visitor initiates email/password registration and provides a valid CAPTCHA response, **When** they submit the form with valid credentials, **Then** the registration proceeds normally.
3. **Given** a visitor has made repeated failed sign-in attempts from the same IP within the rate-limit window, **When** they attempt another sign-in, **Then** the system applies a CAPTCHA challenge before accepting the credentials.
4. **Given** a visitor exceeds the maximum allowed sign-in attempts within the rate-limit window, **When** they attempt another sign-in, **Then** the system temporarily blocks further attempts and presents a rate-limit message indicating when they can retry.
5. **Given** a visitor exceeds the maximum allowed registration attempts from the same IP within the rate-limit window, **When** they attempt another registration, **Then** the system temporarily blocks further attempts and presents a rate-limit message.
6. **Given** a legitimate user triggers the CAPTCHA challenge due to repeated failed attempts, **When** they complete the CAPTCHA correctly, **Then** they are allowed to continue with sign-in (the block is lifted or the attempt is counted).

---

### User Story 5 - Organization-Ready Identity Boundaries (Priority: P2)

The identity system must be structured so that future organizational boundaries (schools, universities, institutes, general organizations) can be layered on top without restructuring the core user identity model.

**Why this priority**: The constitution requires that User, Project, Teacher, and organization boundaries be represented explicitly so future multi-tenant deployment can be added without redesign (Principle IV). R02 must lay this foundation without implementing full multi-tenant business logic.

**Independent Test**: Create a user identity record that includes an optional organization reference; verify the user contract supports the organization field; verify that authentication and authorization work correctly whether or not the organization field is populated.

**Acceptance Scenarios**:

1. **Given** a user registers without an organization association, **When** their identity is persisted, **Then** the organization reference is null/absent and the user operates as an independent account.
2. **Given** a user registers with a valid invite token supplied in the registration URL query string (e.g. `/register?invite=abc123`), **When** their identity is persisted, **Then** the organization reference is stored verbatim and the user identity carries the organization boundary for future authorization scoping.
3. **Given** a user with an organization association signs in, **When** the shell renders, **Then** the shell remains in authenticated mode and the organization boundary is carried in the session context (not exposed as a UI element in R02).
4. **Given** a future feature needs to enforce organization-scoped authorization, **When** it reads the user's organization reference from the session, **Then** it can do so without modifying the R02 identity or session contract.
5. **Given** the R02 architecture, **When** a future roadmap feature implements full organization management, **Then** it can extend the identity model without changing the core authentication and session contracts.
6. **Given** a user submits a registration with an invalid or missing invite token, **When** the registration is processed, **Then** the account is created successfully with a null organization reference (the invite token is optional, not required).
7. **Given** a user registers with an invite token in the registration URL query string, **When** the registration succeeds, **Then** the token is stored verbatim as the organization reference and the shell transitions to authenticated mode normally (no organization-management UI is shown).

---

### User Story 6 - Error and Recovery States in Authentication Flows (Priority: P2)

A user encountering any authentication error (invalid credentials, expired session, invalid OTP, CAPTCHA failure, rate limit, service unavailable) receives a clear, safe message and a recovery path where one exists — without exposing sensitive system details.

**Why this priority**: The constitution requires that failed operations report the failure reason and available recovery information (Principle IV). Authentication errors are user-facing and must be handled gracefully to avoid confusion or information leakage.

**Independent Test**: Trigger each defined error condition and verify the shell presents the correct message, the session state is consistent, and a recovery path exists where applicable.

**Acceptance Scenarios**:

1. **Given** a user enters an invalid email or password, **When** they attempt to sign in, **Then** the system presents a generic sign-in-failure message and does not indicate which field was incorrect.
2. **Given** a user's session has expired, **When** they attempt an authenticated action, **Then** the shell redirects to the sign-in entry point and presents a session-expired message.
3. **Given** a user presents an invalid or expired OTP code, **When** they attempt to complete OTP verification, **Then** the system presents a clear OTP-invalid or OTP-expired message and offers the option to request a new code.
4. **Given** a CAPTCHA challenge fails (user did not complete it or it expired), **When** the authentication request is submitted, **Then** the system rejects the request and presents a clear CAPTCHA-required message.
5. **Given** the authentication service is temporarily unavailable, **When** a user attempts to sign in or register, **Then** the system presents a service-unavailable message with a retry option and does not crash or expose stack traces.
6. **Given** a user's session is revoked, **When** they attempt any authenticated action, **Then** the shell treats the session as terminated, redirects to the sign-in entry point, and presents a session-revoked message.
7. **Given** a Google sign-in returns an invalid or denied authorization result, **When** the callback is processed, **Then** the system presents a sign-in-failure message and does not create an account or leak the provider error details.
8. **Given** a user is rate-limited, **When** they retry after the rate-limit window expires, **Then** the system accepts the request normally without carrying over the blocked state.

---

### User Story 7 - Shell Integration: Public vs Authenticated Transition (Priority: P1)

The R01 shell must seamlessly transition between public and authenticated modes when a user signs in or signs out, without reloading the page or restructuring the shell frame. The authenticated navigation set and the account area must appear correctly once the session is established.

**Why this priority**: R01 defined the public/authenticated boundary as a contract; R02 must realize that contract with real session logic. If the transition is broken, every authenticated feature is unreachable.

**Independent Test**: Sign in from the public shell, confirm the navigation set changes to include the eight reserved destinations and the account area appears in the header; sign out, confirm the shell returns to the public navigation set with sign-in/sign-up entry points.

**Acceptance Scenarios**:

1. **Given** the shell is in public mode, **When** a user completes sign-in successfully, **Then** the shell transitions to authenticated mode without a page reload, the eight reserved destinations appear in the navigation, and the account area replaces the sign-in/sign-up entry points in the header.
2. **Given** the shell is in authenticated mode, **When** a user signs out, **Then** the shell transitions back to public mode without a page reload, the reserved destinations disappear from the navigation, and the sign-in/sign-up entry points reappear in the header.
3. **Given** the shell is in authenticated mode, **When** an invalid, expired, or revoked session is detected on any authenticated request, **Then** the shell transitions to public mode and redirects the user to the sign-in entry point.
4. **Given** the shell is in either mode, **When** the mode changes, **Then** the transition obeys FR-045 (no reload, no shell restructure) and the `GET /api/v1/shell` endpoint continues to return the same response shape (FR-055).
5. **Given** the shell is in authenticated mode, **When** the user opens a reserved destination, **Then** the destination shows the unavailable state (R01 behavior) until a later roadmap feature implements it.

---

## Edge Cases

- **Concurrent sign-in from multiple devices**: The same account is signed in on two browsers simultaneously. Both sessions remain valid until one expires or is revoked. Revoking one session does not affect the other unless a full logout-all is triggered.
- **Sign-up during an existing session**: A user who is already authenticated opens the sign-up page. The system detects the existing session and either redirects to the authenticated shell or presents an appropriate "already signed in" message.
- **Google account already linked to an existing email**: A user signs in with Google using an email that already has an email/password account. The system MUST link the Google identity to the existing account so the user can sign in with either method. A social-identity linkage table is introduced for this purpose. **[CLARIFIED — option A selected]**
- **OTP code arriving after session expiry**: The user requests an OTP, the session expires before they enter the code, and they attempt to complete OTP verification. The system treats this as an expired OTP and prompts for a new code.
- **CAPTCHA solved but submission fails due to race condition**: The user solves the CAPTCHA, but the challenge token expires before the registration form is submitted. The system rejects the submission and asks the user to solve a new CAPTCHA.
- **Rate limit applied to a bot-controlled IP affecting legitimate users**: A legitimate user shares an IP with a bot that triggers the rate limit. The system must degrade gracefully — present the rate-limit message without blocking the legitimate user indefinitely.
- **Organization reference set but organization management feature not yet available**: A user registers with an invite token that passes server-side validation. The organization reference is stored and carried in the session context, but no organization-management UI or API exists in R02. The shell renders normally in authenticated mode regardless of whether the reference is populated.
- **Sign-in with phone number that was previously used with a different authentication method**: A user registered with email/password and later tries to sign in with the same phone number via OTP. The system MUST allow both email and phone number on a single account as independent sign-in keys; the account is looked up by whichever key is presented. **[CLARIFIED — option B selected]**
- ** interrupted authentication flow (browser closed mid-sign-in)**: The user initiates sign-in (e.g. Google OAuth redirect) but closes the browser before the callback completes. No session is created, and no partial account exists.
- **Extremely long password or email input**: The system truncates or rejects overly long inputs at the validation layer before any credential processing, preventing injection-like abuse without exposing internal buffer limits.
- **User deletes their account (future feature, out of R02 scope)**: R02 must define the session-termination behavior when a user account is deleted by a later feature — all sessions for that user are revoked immediately.

---

## Requirements *(mandatory)*

### Functional Requirements

**Account registration**

- **FR-001**: The shell MUST allow a visitor to create a new account via email/password, phone/OTP, or Google sign-in.
- **FR-002**: Email/password registration MUST include a CAPTCHA challenge that the user must complete before the registration is accepted.
- **FR-003**: Phone/OTP registration MUST validate the phone number format before sending an OTP and MUST verify the OTP code before creating the account.
- **FR-004**: Google sign-in MUST use an OAuth 2.0 flow and MUST create or match an account based on the verified Google identity.
- **FR-005**: Registration MUST return a uniform failure message when the provided email is already associated with an existing account, without confirming or denying the email's existence.
- **FR-006**: After successful registration, the shell MUST transition from public mode to authenticated mode without a page reload.
- **FR-007**: A user who is already authenticated MUST NOT be able to create a duplicate account; the system MUST redirect them to the authenticated shell or present an appropriate already-signed-in message.

**Authentication and session management**

- **FR-008**: The shell MUST support sign-in via email/password, phone/OTP, and Google sign-in for registered users.
- **FR-009**: Upon successful sign-in, the shell MUST transition to authenticated mode and persist the session across page reloads within the session lifetime.
- **FR-010**: The shell MUST terminate the session and transition back to public mode when the user signs out.
- **FR-011**: An expired session MUST be detected on the next authenticated request, the session MUST be terminated, and the user MUST be redirected to the sign-in entry point with a session-expired message.
- **FR-012**: A revoked session MUST be treated as terminated immediately; the user MUST be redirected to the sign-in entry point with a session-revoked message.
- **FR-013**: Sign-in with invalid credentials MUST return a uniform failure message that does not distinguish between an unknown email and a wrong password.
- **FR-014**: The shell MUST support an explicit logout-all action that terminates all active sessions for the current account.
- **FR-015**: An interrupted authentication flow (e.g. browser closed mid-OAuth redirect) MUST NOT create a partial account or an orphaned session.

**CAPTCHA and abuse resistance**

- **FR-016**: Email/password registration MUST require a valid CAPTCHA response before the submission is accepted.
- **FR-017**: The system MUST track failed sign-in attempts per account and per IP address and MUST apply a CAPTCHA challenge after a configurable threshold of consecutive failures from the same IP.
- **FR-018**: The system MUST enforce a rate limit on sign-in attempts per IP within a sliding time window; exceeding the limit MUST temporarily block further attempts and present a rate-limit message indicating the retry time.
- **FR-019**: The system MUST enforce a rate limit on registration attempts per IP within a sliding time window; exceeding the limit MUST temporarily block further attempts and present a rate-limit message.
- **FR-020**: Rate-limit counters MUST reset after the window expires; a blocked user MUST be able to retry normally after the window expires without additional action.
- **FR-021**: CAPTCHA challenges and rate-limit responses MUST NOT reveal whether the target account exists.

**Authorization and roles**

- **FR-022**: The system MUST distinguish at least two roles — `user` and `admin` — and enforce role-based authorization checks on protected actions.
- **FR-023**: A `user`-role account MUST NOT be able to perform admin-only actions; the shell MUST present an unauthorized-access message when this is attempted.
- **FR-024**: An `admin`-role account MUST be able to perform admin-only actions.
- **FR-025**: The authorization contract MUST be structured so that new roles can be added without modifying the shell's navigation or route-guard structure (extensible role model).
- **FR-026**: When a user's role changes while they have an active session, the shell MUST enforce the updated role on the next authenticated request.
- **FR-027**: The shell MUST expose an authorization-aware application state so that UI components can render different content or controls based on the user's role.
- **FR-028**: Protected routes MUST redirect unauthorized users to the sign-in entry point rather than exposing the protected content or an internal error.

**Organization-ready identity boundaries**

- **FR-029**: The user identity contract MUST include an optional organization reference field to support future organizational scoping. The reference is supplied at registration time as an opaque invite token passed in the URL query string (e.g. `/register?invite=TOKEN`). The server validates the token format and freshness (e.g. non-empty, within acceptable length and character set); if validation passes, the token is stored verbatim in the user record. If validation fails or no token is provided, the organization reference is set to null. In R02 the token is never resolved against an external organization management system — it is carried in the session context for downstream features to consume.
- **FR-030**: Authentication and session behavior MUST be correct whether the user's organization reference is populated or null.
- **FR-031**: R02 MUST NOT implement organization management, multi-tenant routing, or org-scoped authorization; it MUST only establish the identity boundary for future features.
- **FR-032**: The organization reference MUST be stored alongside the user identity and MUST be available in the session context for downstream features to read.

**R01 shell integration**

- **FR-033**: The `GET /api/v1/shell` endpoint path and response schema MUST remain stable; R02 changes only the server-side resolution of `shellMode` to be session-aware.
- **FR-034**: The `ShellMode` values (`public`, `authenticated`) and their navigation-set semantics MUST remain unchanged from R01.
- **FR-035**: The shell's public authentication boundary MUST expose sign-in and sign-up entry points in the header region (per the R01 A-08 decision).
- **FR-036**: The shell's authenticated navigation set MUST present the eight reserved module destinations, each with the defined unavailable state, exactly as in R01.
- **FR-037**: Switching between public and authenticated mode MUST NOT reload the page or restructure the shell's regions (FR-045 is preserved).

**Error and recovery states**

- **FR-038**: Invalid credentials MUST produce a generic sign-in-failure message with no indication of which field was incorrect.
- **FR-039**: An expired session MUST produce a session-expired message and redirect to sign-in.
- **FR-040**: An invalid OTP MUST produce a clear OTP-invalid message with an option to request a new code.
- **FR-041**: An expired OTP MUST produce a clear OTP-expired message with an option to request a new code.
- **FR-042**: An invalid Google authentication result MUST produce a generic sign-in-failure message without exposing provider error details.
- **FR-043**: A CAPTCHA failure MUST produce a clear CAPTCHA-required message.
- **FR-044**: A rate-limit response MUST produce a clear rate-limit message indicating when the user can retry.
- **FR-045**: An unauthorized access attempt MUST produce a generic unauthorized-message without exposing internal authorization logic.
- **FR-046**: A forbidden access attempt (authenticated but wrong role) MUST produce a generic forbidden-message.
- **FR-047**: An authentication service failure MUST produce a service-unavailable message with a retry option and MUST NOT expose stack traces or internal error details.
- **FR-048**: An interrupted authentication flow MUST leave the shell in a consistent state (public or authenticated as appropriate) with no partial session or account created.

### Non-Functional Requirements

- **NFR-001**: Credential storage MUST use a bcrypt or argon2 hash function (or equivalent adaptive one-way hash) with a cost factor appropriate for the deployment environment; plaintext passwords MUST NEVER be stored.
- **NFR-002**: Session tokens MUST be cryptographically random, at least 128 bits in length, and MUST NOT be predictable or derivable from user data.
- **NFR-003**: Provider credentials (Google Client ID, Google Client Secret, CAPTCHA site key, SMTP/phone provider keys) MUST remain server-side at all times and MUST NEVER be exposed to the browser or included in any api response.
- **NFR-004**: The authentication endpoints MUST respond within 500 ms for valid requests under normal load; rate-limited or CAPTCHA-challenged requests MAY take longer due to external service calls but MUST complete within 5 seconds.
- **NFR-005**: All authentication and authorization behavior MUST be verifiable through automated tests, including sign-in flows, session lifecycle, role checks, rate limiting, and error states, with external providers mocked so tests are deterministic.
- **NFR-006**: The shell MUST NOT contain, log, or expose any credential, secret, token, provider key, or user password hash; no authentication behavior MAY depend on server-side secrets being present in the browser.
- **NFR-007**: Security-relevant authentication and authorization events (successful sign-in, failed sign-in, session creation, session termination, role change, account creation, rate-limit trigger) MUST be logged with structured fields and no sensitive data (passwords, tokens, OTP codes).
- **NFR-008**: The authentication system MUST remain usable at 200% browser zoom/text scaling without loss of content, overlapping regions, or unreachable controls (carried over from R01 NFR-007).
- **NFR-009**: Authentication pages MUST support Persian, Arabic, and English locales with correct RTL/LTR layout and MUST be operable via keyboard alone (carried over from R01 accessibility and i18n requirements).
- **NFR-010**: The authentication system MUST be resilient to a single provider failure — if the Google provider is unreachable, email/password and phone/OTP sign-in MUST remain functional, and vice versa.

---

### Key Entities

- **User**: The core identity record. Attributes include a stable `id`, `email` (nullable for phone-only/Google-only accounts), `phone` (nullable), `passwordHash` (nullable — absent for Google-only accounts), `role` (`user` or `admin`), `organizationId` (nullable, for future org scoping), `createdAt`, and `lastLoginAt`. Passwords are stored as hashes only. OTP codes are transient and never stored long-term. A single account MAY have both an `email` and a `phone` populated, and either key can be used to sign in. Google identities are linked to the existing account via a social-identity linkage table (no duplicate accounts).
- **Session**: Represents an active authenticated connection for a user. Attributes include a stable `id` (internal database primary key), `token` (browser-facing opaque session token, cryptographically random, at least 128 bits — 256-bit recommended; never exposed through API JSON), `userId`, `createdAt`, `expiresAt`, `revokedAt` (nullable), and `ipAddress`. A session is valid between `createdAt` and `expiresAt` unless `revokedAt` is set.
- **AuthenticationEvent**: A structured log record for security-relevant events. Attributes include `eventId`, `userId` (nullable for unauthenticated events), `eventType` (`sign_in_success`, `sign_in_failure`, `session_created`, `session_terminated`, `role_changed`, `account_created`, `rate_limit_triggered`, `captcha_challenge`), `ipAddress`, `userAgent` (truncated), and `timestamp`. Sensitive fields (passwords, tokens, OTP codes) are NEVER included.
- **RateLimitBucket**: A server-side counter tracking authentication attempts per identifier (email, phone, or IP). Attributes include the identifier, `attemptCount`, `windowStart`, and `windowEnd`. Buckets expire automatically when the window ends.
- **OrganizationReference** (future seam): A nullable foreign-key-like field on the User entity that references a future Organization entity. In R02 the value is supplied as an opaque invite token in the registration URL query string (e.g. `/register?invite=TOKEN`); the server validates the token format at the identity boundary (non-empty, within VARCHAR(255) bounds) and stores it verbatim only if validation passes. Invalid or missing tokens result in a null reference. The token is never resolved to an org name or used for org-scoped authorization in R02. A future feature resolves the token and binds the user to the organization. R02 does not expose any organization-management UI or API.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of supported registration methods (email/password, phone/OTP, Google) can create a new account and transition the shell to authenticated mode in a single successful flow, verified by end-to-end test.
- **SC-002**: 100% of sign-in methods preserve the authenticated session across a full browser reload within the session lifetime, verified by automated test.
- **SC-003**: 100% of sign-in attempts with invalid credentials produce a uniform failure message that does not distinguish between unknown email and wrong password, verified by component test.
- **SC-004**: 100% of rate-limited IP addresses are blocked from further sign-in and registration attempts for the duration of the rate-limit window, and are unblocked after the window expires, verified by unit test.
- **SC-005**: 100% of authentication events (sign-in success/failure, session create/terminate, account create, rate-limit trigger) are logged with structured fields and zero sensitive data, verified by unit test.
- **SC-006**: 100% of shell transitions between public and authenticated modes occur without a page reload and without restructuring the shell frame, verified by component test.
- **SC-007**: Zero provider credentials, secrets, tokens, or password hashes are present in any browser-loaded asset, api response, or client-side log, verified by automated scan.
- **SC-008**: The authenticated navigation set presents all eight R01 reserved destinations with their defined unavailable state, and the public navigation set presents only sign-in/sign-up entry points, verified by component test.
- **SC-009**: An expired or revoked session causes an immediate transition to public mode and redirection to the sign-in entry point, verified by component test.
- **SC-010**: Authentication pages render correctly in Persian, Arabic, and English with appropriate RTL/LTR layout and are fully operable via keyboard, verified by E2E test.
- **SC-011**: All 48 functional requirements and all 10 non-functional requirements are covered by automated tests that pass deterministically, with external providers mocked so tests are deterministic.
- **SC-012**: The `GET /api/v1/shell` endpoint retains its R01 response shape exactly, with `shellMode` now resolved from the active session rather than a hardcoded default, verified by api contract test.

---

## Assumptions

- **A-01**: Users have a modern browser and a stable network connection under normal operation; degraded-connection behavior is defined but is not the primary target.
- **A-02**: The CAPTCHA provider is a standard web-based service (e.g. reCAPTCHA, hCaptcha, or equivalent); the specific provider is deferred to the implementation plan and is configurable via a server-side setting.
- **A-03**: The Google OAuth 2.0 provider is configured server-side with a Client ID and Client Secret; the web client never sees these values.
- **A-04**: Phone/OTP delivery uses a standard SMS or voice API; the specific provider is deferred to the implementation plan. OTP codes are numeric, time-limited, and single-use.
- **A-05**: Session lifetime is a server-side configurable value with a default of 7 days; sessions support sliding refresh on activity so actively used sessions do not expire prematurely. The shell is unaware of the lifetime policy and consumes only the resolved `shellMode` value.
- **A-06**: The platform does not require email verification before account activation in R02; accounts are immediately usable upon successful registration. Email verification may be added by a later feature.
- **A-07**: Password policies (minimum length, complexity requirements) follow industry-standard defaults (minimum 8 characters, no complexity requirements in R02) unless a stricter policy is specified during clarification.
- **A-08**: The shell's existing `ShellModeProvider` and `NavigationRegistry` components consume the `shellMode` value from the api contract unchanged; R02 modifies only the server-side resolution logic.
- **A-09**: Organization boundaries are represented as a nullable reference on the User entity; no organization-management API or UI is implemented in R02.
- **A-10**: The authentication system handles concurrent sessions per account (the same user can be signed in on multiple devices) unless a full logout-all is triggered.

---

## Scope Boundaries

**In scope (R02)**

- Account registration via email/password (with CAPTCHA), phone/OTP, and Google sign-in.
- Sign-in, sign-out, and session lifecycle management (creation, persistence, expiration, revocation).
- Role-based authorization with at least `user` and `admin` roles, with an extensible role model.
- CAPTCHA integration for registration and adaptive challenge on sign-in.
- Rate limiting on sign-in and registration endpoints (per IP and per account).
- Organization-ready identity boundary (nullable organization reference on User).
- Secure credential storage (hashed passwords, no plaintext).
- Structured security event logging (no sensitive data in logs).
- Safe error messages (no account enumeration, no provider error leakage).
- Integration with the R01 public/authenticated shell boundary (session-aware shellMode resolution).
- Authentication-page accessibility (keyboard, screen reader, RTL/LTR, zoom) and localization (fa/ar/en).
- Authentication-page responsive behavior across desktop, tablet, and mobile viewports.

**Out of scope (owned by later roadmap entries)**

- Billing, credits, and usage accounting — **R31**.
- General AI Chat, conversation streaming, and message exchange — **R05**.
- Conversation history, search implementation, and conversation organization — **R06**.
- Projects and project semantics — **R07**.
- File upload, attachments, and storage — **R08**.
- Knowledge/RAG, ingestion, embedding, retrieval, and citation — **R12–R18**.
- Private Teacher functionality and behavior — **R19–R22**.
- Voice interaction — **R25**.
- Memory — **R24**.
- Admin Control Center implementation (beyond role-based access enforcement) — **R27**.
- Admin AI Copilot — **R28**.
- Approval, jobs, and AI operations — **R29**.
- AI Model Gateway and provider management — **R09**.
- Full organization management product (org creation, membership, billing) — deferred to R27 or a future feature.
- Full multi-tenant business logic — deferred to a future feature.
- Password reset / forgot-password flow — **deferred; may be added in R02 clarification or a subsequent feature**.
- Account deletion — deferred to a future feature.
- Two-factor authentication (beyond phone/OTP as a primary sign-in method) — deferred.
- Social login beyond Google — deferred.
- Session device management (viewing active devices, revoking specific devices) — deferred.

---

## Dependencies on R01

R02 depends on R01 for:

- The application shell frame (three regions: sidebar, header, main content).
- The `ShellMode` contract (`public` / `authenticated`) and its navigation-set semantics.
- The `GET /api/v1/shell` endpoint and its response schema.
- The reserved navigation destination registry (8 destinations, all `authenticated` scope, all `reserved` availability).
- The public vs authenticated shell boundary defined in `contracts/shell-mode.md`.
- The shell-mode seam in `ShellModeProvider` that R02 wires to real session logic.
- The sign-in/sign-up entry points defined as header global actions in R01 (A-08 decision).
- The accessibility, i18n, theme, and responsive foundations that authentication pages must inherit.

R02 does NOT modify any R01 source file except by extending the server-side session logic that feeds the existing `ShellModeProvider` contract.

---

## Clarifications Resolved

All four clarification questions were resolved during the specification and clarification sessions (2026-09-26). No [NEEDS CLARIFICATION] markers remain in this document.

| Question | Resolution | Spec Impact |
|----------|-----------|-------------|
| Q1 — Session lifetime | **Option C**: Configurable lifetime, default 7 days, sliding refresh on activity | `FR-009`, `FR-011`, Assumption A-05 updated |
| Q2 — Google + existing email conflict | **Option A**: Link Google identity to the existing account via a social-identity linkage table | Edge case "Google account already linked" resolved; user story acceptance scenarios updated |
| Q3 — Phone/email as identity keys | **Option B**: A single account can have both email and phone as sign-in keys | Edge case "Sign-in with phone previously used with different method" resolved; User entity attributes updated |
| Q4 — How is the organization reference supplied at registration? | **Option B**: Accepted as an opaque invite token in the registration URL query string (e.g. `/register?invite=abc123`); validated server-side but not resolved to an org name in R02 | `FR-029`, Key Entity `OrganizationReference` updated; edge case "Organization reference at registration" documented |
