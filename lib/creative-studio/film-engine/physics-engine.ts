/**
 * OptimX Film Engine — Physical World Simulator (physical reasoning).
 *
 * This is NOT a literal physics sim. It validates cause-and-effect across the
 * scene graph using the object state machine, and enriches shots with the
 * mechanical steps and material behavior they must show. Output is advisory:
 * it returns issues + an enriched graph; it never silently discards intent.
 */

import {
  detectContainerProfile,
  materialBehavior,
  stateAllowsConsumption,
  stateAllowsDispensing,
  stateIndex,
  type ContainerProfile,
} from "./object-state-machine";
import { flattenShots } from "./types";
import type {
  CreativeDirection,
  SceneGraph,
  Shot,
  TrackedObject,
  ValidationIssue,
  ValidationResult,
} from "./types";

const DISPENSE_VERB = /pour|dispens|spray|squeez|scoop|appl|mist|extrud|drip|drop/i;
const CONSUME_VERB = /sip|drink|swallow|gulp|taste/i;

/**
 * Validate physical continuity of the product across the shot timeline.
 * Detects: dispensing before opening, state regressions, missing mechanical steps.
 */
export function validatePhysics(
  graph: SceneGraph,
  direction: CreativeDirection
): ValidationResult {
  const profile = detectContainerProfile(direction.productName, direction.category);
  const shots = flattenShots(graph);
  const issues: ValidationIssue[] = [];

  let lastKnownStateIdx = -1;

  shots.forEach((shot) => {
    const product = shot.objects.find((o) => o.id === "product");
    const desc = `${shot.visualDescription} ${shot.frameIntent.purpose}`;

    // 1. Dispensing must follow an opening action.
    if (DISPENSE_VERB.test(desc)) {
      const state = product?.state ?? "";
      if (product && !stateAllowsDispensing(profile, state)) {
        issues.push({
          severity: "error",
          shotIndex: shot.index,
          objectId: "product",
          message: `Shot ${shot.index + 1} shows dispensing but ${profile.label} is in state "${state}".`,
          fix: `Insert an opening action first: ${profile.sequence.join(" → ")}.`,
        });
      }
      if (!product) {
        issues.push({
          severity: "warning",
          shotIndex: shot.index,
          message: `Shot ${shot.index + 1} implies dispensing but no product object is tracked.`,
          fix: `Track the ${direction.productName} object and its container state in this shot.`,
        });
      }
    }

    // 1b. Drinking/sipping must follow cap removal (RTD shake bottles).
    if (CONSUME_VERB.test(desc)) {
      const state = product?.state ?? "";
      if (product && !stateAllowsConsumption(profile, state)) {
        issues.push({
          severity: "error",
          shotIndex: shot.index,
          objectId: "product",
          message: `Shot ${shot.index + 1} shows drinking/sipping but ${profile.label} is in state "${state}".`,
          fix: `Unscrew and remove the cap before any sip: ${profile.sequence.join(" → ")}.`,
        });
      }
    }

    // 2. State must not regress (re-closing without reason).
    if (product) {
      const idx = stateIndex(profile, product.state);
      if (idx >= 0) {
        if (idx < lastKnownStateIdx) {
          issues.push({
            severity: "warning",
            shotIndex: shot.index,
            objectId: "product",
            message: `Container state regressed to "${product.state}" after a later state — breaks continuity.`,
            fix: "Keep the container progressing forward (or motivate the reset explicitly).",
          });
        }
        lastKnownStateIdx = Math.max(lastKnownStateIdx, idx);
      }
    }
  });

  return { ok: issues.every((i) => i.severity !== "error"), issues };
}

/**
 * Enrich the graph in place with mechanical steps + material behavior notes so
 * the renderer can express realistic product interaction. Returns the graph for
 * chaining. Pure-ish: it only adds notes, never removes shots.
 */
export function enrichWithPhysics(graph: SceneGraph, direction: CreativeDirection): SceneGraph {
  const profile = detectContainerProfile(direction.productName, direction.category);

  for (const scene of graph.scenes) {
    for (const shot of scene.shots) {
      const product = shot.objects.find((o) => o.id === "product");
      if (!product) continue;
      annotateProduct(product, shot, profile);
    }
  }
  return graph;
}

function annotateProduct(product: TrackedObject, shot: Shot, profile: ContainerProfile): void {
  const behavior = materialBehavior(product.material);
  const desc = `${shot.visualDescription} ${shot.frameIntent.purpose}`.toLowerCase();
  const mechanical = DISPENSE_VERB.test(desc)
    ? ` Mechanical steps: ${profile.sequence.join(" → ")}.`
    : "";
  const note = `Material behaves: ${behavior}.${mechanical}`;
  product.notes = product.notes ? `${product.notes} ${note}` : note;
}

/** Compact, prompt-ready physical-realism block derived from the graph. */
export function physicsPromptDigest(graph: SceneGraph, direction: CreativeDirection): string {
  const profile = detectContainerProfile(direction.productName, direction.category);
  const material = graph.scenes
    .flatMap((s) => s.shots)
    .flatMap((s) => s.objects)
    .find((o) => o.id === "product")?.material;

  return [
    `Physical realism: ${profile.label} opens via ${profile.sequence.join(" → ")}.`,
    material && material !== "none" ? `Material: ${materialBehavior(material)}.` : "",
    "Respect gravity, momentum, and cause→effect. No liquid before opening; no state teleporting.",
  ]
    .filter(Boolean)
    .join(" ");
}
