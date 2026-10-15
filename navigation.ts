/**
 * Navigation contract — stable module identities and the destination registry.
 *
 * Contract (contracts/navigation.md, data-model.md). These identities are
 * stable for the platform's lifetime and MUST NOT be renumbered or reused
 * (mirrors the roadmap's stable-ID rule).
 */

/**
 * The reserved identity of a future product module. Exactly twelve values:
 * the eight that carry a navigation destination in R01, plus the four
 * identity-only future seams — `KNOWLEDGE`, `MEMORY`, `VOICE`, and
 * `AI_MODEL_GATEWAY` — which have no destination in R01 (FR-011, FR-053,
 * FR-056; data-model.md "ModuleId").
 */
export type ModuleId =
  | "GENERAL_CHAT"
  | "CONVERSATIONS"
  | "PROJECTS"
  | "PRIVATE_TEACHER"
  | "FILES"
  | "SEARCH"
  | "SETTINGS"
  | "ADMIN_CONTROL_CENTER"
  | "KNOWLEDGE"
  | "MEMORY"
  | "VOICE"
  | "AI_MODEL_GATEWAY";

/**
 * The exhaustive set of module identities.
 */
export const MODULE_ID_VALUES: readonly ModuleId[] = [
  "GENERAL_CHAT",
  "CONVERSATIONS",
  "PROJECTS",
  "PRIVATE_TEACHER",
  "FILES",
  "SEARCH",
  "SETTINGS",
  "ADMIN_CONTROL_CENTER",
  "KNOWLEDGE",
  "MEMORY",
  "VOICE",
  "AI_MODEL_GATEWAY",
];

/**
 * The eight module identities that carry a reserved navigation destination in
 * R01 (FR-012). The remaining four identities are reserved seams with no
 * destination (data-model.md).
 */
export const DESTINATION_MODULE_IDS: readonly ModuleId[] = [
  "GENERAL_CHAT",
  "CONVERSATIONS",
  "PROJECTS",
  "PRIVATE_TEACHER",
  "FILES",
  "SEARCH",
  "SETTINGS",
  "ADMIN_CONTROL_CENTER",
];

/**
 * The module identities that remain identity-only future seams in R01 — no
 * destination, no feature slot, no implementation (FR-054, FR-056, FR-057;
 * tasks.md T094).
 */
export const IDENTITY_ONLY_MODULE_IDS: readonly ModuleId[] = [
  "KNOWLEDGE",
  "MEMORY",
  "VOICE",
  "AI_MODEL_GATEWAY",
];

/**
 * Whether a feature is implemented behind a destination.
 */
export type Availability = "reserved" | "available";

/**
 * Which shell mode a destination is presented in.
 */
export type VisibilityScope = "public" | "authenticated";

/**
 * One addressable place in the shell's navigation.
 *
 * ```text
 * NavigationDestination ::=
 *   id              : String
 *   moduleId        : ModuleId
 *   labelKey        : String
 *   routePath       : String
 *   availability    : "reserved" | "available"
 *   visibilityScope : "public" | "authenticated"
 * ```
 */
export interface NavigationDestination {
  /** Stable identifier, independent of label text and language (FR-011). */
  readonly id: string;
  /** The reserved module this destination hosts; one destination per module (FR-012). */
  readonly moduleId: ModuleId;
  /** Key into the externalized string resources; never a hard-coded string (FR-028). */
  readonly labelKey: string;
  /** The route slot the destination binds to. */
  readonly routePath: string;
  /** `reserved` in R01 for every module destination (FR-013, FR-050). */
  readonly availability: Availability;
  /** `authenticated` for all eight module destinations (FR-015, FR-058). */
  readonly visibilityScope: VisibilityScope;
}

/**
 * The reserved destination registry for R01 (contracts/navigation.md,
 * data-model.md). Exactly one destination per future product module, all
 * `reserved` and all `authenticated`.
 */
export const R01_RESERVED_DESTINATIONS: readonly NavigationDestination[] = [
  { id: "dest.general-chat", moduleId: "GENERAL_CHAT", labelKey: "dest.general-chat", routePath: "/chat", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.conversations", moduleId: "CONVERSATIONS", labelKey: "dest.conversations", routePath: "/conversations", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.projects", moduleId: "PROJECTS", labelKey: "dest.projects", routePath: "/projects", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.private-teacher", moduleId: "PRIVATE_TEACHER", labelKey: "dest.private-teacher", routePath: "/teacher", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.files", moduleId: "FILES", labelKey: "dest.files", routePath: "/files", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.search", moduleId: "SEARCH", labelKey: "dest.search", routePath: "/search", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.settings", moduleId: "SETTINGS", labelKey: "dest.settings", routePath: "/settings", availability: "reserved", visibilityScope: "authenticated" },
  { id: "dest.admin", moduleId: "ADMIN_CONTROL_CENTER", labelKey: "dest.admin", routePath: "/admin", availability: "reserved", visibilityScope: "authenticated" },
];

/**
 * Guard: is the given value a recognized module identity?
 */
export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && (MODULE_ID_VALUES as string[]).includes(value);
}
