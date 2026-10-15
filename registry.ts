/**
 * The generic module-binding registry for the extension seam (FR-014, FR-053,
 * FR-056). Kept in its own module so reserved slots import it directly and no
 * import cycle is created with `features/index.ts`.
 *
 * R01 registers no module implementation — every binding is `reserved`.
 */

import type { ComponentType } from "react";
import type { Availability, ModuleId } from "@mahak/contracts";

/** A future module's binding to its reserved identity. */
export interface ModuleBinding {
  readonly moduleId: ModuleId;
  /** `reserved` until the owning roadmap feature ships. */
  readonly availability: Availability;
  /** The component rendered into the main region once available. Absent while
   * the module is reserved — R01 defines no module implementations. */
  readonly component?: ComponentType;
}

const bindings = new Map<ModuleId, ModuleBinding>();

/**
 * Register (or replace) a module binding. Called by a future module's reserved
 * slot when it ships — never by the shell.
 */
export function defineModuleBinding(binding: ModuleBinding): void {
  bindings.set(binding.moduleId, binding);
}

/** Look up the binding for a reserved module identity. */
export function getModuleBinding(moduleId: ModuleId): ModuleBinding | undefined {
  return bindings.get(moduleId);
}

/** Every registered binding (tests and tooling). */
export function listModuleBindings(): ModuleBinding[] {
  return Array.from(bindings.values());
}

/** True when a module identity has been bound and marked available. */
export function isModuleAvailable(moduleId: ModuleId): boolean {
  return bindings.get(moduleId)?.availability === "available";
}
