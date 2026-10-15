/**
 * R02 — Identity, Authentication & Authorization contracts.
 *
 * This module carries only shared type definitions consumed by the web client
 * (via AuthProvider / ShellModeProvider) and by the api when building shell
 * responses. No runtime business logic lives here (plan.md boundary rule 3,
 * FR-053, FR-056, FR-057).
 */

import type { ShellMode } from "./shell-mode.js";

/**
 * R02 roles. Exactly two roles exist in R02 (FR-022, FR-025). The set is
 * extensible — future roadmaps add values without modifying this type.
 */
export type Role = "user" | "admin";

/**
 * Authenticated shell context exposed to UI components via AuthProvider.
 * Mirrors the shape that ShellModeProvider + AuthService jointly populate.
 */
export interface AuthContextValue {
  readonly shellMode: ShellMode;
  readonly isAuthenticated: boolean;
  /** Null while shellMode is "public". */
  readonly role: Role | null;
  /**
   * Opaque invite token stored at registration (FR-029, FR-032).
   * Null when no token was supplied or it failed server-side validation.
   * Not rendered in any R02 UI (FR-031).
   */
  readonly organizationReference: string | null;
  /** Switches shell mode; typically invoked by sign-in / sign-out flows. */
  setShellMode: (mode: ShellMode) => void;
}

/**
 * Guard: is the given value one of the declared R02 roles?
 */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (["user", "admin"] as readonly string[]).includes(value);
}
