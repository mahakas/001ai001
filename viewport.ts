/**
 * ViewportClass — the responsive class the shell operates in.
 *
 * Contract (data-model.md): exactly one of `mobile`, `tablet`, `desktop` is
 * active (FR-016). Resolution uses viewport width only, against fixed
 * boundaries — pointer type and device hints are never consulted (FR-016,
 * A-02 decision, research.md R-06/R-13).
 *
 * The boundary constants live here so the application and the test matrix
 * share one definition and cannot drift (plan.md, "A-02").
 */

/**
 * The three viewport classes.
 */
export type ViewportClass = "mobile" | "tablet" | "desktop";

/**
 * The exhaustive set of viewport classes.
 */
export const VIEWPORT_CLASS_VALUES: readonly ViewportClass[] = [
  "mobile",
  "tablet",
  "desktop",
];

/**
 * Fixed class boundaries, in CSS pixels (A-02):
 *
 * - mobile   `< 768px`
 * - tablet   `768–1023px`
 * - desktop  `≥ 1024px`
 */
export const VIEWPORT_BOUNDARIES = {
  /** Widths below this value are the mobile class. */
  mobileMaxExclusive: 768,
  /** Widths at/above this value are the desktop class. */
  desktopMin: 1024,
} as const;

/**
 * Resolve exactly one viewport class from a viewport width.
 *
 * Width-only resolution: a wide touch device resolves to `desktop` and a
 * narrow desktop window resolves to `mobile` (FR-016). Pointer type and device
 * hints are ignored by construction — this function takes only a width.
 */
export function resolveViewportClass(width: number): ViewportClass {
  if (width < VIEWPORT_BOUNDARIES.mobileMaxExclusive) return "mobile";
  if (width < VIEWPORT_BOUNDARIES.desktopMin) return "tablet";
  return "desktop";
}
