/**
 * Shot dependency graph for campaign orchestration.
 */

import type { CommercialShot, ShotPlan } from "../shot-planner/types";
import { CampaignOrchestratorError } from "./types";

export interface ShotDependencyGraph {
  /** shotId → ids that must complete before this shot. */
  dependencies: Map<string, string[]>;
  /** Topological order (editorial-safe: prefers sequence when ties). */
  topologicalOrder: string[];
}

export function collectShotDependencies(shot: CommercialShot): string[] {
  const deps = new Set<string>();
  for (const id of shot.continuity?.continuesFromShotIds || []) {
    if (id && id !== shot.id) deps.add(id);
  }
  for (const id of shot.referenceRequirements?.previousShotReferenceIds || []) {
    if (id && id !== shot.id) deps.add(id);
  }
  const fromState = shot.productState?.transitionsFromShotId;
  if (fromState && fromState !== shot.id) deps.add(fromState);
  return [...deps];
}

export function buildShotDependencyGraph(plan: ShotPlan): ShotDependencyGraph {
  const shots = [...plan.shots].sort((a, b) => a.sequence - b.sequence);
  const ids = new Set(shots.map((s) => s.id));
  const dependencies = new Map<string, string[]>();

  for (const shot of shots) {
    const deps = collectShotDependencies(shot).filter((d) => ids.has(d));
    dependencies.set(shot.id, deps);
  }

  // Continuity links from plan metadata
  for (const link of plan.continuityLinks || []) {
    if (!ids.has(link.toShotId) || !ids.has(link.fromShotId)) continue;
    const existing = dependencies.get(link.toShotId) || [];
    if (!existing.includes(link.fromShotId) && link.fromShotId !== link.toShotId) {
      dependencies.set(link.toShotId, [...existing, link.fromShotId]);
    }
  }

  // Detect cycles + topological sort (Kahn)
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const [id, deps] of dependencies) {
    indegree.set(id, deps.length);
    for (const d of deps) {
      dependents.get(d)!.push(id);
    }
  }

  const queue = shots
    .filter((s) => (indegree.get(s.id) || 0) === 0)
    .map((s) => s.id);
  const topologicalOrder: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    topologicalOrder.push(id);
    for (const child of dependents.get(id) || []) {
      const next = (indegree.get(child) || 0) - 1;
      indegree.set(child, next);
      if (next === 0) queue.push(child);
    }
  }

  if (topologicalOrder.length !== ids.size) {
    throw new CampaignOrchestratorError(
      "DEPENDENCY_GRAPH_INVALID",
      "Circular shot dependency detected in ShotPlan",
      "dependency_resolution",
      {
        resolved: topologicalOrder,
        unresolved: [...ids].filter((id) => !topologicalOrder.includes(id)),
      },
      false
    );
  }

  return { dependencies, topologicalOrder };
}
