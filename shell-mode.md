# Contract: Shell Mode

**Branch**: `001-platform-app-shell` | **Date**: 2026-09-24 | **Traces to**: FR-042–FR-046, FR-058

## Purpose

Defines the public vs authenticated application-shell boundary as a contract
that R02 later implements. R01 defines the contract and consumes it; R01
implements no authentication.

## Values

```text
ShellMode ::= "public" | "authenticated"
```

Exactly two values. No third value (no "loading" or "unknown" mode) is
permitted.

## Semantics

| Mode | Navigation set presented | Module destinations | Account area | Sign-in entry |
|------|--------------------------|---------------------|--------------|---------------|
| `public` | Sign-in and sign-up entry points plus public global actions, in the header region | None visible, none routable | Not presented | Presented as a header global action |
| `authenticated` | All eight reserved module destinations plus the account area | Visible with the defined unavailable state (all `reserved` in R01) | Presented | Not applicable |

## Rules

1. The shell MUST expose exactly one active mode at any time.
2. While `public`, no reserved module destination is visible in the
   navigation and no module route renders module content; reaching a module
   route resolves to the sign-in entry point (FR-044, FR-058).
3. While `authenticated`, the eight reserved destinations are presented in
   the navigation; activating one presents the defined unavailable state
   (FR-013, FR-050).
4. Switching mode MUST NOT reload the page or restructure the shell's
   regions (FR-045).
5. R01 MUST NOT implement authentication, credential handling, sessions,
   roles, or permissions (FR-046). The mode is resolved from the shell-mode
   seam.

## Consumption seam

- `packages/contracts/src/shell-mode.ts` — the canonical type and values.
- `apps/web` `ShellModeProvider` — consumes the value and switches navigation
  sets and global actions.
- `apps/api` `/api/v1/shell` — declares the mode and the availability map.
- `apps/api` resolves `public` as the default in R01; R02 later makes the
  resolution session-aware while preserving the endpoint path, the response
  schema, and the two contract values.

## Extension for R02

R02 introduces the real authentication mechanisms (email/password with
CAPTCHA, phone/OTP, Google), sessions, and roles. The extension touches only
*how the mode is resolved*; the two values, the navigation-set behavior, and
the header sign-in entry point remain unchanged.
