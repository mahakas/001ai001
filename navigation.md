# Contract: Navigation

**Branch**: `001-platform-app-shell` | **Date**: 2026-09-24 | **Traces to**: FR-005–FR-015, FR-056

## Purpose

Defines the stable navigation contract that future product modules bind to,
so modules can be added without modifying the shell's layout or navigation
structure.

## NavigationDestination

```text
NavigationDestination ::=
  id              : String          -- stable, language- and label-independent
  moduleId        : ModuleId        -- reserved seam this destination hosts
  labelKey        : String          -- key into externalized string resources
  routePath       : String          -- route slot this destination binds to
  availability    : "reserved" | "available"
  visibilityScope : "public" | "authenticated"
```

### Field rules

- **id** — stable across locales and label changes; later features bind to it
  (FR-011).
- **moduleId** — exactly one destination exists per module (FR-012).
- **labelKey** — MUST NOT be a hard-coded display string; all shell text is
  externalized (FR-028).
- **availability** — `reserved` in R01 for every module destination;
  activating a `reserved` destination presents the defined unavailable state
  (FR-013, FR-050). Availability flips to `available` only when the owning
  roadmap feature ships.
- **visibilityScope** — `authenticated` for all eight module destinations
  (FR-015, FR-058).

## Reserved destination registry (R01)

| id | moduleId | routePath | availability | visibilityScope |
|----|----------|-----------|--------------|-----------------|
| `dest.general-chat` | `GENERAL_CHAT` | `/chat` | reserved | authenticated |
| `dest.conversations` | `CONVERSATIONS` | `/conversations` | reserved | authenticated |
| `dest.projects` | `PROJECTS` | `/projects` | reserved | authenticated |
| `dest.private-teacher` | `PRIVATE_TEACHER` | `/teacher` | reserved | authenticated |
| `dest.files` | `FILES` | `/files` | reserved | authenticated |
| `dest.search` | `SEARCH` | `/search` | reserved | authenticated |
| `dest.settings` | `SETTINGS` | `/settings` | reserved | authenticated |
| `dest.admin` | `ADMIN_CONTROL_CENTER` | `/admin` | reserved | authenticated |

The public navigation set contains zero NavigationDestination rows. Its only
entries are the sign-in and sign-up entry points, presented as header global
actions (FR-058, A-08 decision).

## Active destination

- Exactly one destination is active at a time (FR-010).
- Only the main content region changes when the active destination changes
  (FR-003).
- The active destination MUST be indicated both visually and semantically
  (accessible current-state announcement).

## Presentation by viewport class

| Viewport class | Navigation presentation | Permanent space |
|----------------|-------------------------|-----------------|
| desktop | Sidebar: expanded or compact rail per preference | Yes |
| tablet | Sidebar: compact by default, expandable per preference | Yes |
| mobile | Overlay drawer, opened by a persistent control | No |

Rules: FR-016–FR-022, FR-062 (first-visit defaults), FR-063 (class overrides
incompatible saved state).

## Module extension contract

To make a future module available, the owning feature:

1. Flips its entry in the feature-availability map from `reserved` to
   `available`.
2. Binds its route to the existing `routePath` slot.
3. Renders its content into the main content region.

No change to the shell's regions, layout, or navigation structure is required
(FR-014, FR-056). The shell MUST NOT contain module business logic (FR-053,
FR-054).

## Stable module identities

```text
ModuleId ::=
    "GENERAL_CHAT"          -- R05 / R10
  | "CONVERSATIONS"         -- R06
  | "PROJECTS"              -- R07
  | "PRIVATE_TEACHER"       -- R19–R22
  | "FILES"                 -- R08
  | "SEARCH"                -- R06
  | "SETTINGS"              -- R03
  | "ADMIN_CONTROL_CENTER"  -- R27 / R28
  | "KNOWLEDGE"             -- R12–R18, reserved seam, no destination in R01
  | "MEMORY"                -- R24, reserved seam, no destination in R01
  | "VOICE"                 -- R25, reserved seam, no destination in R01
  | "AI_MODEL_GATEWAY"      -- R09, reserved seam, no destination in R01
```

These identities are stable for the platform's lifetime and MUST NOT be
renumbered or reused (mirrors the roadmap's stable-ID rule).
