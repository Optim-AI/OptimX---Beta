import type { CommercialBlueprintCore } from "./types";
import type { CommercialShot } from "../shot-planner/types";

/**
 * Full campaign blueprint: director output + planned shots.
 * Source of truth for generation, QC, and timeline assembly.
 *
 * Phase 2 produces CommercialBlueprintCore only.
 * Use blueprintCoreAsBlueprint(core) for an empty shots array until Phase 3.
 */
export interface CommercialBlueprint extends CommercialBlueprintCore {
  shots: CommercialShot[];
}

export function attachShotsToBlueprint(
  core: CommercialBlueprintCore,
  shots: CommercialShot[]
): CommercialBlueprint {
  return { ...core, shots };
}

/** Phase 2 helper: blueprint with no shots yet (Shot Planner is Phase 3). */
export function blueprintCoreAsBlueprint(core: CommercialBlueprintCore): CommercialBlueprint {
  return attachShotsToBlueprint(core, []);
}
