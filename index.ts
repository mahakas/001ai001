/**
 * MAHAK shared contract seam — the single source of truth for shell-mode,
 * navigation-destination, and feature-availability contracts shared between
 * the web client and the api (FR-053, FR-056, research.md R-04).
 *
 * This package is dependency-free and contains no runtime business logic;
 * it is a contract definition package only (plan.md boundary rule 3).
 */

export * from "./shell-mode.js";
export * from "./navigation.js";
export * from "./viewport.js";
export * from "./theme.js";
export * from "./direction.js";
export * from "./feature-availability.js";
export * from "./auth-context.js";
