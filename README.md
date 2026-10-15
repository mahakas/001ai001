# MAHAK Web — User Experience Layer (R01)

The web application shell for MAHAK. Implements the R01 platform foundation: a
single application shell with three stable regions, persistent navigation,
responsive behavior, RTL/LTR, Light/Dark/System themes, shell-level
accessibility, shell application states, and the public vs authenticated
shell-mode boundary — as a contract only (no authentication).

## Stack

React 19 · TypeScript 5 · Vite 7 · React Router 7 · Vitest / React Testing
Library / jest-axe / Playwright.

## Shell architecture

```text
src/
├── shell/
│   ├── AppShell.tsx           # the single top-level shell; mounts 3 regions
│   ├── RegionBoundary.tsx     # isolates one region failure (NFR-008)
│   ├── regions/               # SidebarRegion, HeaderRegion, MainRegion (FR-001–004)
│   ├── navigation/            # NavigationRegistry, Sidebar, NavDrawer, reserved destinations
│   ├── states/                # whole-frame + per-region loading, empty, error, unavailable, offline
│   └── accessibility/         # SkipToMain, FocusTrap, AnnouncementProvider
├── providers/                 # Theme, Direction, ViewportClass, ShellMode, ShellPreferences
├── features/                  # reserved module slots + generic extension seam (inert in R01)
├── router/                    # route table bound to the registry ids
├── i18n/                      # fa.json / ar.json / en.json (externalized strings, FR-028)
├── themes/                    # design tokens (Light + Dark), shell layout styles
├── services/                  # ShellApiClient — consumes GET /api/v1/shell with local fallback
└── logger/                    # structured, secret-free browser logging
```

### The three shell regions (FR-001)

- **`sidebar` / `navigation`** — persistent primary navigation; expanded or
  compact rail on desktop/tablet, overlay drawer on mobile.
- **`header`** — banner region hosting product identity and global actions
  (theme, language, sign-in/sign-up, account) — never a substitute for primary
  navigation (FR-004).
- **`main`** — the destination for feature content; the only region whose
  content changes when the active destination changes (FR-003).

Regions are exposed as semantic landmarks (WAI-ARIA `navigation` / `banner` /
`main`) and are addressable via `[data-region="sidebar"|"header"|"main"]`.

### Presentation state (provided by the shell)

| Provider | Owns | Notes |
|----------|------|-------|
| `ThemeProvider` | Light / Dark / System | System follows the device preference; persists to `mahak.shell.theme` |
| `DirectionProvider` | RTL / LTR | Root `dir` attribute is the single source of truth; `fa`/`ar`→rtl, `en`→ltr |
| `ViewportClassProvider` | desktop / tablet / mobile | Width-only resolution at fixed boundaries; single source of responsive behavior |
| `ShellModeProvider` | public / authenticated | Two-valued contract; no authentication |
| `ShellPreferences` | localStorage persistence | Keys `mahak.shell.{theme,direction,sidebar,locale}` |

### Responsive boundaries

- `mobile` `< 768px` → overlay drawer, no permanent sidebar
- `tablet` `768–1023px` → compact rail, expandable
- `desktop` `>= 1024px` → open sidebar by default

Boundaries live in `packages/contracts/src/viewport.ts`.

## Module extension seam (FR-053, FR-056, FR-057)

A future roadmap module attaches to the shell **by registration, not
modification**:

1. Flip its availability in the feature-availability contract from `reserved`
   to `available`.
2. Bind its component via `defineModuleBinding({ moduleId, availability,
   component })` in `apps/web/src/features/<module>/index.ts`.
3. It renders into the main region through the existing `routePath` slot.

The shell's regions, layout, and navigation contract stay untouched.
`apps/web/src/features/` contains eight reserved, inert slots
(`general-chat`, `conversations`, `projects`, `private-teacher`, `files`,
`search`, `settings`, `admin`). `KNOWLEDGE`, `MEMORY`, `VOICE`, and
`AI_MODEL_GATEWAY` are identity-only seams with no slot and no implementation.

## Run

```bash
pnpm dev            # Vite dev server → http://localhost:5173
pnpm preview        # serve the production build
```

The shell resolves autonomously with the API unreachable.

## Validation

```bash
pnpm test               # Vitest — unit + component (jsdom)
pnpm test:e2e           # Playwright — full E2E suite
pnpm test:e2e:ui        # Playwright UI mode
pnpm typecheck          # tsc -b --noEmit
pnpm lint               # ESLint --max-warnings=0
pnpm build              # tsc -b && vite build
```

### E2E projects and suites

| Project | Target | Suites |
|---------|--------|--------|
| `desktop-chromium` | current Chromium (1440×900) | full suite (`responsive`, `direction`, `theme`, `a11y-keyboard`, `zoom`, `offline`, `performance`, `browser-support`) |
| `desktop-firefox` | Firefox | `browser-support` |
| `desktop-webkit` | WebKit/Safari | `browser-support` |
| `mobile-chromium` | Pixel 7 (360×800) | `browser-support` |

Key suites:

- `responsive.spec.ts` — viewport classes, breakpoint crossing, drawer behavior
- `direction.spec.ts` — RTL/LTR mirroring across `fa`/`ar`/`en`
- `theme.spec.ts` — Light/Dark/System application and persistence
- `a11y-keyboard.spec.ts` — keyboard tab order, focus trap, skip-to-main
- `zoom.spec.ts` — 200% text/zoom usability (NFR-007)
- `offline.spec.ts` — offline indication and resilience (FR-051)
- `performance.spec.ts` — NFR-001 (2 s broadband) and NFR-002 (5 s 3G mobile,
  validated against the production build)
- `browser-support.spec.ts` — cross-browser smoke (NFR-004)

> Playwright `globalSetup` builds the production bundle and a `vite preview`
> server on port 5175 backs the NFR-002 validation. The other suites run
> against the Vite dev server on port 5174 via the Playwright `webServer`.

## Contract boundary

The web app consumes exactly one endpoint: `GET /api/v1/shell`, via
`services/ShellApiClient.ts`, with a local fallback so the shell stays fully
functional when the API is unreachable. Shared contract definitions live in
`packages/contracts` and are the single source of truth shared with the API.
