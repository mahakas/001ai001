/**
 * Theme contracts — selectable theme modes and the resolved theme that is
 * actually rendered.
 *
 * Contract (contracts/theme.md):
 *
 * ```text
 * ThemeMode      ::= "light" | "dark" | "system"
 * ResolvedTheme  ::= "light" | "dark"
 * ```
 *
 * Exactly three selectable modes (FR-029). `system` resolves to a
 * `ResolvedTheme` by subscribing to the device appearance preference; OSes
 * exposing no preference fall back to `light` (A-07).
 */

/**
 * The three selectable theme modes.
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * The theme that is actually rendered.
 */
export type ResolvedTheme = "light" | "dark";

/**
 * The exhaustive set of selectable theme modes.
 */
export const THEME_MODE_VALUES: readonly ThemeMode[] = ["light", "dark", "system"];

/**
 * The exhaustive set of resolved themes.
 */
export const RESOLVED_THEME_VALUES: readonly ResolvedTheme[] = ["light", "dark"];

/**
 * R01's first-visit default theme mode (FR-060, A-05).
 */
export const DEFAULT_THEME_MODE: ThemeMode = "system";

/**
 * Fallback resolved theme when the OS exposes no appearance preference (A-07).
 */
export const DEFAULT_RESOLVED_THEME: ResolvedTheme = "light";

/**
 * Guard: is the given value one of the three selectable theme modes?
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODE_VALUES as string[]).includes(value);
}

/**
 * Guard: is the given value one of the two resolved themes?
 */
export function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return typeof value === "string" && (RESOLVED_THEME_VALUES as string[]).includes(value);
}
