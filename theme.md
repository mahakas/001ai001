# Contract: Theme and Direction

**Branch**: `001-platform-app-shell` | **Date**: 2026-09-24 | **Traces to**: FR-023–FR-033, FR-060, FR-061

## ThemeMode

```text
ThemeMode      ::= "light" | "dark" | "system"
ResolvedTheme  ::= "light" | "dark"
```

Exactly three selectable modes (FR-029). `system` resolves to a
`ResolvedTheme` by subscribing to the device appearance preference.

### Rules

1. A theme change applies to every shell region — sidebar, header, main
   content, and mobile drawer — with no unthemed region (FR-030).
2. In `system` mode, the shell follows device-preference changes at runtime
   without a manual change (FR-031). Devices exposing no preference fall back
   to `light` (A-07).
3. The selection persists across reloads within the same browser (FR-032).
4. First visit with no saved preference defaults to `system` (FR-060).
5. No theme disables any navigation or shell control (FR-033).
6. Text and essential graphics meet ≥ 4.5:1 contrast in both resolved themes
   (FR-041).
7. States (loading, empty, error, unavailable, offline) honor the active
   theme (FR-052).

## Direction

```text
Direction   ::= "rtl" | "ltr"
Locale      ::= "fa" | "ar" | "en"
```

### Locale → direction map

| Locale | Direction |
|--------|-----------|
| `fa` | `rtl` |
| `ar` | `rtl` |
| `en` | `ltr` |

### Rules

1. The active direction is set on the application root and is the single
   source of truth for layout direction (FR-024).
2. The active language is the single source of truth for the initial
   direction when no saved preference exists, so the two cannot diverge at
   first paint (FR-061).
3. Switching direction mirrors every region — sidebar side, header layout,
   main content — with no hidden, clipped, or overlapped region (FR-025).
4. Sidebar collapse/expand and drawer open/close behave identically in both
   directions, anchored to the correct side (FR-026).
5. Changing direction requires no reload and no re-navigation (FR-027).
6. All user-visible shell text is externalized string resources keyed by
   locale (FR-028).

## Externalized strings

Shell labels MUST be referenced by key, never embedded as literals. The R01
resource set covers the three locales: `fa.json`, `ar.json`, `en.json` under
`apps/web/src/i18n/`. Resource keys include at minimum the product name, the
region labels, the eight destination labels, the sign-in/sign-up entry
points, and the message text for every shell state (loading, empty, error,
unavailable, offline).

Localization management (preferences UI, pluralization, formatting) is owned
by R03; R01 requires only the externalized resources and correct directional
behavior.
