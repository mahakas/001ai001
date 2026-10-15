/**
 * Reserved module extension seam (FR-014, FR-053, FR-054, FR-056, FR-057).
 *
 * This is the *generic only* mechanism by which a future product module binds
 * to its reserved module identity and renders into the main region — without
 * touching shell regions, the navigation contract, or the layout
 * (contracts/navigation.md, "Module extension contract").
 *
 * To make a module available, the owning feature:
 *
 * 1. flips its entry in the feature-availability map from `reserved` to
 *    `available`;
 * 2. binds its route to the existing `routePath` slot;
 * 3. renders its content into the main content region.
 *
 * R01 creates reserved directory slots for exactly the eight
 * NavigationDestination modules. `KNOWLEDGE`, `MEMORY`, `VOICE`, and
 * `AI_MODEL_GATEWAY` remain identity-only future seams with no slot, no
 * destination, and no implementation here (data-model.md, tasks.md T094).
 */

// The binding registry lives in its own module so slots import it directly with
// no import cycle (see ./registry.ts).
export {
  defineModuleBinding,
  getModuleBinding,
  isModuleAvailable,
  listModuleBindings,
  type ModuleBinding,
} from "./registry.js";

// Import the reserved directory slots so every future module identity is
// declared exactly once. Each slot is inert in R01 (availability `reserved`,
// no component, no business logic).
import "./general-chat/index.js";
import "./conversations/index.js";
import "./projects/index.js";
import "./private-teacher/index.js";
import "./files/index.js";
import "./search/index.js";
import "./settings/index.js";
import "./admin/index.js";

export { R01_MODULE_SLOTS } from "./slots.js";
