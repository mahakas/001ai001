/**
 * Direction and locale contracts.
 *
 * Contract (contracts/theme.md, data-model.md):
 *
 * ```text
 * Direction   ::= "rtl" | "ltr"
 * Locale      ::= "fa" | "ar" | "en"
 * ```
 *
 * Locale → direction map (verbatim from data-model.md): `fa → rtl`,
 * `ar → rtl`, `en → ltr`.
 */

/**
 * The two layout directions.
 */
export type Direction = "rtl" | "ltr";

/**
 * The interface languages the shell supports in R01.
 */
export type Locale = "fa" | "ar" | "en";

/**
 * The exhaustive set of directions.
 */
export const DIRECTION_VALUES: readonly Direction[] = ["rtl", "ltr"];

/**
 * The exhaustive set of supported locales.
 */
export const LOCALE_VALUES: readonly Locale[] = ["fa", "ar", "en"];

/**
 * Locale → direction map, verbatim from data-model.md (FR-023, FR-061).
 *
 * The active language is the single source of truth for the initial direction
 * when no saved direction preference exists (FR-061).
 */
export const LOCALE_DIRECTION_MAP: Readonly<Record<Locale, Direction>> = {
  fa: "rtl",
  ar: "rtl",
  en: "ltr",
};

/**
 * R01's default locale when no saved preference and no platform default exist.
 */
export const DEFAULT_LOCALE: Locale = "fa";

/**
 * Resolve the direction for a locale. Unknown locales fall back to `ltr`.
 */
export function resolveDirectionForLocale(locale: string): Direction {
  return LOCALE_DIRECTION_MAP[locale as Locale] ?? "ltr";
}

/**
 * Guard: is the given value one of the two directions?
 */
export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTION_VALUES as string[]).includes(value);
}

/**
 * Guard: is the given value one of the supported locales?
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_VALUES as string[]).includes(value);
}
