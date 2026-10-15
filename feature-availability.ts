/**
 * Feature availability contract — the map a future feature flips to become
 * available without touching the shell (FR-013, FR-050, FR-056).
 *
 * Availability is keyed by ModuleId. In R01 all eight destination module
 * entries are `reserved` (contracts/api.md `features`, data-model.md).
 */

import type { Availability, ModuleId } from "./navigation.js";

/**
 * Availability map keyed by module identity.
 */
export type FeatureAvailability = Readonly<Record<ModuleId, Availability>>;

/**
 * R01's declared availability: every destination module is `reserved`.
 * The four identity-only seams carry no availability entry in R01 because
 * they have no destination and no feature (contracts/api.md).
 */
export const R01_FEATURE_AVAILABILITY: FeatureAvailability = {
  GENERAL_CHAT: "reserved",
  CONVERSATIONS: "reserved",
  PROJECTS: "reserved",
  PRIVATE_TEACHER: "reserved",
  FILES: "reserved",
  SEARCH: "reserved",
  SETTINGS: "reserved",
  ADMIN_CONTROL_CENTER: "reserved",
  // Identity-only future seams — declared so the map is total over the
  // module identities the platform knows, and so a later roadmap feature has
  // a slot to flip. They have no destination in R01 (FR-056, FR-057).
  KNOWLEDGE: "reserved",
  MEMORY: "reserved",
  VOICE: "reserved",
  AI_MODEL_GATEWAY: "reserved",
};

/**
 * The subset of the availability map carried on the wire by
 * `GET /api/v1/shell` — the eight destination modules (contracts/api.md).
 */
export const R01_API_FEATURE_AVAILABILITY: Readonly<Record<string, Availability>> = {
  GENERAL_CHAT: "reserved",
  CONVERSATIONS: "reserved",
  PROJECTS: "reserved",
  PRIVATE_TEACHER: "reserved",
  FILES: "reserved",
  SEARCH: "reserved",
  SETTINGS: "reserved",
  ADMIN_CONTROL_CENTER: "reserved",
};

/**
 * Guard: is the given value a declared availability?
 */
export function isAvailability(value: unknown): value is Availability {
  return value === "reserved" || value === "available";
}
