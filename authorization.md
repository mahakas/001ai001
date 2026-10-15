# Contract: Authorization

**Branch**: `002-identity-auth` | **Date**: 2026-09-26 | **Traces to**: FR-022–FR-028, FR-045, FR-046

## Purpose

Defines the role-based authorization contract that R02 establishes. The contract is consumed by the api (route guards) and by the web client (authorization-aware application state). R02 defines exactly two roles and an extensible policy interface.

---

## Roles

```text
Role ::= "user" | "admin"
```

Exactly two roles exist in R02. The model is extensible: new roles are added by extending the role set and the permissions map without modifying the shell's navigation or route-guard structure (FR-025).

| Role | Description |
|------|-------------|
| `user` | Ordinary account holder; no admin actions available |
| `admin` | Platform administrator; all actions available (admin actions defined by R27) |

---

## Permission Model

```text
RolePermissions ::= Record<Role, Set<Action>>

Action ::= string    // opaque action identifier; schema-defined per feature
```

The default R02 permission map:

| Role | Actions |
|------|---------|
| `user` | (none beyond navigation and reserved destinations) |
| `admin` | (all actions — placeholder; specific admin actions defined by R27) |

**Rules**:
1. A `user`-role account MUST NOT be able to perform admin-only actions (FR-023).
2. An `admin`-role account MUST be able to perform admin-only actions (FR-024).
3. When a user's role changes while they have an active session, the updated role is enforced on the next authenticated request (FR-026).
4. The authorization contract is structured so that new roles can be added without modifying the shell's navigation or route-guard structure (FR-025).

---

## Authorization Policy Interface

```text
AuthorizationPolicy ::= {
  check(role: Role, action: Action) -> bool
}
```

The default implementation (`RoleBasedPolicy`) uses the `RolePermissions` map. Future implementations (e.g. org-scoped policies) can replace this without changing the shell.

---

## Shell Integration

The web client's `ShellModeProvider` exposes an `isAuthenticated` boolean (already present in R01). R02 extends the context with:

```typescript
interface AuthContextValue {
  readonly shellMode: ShellMode;
  readonly isAuthenticated: boolean;
  readonly role: Role | null;          // null when shellMode is "public"
  readonly organizationReference: string | null;  // carried from session
  readonly setShellMode: (mode: ShellMode) => void;
}
```

The shell's route guards use `role` to enforce authorization (FR-027, FR-028). The organization reference is carried in the session context but is NOT exposed in any UI in R02 (FR-031).

---

## Error responses

| Condition | Shell behaviour |
|-----------|----------------|
| Unauthenticated access to authenticated route | Redirect to sign-in entry point (FR-044) |
| Authenticated but wrong role | Present generic unauthorized-message; do NOT expose internal authorization logic (FR-045, FR-046) |
