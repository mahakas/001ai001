/**
 * ShellPreferences — browser-local persistence of shell presentation choices
 * (FR-008, FR-032, FR-060, FR-061, FR-062).
 *
 * Keys are namespaced verbatim from data-model.md (`ShellPreferencesRecord`):
 *
 * - `mahak.shell.theme`     — `light` | `dark` | `system`
 * - `mahak.shell.direction` — `rtl` | `ltr`
 * - `mahak.shell.sidebar`   — `expanded` | `collapsed`
 * - `mahak.shell.locale`    — `fa` | `ar` | `en`
 *
 * Persistence scope is the same browser; there is no cross-device sync (A-05),
 * no server, no account, and no credential (research.md R-09). Later features
 * MUST use their own namespaced keys and MUST NOT write shell keys (FR-057).
 */

import type {
  Direction,
  Locale,
  ThemeMode,
} from "@mahak/contracts";
import {
  isDirection,
  isLocale,
  isThemeMode,
} from "@mahak/contracts";

/** localStorage keys, verbatim from data-model.md. */
export const SHELL_PREFERENCE_KEYS = {
  theme: "mahak.shell.theme",
  direction: "mahak.shell.direction",
  sidebar: "mahak.shell.sidebar",
  locale: "mahak.shell.locale",
} as const;

/** The persisted sidebar state. */
export type SidebarState = "expanded" | "collapsed";

/** Namespace prefix so future features can be audited against shell keys. */
export const SHELL_KEY_NAMESPACE = "mahak.shell.";

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // localStorage can throw in private-mode or sandboxed contexts; the shell
    // must remain fully functional without persistence (client resilience).
    return null;
  }
}

function read(key: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    /* ignore quota or security errors — preferences are best-effort */
  }
}

function remove(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * True when nothing shell-namespaced has been saved yet — i.e. this is a first
 * visit, so the first-visit defaults apply (FR-060, FR-062).
 */
export function isFirstVisit(): boolean {
  const store = storage();
  if (!store) return true;
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith(SHELL_KEY_NAMESPACE)) return false;
    }
  } catch {
    /* ignore */
  }
  return true;
}

/* --- Theme (FR-032, FR-060) --------------------------------------------- */

export function getSavedTheme(): ThemeMode | null {
  const value = read(SHELL_PREFERENCE_KEYS.theme);
  return value && isThemeMode(value) ? value : null;
}

export function setSavedTheme(theme: ThemeMode): void {
  write(SHELL_PREFERENCE_KEYS.theme, theme);
}

/* --- Direction (FR-061) ------------------------------------------------- */

export function getSavedDirection(): Direction | null {
  const value = read(SHELL_PREFERENCE_KEYS.direction);
  return value && isDirection(value) ? value : null;
}

export function setSavedDirection(direction: Direction): void {
  write(SHELL_PREFERENCE_KEYS.direction, direction);
}

/* --- Sidebar state (FR-008, FR-062) ------------------------------------- */

export function getSavedSidebarState(): SidebarState | null {
  const value = read(SHELL_PREFERENCE_KEYS.sidebar);
  return value === "expanded" || value === "collapsed" ? value : null;
}

export function setSavedSidebarState(state: SidebarState): void {
  write(SHELL_PREFERENCE_KEYS.sidebar, state);
}

/* --- Locale ------------------------------------------------------------- */

export function getSavedLocale(): Locale | null {
  const value = read(SHELL_PREFERENCE_KEYS.locale);
  return value && isLocale(value) ? value : null;
}

export function setSavedLocale(locale: Locale): void {
  write(SHELL_PREFERENCE_KEYS.locale, locale);
}

/**
 * Remove every shell-namespaced key. Used only by tests and by an explicit
 * "reset shell preferences" affordance; never called by shell behavior itself.
 */
export function clearShellPreferences(): void {
  for (const key of Object.values(SHELL_PREFERENCE_KEYS)) {
    remove(key);
  }
}
