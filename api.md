# Contract: API — /api/v1/shell

**Branch**: `001-platform-app-shell` | **Date**: 2026-09-24 | **Traces to**: FR-055, NFR-006

## Purpose

Holds the Application/API boundary that the constitution's Web-first and
API-first requirement demands, and declares shell mode and feature
availability to any client (web today, mobile/embedded later). R01 exposes
exactly one route. No authentication, no module endpoints, no AI calls.

## Endpoint

### `GET /api/v1/shell`

**Purpose**: declare the shell mode, feature availability, and default locale
direction metadata to a client.

**Request**: no parameters, no credentials.

**Response** — `200 OK`, `application/json`:

```json
{
  "apiVersion": "v1",
  "shellMode": "public",
  "features": {
    "GENERAL_CHAT": "reserved",
    "CONVERSATIONS": "reserved",
    "PROJECTS": "reserved",
    "PRIVATE_TEACHER": "reserved",
    "FILES": "reserved",
    "SEARCH": "reserved",
    "SETTINGS": "reserved",
    "ADMIN_CONTROL_CENTER": "reserved"
  },
  "locales": {
    "supported": ["fa", "ar", "en"],
    "direction": { "fa": "rtl", "ar": "rtl", "en": "ltr" }
  }
}
```

**Field rules**

- `apiVersion` — the contract version this response conforms to.
- `shellMode` — `public` or `authenticated`, per the shell-mode contract. In
  R01 the api resolves `public` as the default; R02 later makes this
  resolution session-aware (see Extension rules, rule 4).
- `features` — the availability map. All eight values are `reserved` in R01.
  A later feature flips its value to `available`.
- `locales.supported` — the interface languages the shell supports.
- `locales.direction` — the locale → direction map used for first-visit
  direction resolution (FR-061).

**Safety rules**

1. The response MUST NOT contain credentials, secrets, tokens, provider keys,
   or any user data (NFR-006).
2. The api MUST NOT expose any module business endpoint in R01 (spec
   non-requirements).
3. The response contract is defined by `packages/contracts`; the api
   implementation MUST mirror those values exactly.

## Client resilience rule

The web client MUST render a fully functional shell without this endpoint:
theme, direction, viewport class, sidebar state, and offline indication
resolve locally. The api only supplies declared mode and availability
metadata, and its unavailability MUST NOT break the shell (see
`quickstart.md`).

## Extension rules

1. The endpoint path `/api/v1/shell` and its response shape remain stable;
   clients and tests MUST be able to depend on both.
2. Later features MAY update the *values* carried by this contract — for
   example flipping a `features` entry from `reserved` to `available` —
   without changing the path or the response schema.
3. Later features MUST NOT introduce business logic into this endpoint. Each
   feature adds its own versioned business routes under `/api/v1/...`,
   separate from the shell endpoint, so the shell stays free of feature
   concerns (FR-053, FR-054).
4. R02 extends the server-side resolution of `shellMode` — from R01's
   public/default behavior to session-aware behavior — while preserving the
   same endpoint path, the same response schema, the same `ShellMode` enum
   values, and the same navigation semantics. No change to the contract or
   to the shell's fundamental layout is required.
5. R09+ AI capabilities are reached through their own routes; the shell never
   calls them directly (FR-053).
