/**
 * Phase 8 — Iteration plan / record validation
 */

import {
  EDIT_CLASSIFICATIONS,
  ITERATION_LOCK_STATES,
  ITERATION_MODES,
  type IterationLocks,
  type PosterIterationRecord,
} from "../types";
import type { IterationPlan } from "./iteration-planner";
import { PosterIterationError } from "./iteration-errors";

function isLockState(v: unknown): boolean {
  return (
    typeof v === "string" &&
    (ITERATION_LOCK_STATES as readonly string[]).includes(v)
  );
}

export function assertIterationLocks(locks: unknown): locks is IterationLocks {
  if (!locks || typeof locks !== "object") return false;
  const l = locks as IterationLocks;
  return (
    isLockState(l.strategy) &&
    isLockState(l.concept) &&
    isLockState(l.product) &&
    isLockState(l.brand) &&
    isLockState(l.copy) &&
    isLockState(l.composition) &&
    isLockState(l.visualTreatment) &&
    isLockState(l.references)
  );
}

export function validateIterationPlan(plan: IterationPlan): void {
  if (!plan.iterationId || !plan.parentGenerationId || !plan.sourceSpecificationId) {
    throw new PosterIterationError({
      code: "PLAN_INVALID",
      message: "Iteration plan missing required ids",
      stage: "validateIterationPlan",
    });
  }
  if (!(ITERATION_MODES as readonly string[]).includes(plan.mode)) {
    throw new PosterIterationError({
      code: "PLAN_INVALID",
      message: `Invalid mode: ${plan.mode}`,
      stage: "validateIterationPlan",
    });
  }
  if (!(EDIT_CLASSIFICATIONS as readonly string[]).includes(plan.classification)) {
    throw new PosterIterationError({
      code: "PLAN_INVALID",
      message: `Invalid classification: ${plan.classification}`,
      stage: "validateIterationPlan",
    });
  }
  if (!assertIterationLocks(plan.locks)) {
    throw new PosterIterationError({
      code: "PLAN_INVALID",
      message: "Invalid iteration locks",
      stage: "validateIterationPlan",
    });
  }
  if (!plan.userRequest?.trim()) {
    throw new PosterIterationError({
      code: "VALIDATION",
      message: "User request required on plan",
      stage: "validateIterationPlan",
    });
  }
}

export function iterationRecordFromPlan(
  plan: IterationPlan,
  status: PosterIterationRecord["status"] = "planned"
): PosterIterationRecord {
  return {
    id: plan.iterationId,
    request: {
      id: `req_${plan.iterationId}`,
      sessionId: "", // filled by run-for-session
      targetGenerationId: plan.parentGenerationId,
      userInstruction: plan.userRequest,
      classification: plan.classification,
      createdAt: new Date().toISOString(),
    },
    classification: plan.classification,
    mode: plan.mode,
    classificationDetail: plan.classificationDetail,
    locks: plan.locks,
    changes: plan.changes,
    sourceSpecificationId: plan.sourceSpecificationId,
    parentGenerationId: plan.parentGenerationId,
    resultingGenerationId: null,
    resultingSpecificationId: null,
    preservedDnaFields: plan.preservedDnaFields,
    changedDnaFields: plan.changedDnaFields,
    status,
    userFacingSummary: plan.userFacingSummary,
    createdAt: new Date().toISOString(),
    errorMessage: null,
  };
}
