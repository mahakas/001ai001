/**
 * The reserved module slots R01 defines — the eight NavigationDestination
 * modules. `KNOWLEDGE`, `MEMORY`, `VOICE`, and `AI_MODEL_GATEWAY` are
 * deliberately absent: they are identity-only future seams with no destination
 * and no slot in R01 (contracts/navigation.md, tasks.md T094).
 */

import type { ModuleId } from "@mahak/contracts";

export const R01_MODULE_SLOTS: readonly ModuleId[] = [
  "GENERAL_CHAT",
  "CONVERSATIONS",
  "PROJECTS",
  "PRIVATE_TEACHER",
  "FILES",
  "SEARCH",
  "SETTINGS",
  "ADMIN_CONTROL_CENTER",
];
