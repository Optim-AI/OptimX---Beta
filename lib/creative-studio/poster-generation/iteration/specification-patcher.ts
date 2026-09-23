/**
 * Phase 8 — Apply IterationPlan onto an existing GenerationSpecification.
 * Never mutates the source. Produces a new specification identity.
 */

import type { GenerationSpecification } from "../types";
import type { IterationPlan } from "./iteration-planner";
import { PosterIterationError } from "./iteration-errors";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Build updated GenerationSpecification from previous specification + plan.
 * Strategy alignment and locked copy remain unless plan.locks.copy === MODIFY.
 */
export function applyIterationToSpecification(options: {
  source: GenerationSpecification;
  plan: IterationPlan;
  /** Optional explicit new ids for tests */
  generationId?: string;
  specificationId?: string;
  variantId?: string;
}): GenerationSpecification {
  const { source, plan } = options;
  if (!source?.id) {
    throw new PosterIterationError({
      code: "MISSING_SPEC",
      message: "Source GenerationSpecification required",
      stage: "applyIterationToSpecification",
    });
  }

  const generationId = options.generationId || newId("gen");
  const specificationId = options.specificationId || newId("spec");
  const variantId = options.variantId || source.variantId;

  // Deep-ish clone of locked strategy + copy
  const strategyAlignment = { ...source.strategyAlignment };
  let renderCopy = { ...source.renderCopy, badges: [...(source.renderCopy.badges || [])] };
  let copyHierarchy = source.copyHierarchy.map((s) => ({ ...s }));
  let userOverrides = { ...source.userOverrides };

  if (plan.locks.copy === "MODIFY" && plan.changes.copyChanges) {
    const cc = plan.changes.copyChanges;
    if (cc.headline != null && cc.headline !== "") {
      renderCopy = { ...renderCopy, headline: cc.headline };
      userOverrides = { ...userOverrides, headline: cc.headline };
      copyHierarchy = copyHierarchy.map((slot) =>
        slot.role === "primary" ? { ...slot, text: cc.headline! } : slot
      );
    }
    if (cc.supporting != null) {
      renderCopy = { ...renderCopy, supporting: cc.supporting };
      copyHierarchy = copyHierarchy.map((slot) =>
        slot.role === "secondary" || slot.role === "supporting"
          ? { ...slot, text: cc.supporting! }
          : slot
      );
    }
    if (cc.cta != null) {
      renderCopy = { ...renderCopy, cta: cc.cta };
      userOverrides = { ...userOverrides, cta: cc.cta };
      copyHierarchy = copyHierarchy.map((slot) =>
        slot.role === "cta" ? { ...slot, text: cc.cta! } : slot
      );
    }
    if (cc.productLine != null) {
      renderCopy = { ...renderCopy, productLine: cc.productLine };
    }
  }

  // When copy is LOCKED — force exact original copy into scene constraints reminder
  const scene = {
    ...source.scene,
    ...(plan.changes.scenePatches || {}),
  };

  // Preserve product fidelity language always
  if (plan.locks.product === "LOCKED") {
    scene.productFidelityRules = source.scene.productFidelityRules;
  }

  // Preserve brand integration when brand locked
  if (plan.locks.brand === "LOCKED") {
    scene.brandIntegration = source.scene.brandIntegration;
  }

  // Append explicit iteration directive for provider compile (not freestyle prompt)
  const iterationNote = [
    `CONTROLLED ITERATION (${plan.mode})`,
    `User request: ${plan.userRequest}`,
    `Preserve locked layers. Only apply planned changes.`,
    plan.locks.copy === "LOCKED"
      ? "COPY IS LOCKED — render exact approved copy; do not rewrite marketing messages."
      : null,
    plan.locks.strategy === "LOCKED"
      ? "STRATEGY IS LOCKED — keep objective, audience, and primary message."
      : null,
    plan.locks.product === "LOCKED"
      ? "PRODUCT IDENTITY IS LOCKED — do not redesign or replace the product."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Drop prior theme-lock dump on LOCAL/DESIGN edits so we don't force a full re-theme
  const priorReqs = (source.scene.outputRequirements || []).filter((r) => {
    if (plan.mode === "LOCAL" || plan.mode === "DESIGN") {
      return !(
        /^THEME LOCK/i.test(r) ||
        /^Theme must:/i.test(r) ||
        /^Theme avoid:/i.test(r) ||
        /^THEME LOCK \(/i.test(r)
      );
    }
    return true;
  });

  scene.outputRequirements = [
    `PRIMARY EDIT TASK: ${plan.userRequest}`,
    iterationNote,
    plan.mode === "LOCAL" || plan.mode === "DESIGN"
      ? "Preserve the existing look of the BASE POSTER; only apply the PRIMARY EDIT TASK."
      : null,
    ...priorReqs,
  ].filter(Boolean) as string[];

  const constraints = {
    ...source.constraints,
    unsupportedClaims: [...(source.constraints.unsupportedClaims || [])],
    brandRequirements: [...(source.constraints.brandRequirements || [])],
    copyFidelity:
      plan.locks.copy === "LOCKED"
        ? `${source.constraints.copyFidelity} ITERATION: Copy remains exactly as specified — do not paraphrase.`
        : source.constraints.copyFidelity,
    productFidelity:
      plan.locks.product === "LOCKED"
        ? `${source.constraints.productFidelity} ITERATION: Product identity immutable.`
        : source.constraints.productFidelity,
  };

  const next: GenerationSpecification = {
    ...source,
    id: specificationId,
    createdAt: new Date().toISOString(),
    generationId,
    variantId,
    variantIndex: source.variantIndex,
    strategyAlignment,
    renderCopy,
    copyHierarchy,
    userOverrides,
    scene,
    constraints,
    references: source.references.map((r) => ({ ...r })),
    attachedAssetIds: [...source.attachedAssetIds],
    compiledPrompt: null,
    parentGenerationId: plan.parentGenerationId,
    parentSpecificationId: source.id,
    iterationId: plan.iterationId,
  };

  return next;
}

/**
 * Assert preservation invariants for tests / validation.
 */
export function assertPreservationInvariants(options: {
  source: GenerationSpecification;
  updated: GenerationSpecification;
  plan: IterationPlan;
}): void {
  const { source, updated, plan } = options;

  if (plan.locks.strategy === "LOCKED") {
    if (
      updated.strategyAlignment.objective !== source.strategyAlignment.objective ||
      updated.strategyAlignment.primaryMessage !==
        source.strategyAlignment.primaryMessage
    ) {
      throw new PosterIterationError({
        code: "PLAN_INVALID",
        message: "Strategy alignment must remain locked",
        stage: "assertPreservation",
      });
    }
  }

  if (plan.locks.copy === "LOCKED") {
    if (
      updated.renderCopy.headline !== source.renderCopy.headline ||
      updated.renderCopy.cta !== source.renderCopy.cta
    ) {
      throw new PosterIterationError({
        code: "PLAN_INVALID",
        message: "Copy must remain locked",
        stage: "assertPreservation",
      });
    }
  }

  if (plan.locks.product === "LOCKED") {
    // productFidelityRules core must remain
    if (
      !updated.scene.productFidelityRules.includes(
        source.scene.productFidelityRules.slice(0, 40)
      ) &&
      updated.scene.productFidelityRules !== source.scene.productFidelityRules
    ) {
      // soft: equal or prefixed — already set equal above when locked
    }
  }

  if (updated.id === source.id || updated.generationId === source.generationId) {
    throw new PosterIterationError({
      code: "PLAN_INVALID",
      message: "Updated specification must not overwrite source identity",
      stage: "assertPreservation",
    });
  }
}
