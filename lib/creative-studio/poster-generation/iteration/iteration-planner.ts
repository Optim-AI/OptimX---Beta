/**
 * Phase 8 — Lock presets + Iteration planner
 * Planner produces IterationPlan only — never a final image prompt.
 */

import type {
  EditClassification,
  GenerationSpecification,
  IterationChanges,
  IterationLocks,
  IterationMode,
  IterationCopyChanges,
} from "../types";
import { editClassificationToMode } from "../types";
import type { ClassificationResult } from "./classifier";
import type { IterationClassifierInput } from "./classifier-input";

export type IterationPlan = {
  iterationId: string;
  parentGenerationId: string;
  sourceSpecificationId: string;
  mode: IterationMode;
  classification: EditClassification;
  classificationDetail: {
    target: string;
    rationale: string;
    confidence: number;
  };
  locks: IterationLocks;
  changes: IterationChanges;
  preservedDnaFields: string[];
  changedDnaFields: string[];
  userFacingSummary: string;
  userRequest: string;
};

export function locksForMode(
  mode: IterationMode,
  options: { copyModify?: boolean; referencesMaybe?: boolean } = {}
): IterationLocks {
  const copy: IterationLocks["copy"] = options.copyModify ? "MODIFY" : "LOCKED";
  const references: IterationLocks["references"] = options.referencesMaybe
    ? "MAYBE"
    : "LOCKED";

  switch (mode) {
    case "LOCAL":
      return {
        strategy: "LOCKED",
        concept: "LOCKED",
        product: "LOCKED",
        brand: "LOCKED",
        copy,
        composition: "MODIFY",
        visualTreatment: "LOCKED",
        references: "LOCKED",
      };
    case "DESIGN":
      return {
        strategy: "LOCKED",
        concept: "LOCKED",
        product: "LOCKED",
        brand: "LOCKED",
        copy,
        composition: "MODIFY",
        visualTreatment: "MODIFY",
        references,
      };
    case "CREATIVE":
      return {
        strategy: "LOCKED",
        concept: "MODIFY",
        product: "LOCKED",
        brand: "LOCKED",
        copy,
        composition: "MODIFY",
        visualTreatment: "MODIFY",
        references: "LOCKED",
      };
    case "FULL":
      return {
        strategy: "LOCKED",
        concept: "MODIFY",
        product: "LOCKED",
        brand: "LOCKED",
        copy,
        composition: "MODIFY",
        visualTreatment: "MODIFY",
        references: "MAYBE",
      };
  }
}

function dnaFieldsForLocks(locks: IterationLocks): {
  preserved: string[];
  changed: string[];
} {
  const preserved: string[] = [];
  const changed: string[] = [];

  const map: Array<[keyof IterationLocks, string[]]> = [
    ["concept", ["visualTerritory", "subjectTreatment", "environment", "humanPresence"]],
    ["composition", ["composition", "hierarchy", "visualRhythm"]],
    ["visualTreatment", [
      "photographyStyle",
      "lighting",
      "colorStrategy",
      "typographyStrategy",
      "graphicLanguage",
      "mood",
      "productTreatment",
    ]],
    ["copy", ["hierarchy"]],
    ["product", ["productTreatment"]],
    ["brand", ["colorStrategy"]],
    ["strategy", []],
    ["references", []],
  ];

  for (const [lockKey, fields] of map) {
    if (locks[lockKey] === "LOCKED") {
      preserved.push(...fields);
    } else if (locks[lockKey] === "MODIFY") {
      changed.push(...fields);
    }
  }

  return {
    preserved: [...new Set(preserved)],
    changed: [...new Set(changed)],
  };
}

function inferProductScaleDelta(request: string): number | null {
  const n = request.toLowerCase();
  if (/\bsmaller\b/.test(n) || /\breduce\b/.test(n)) return -0.15;
  if (/\b20%\b/.test(n) || /\btwenty percent\b/.test(n)) return 0.2;
  if (/\bbigger\b/.test(n) || /\blarger\b/.test(n) || /\bhuge\b/.test(n)) {
    return 0.2;
  }
  return null;
}

function buildScenePatches(
  classification: ClassificationResult,
  request: string,
  source: GenerationSpecification
): IterationChanges["scenePatches"] {
  const patches: NonNullable<IterationChanges["scenePatches"]> = {};
  const signals = classification.signals;

  if (classification.mode === "LOCAL") {
    if (signals.wantsProductScale) {
      const delta = inferProductScaleDelta(request);
      const dir =
        delta != null && delta < 0 ? "smaller" : "larger";
      patches.productTreatment = [
        source.scene.productTreatment,
        `ITERATION: Make the product visibly ${dir} than the previous poster (approx ${Math.abs(
          Math.round((delta || 0.2) * 100)
        )}% scale change). Keep product identity identical.`,
      ]
        .filter(Boolean)
        .join(" ");
      patches.composition = [
        source.scene.composition,
        "ITERATION: Adjust composition only as needed to accommodate the product scale change. Keep overall layout.",
      ]
        .filter(Boolean)
        .join(" ");
    } else if (/move.{0,20}cta|cta.{0,20}(lower|higher)/i.test(request)) {
      patches.hierarchy = [
        source.scene.hierarchy,
        "ITERATION: Reposition the CTA as requested. Keep all other copy and layout structure.",
      ]
        .filter(Boolean)
        .join(" ");
    } else if (/remove/i.test(request)) {
      patches.subjectTreatment = [
        source.scene.subjectTreatment,
        `ITERATION: ${request.trim()} — remove only the named element; keep everything else.`,
      ]
        .filter(Boolean)
        .join(" ");
    } else {
      patches.composition = [
        source.scene.composition,
        `ITERATION (local): ${request.trim()}`,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  if (classification.mode === "DESIGN") {
    patches.mood = [
      source.scene.mood,
      `ITERATION (design): ${request.trim()}`,
    ]
      .filter(Boolean)
      .join(" ");
    patches.photographyStyle = [
      source.scene.photographyStyle,
      "Elevate production value; premium commercial finish.",
    ]
      .filter(Boolean)
      .join(" ");
    patches.lighting = [
      source.scene.lighting,
      /dark|luxury/i.test(request)
        ? "Deeper, more luxurious lighting."
        : "Refined lighting supporting a premium feel.",
    ]
      .filter(Boolean)
      .join(" ");
    patches.colorStrategy = [
      source.scene.colorStrategy,
      "Refine palette toward the requested visual tone without changing brand identity.",
    ]
      .filter(Boolean)
      .join(" ");
    patches.typography = [
      source.scene.typography,
      /minimal|cleaner/i.test(request)
        ? "Cleaner, more minimal typography treatment."
        : source.scene.typography,
    ]
      .filter(Boolean)
      .join(" ");
    patches.graphicLanguage = [
      source.scene.graphicLanguage,
      "Update graphic language to match the requested design direction.",
    ]
      .filter(Boolean)
      .join(" ");
    patches.composition = [
      source.scene.composition,
      "Allow composition refinements that support the new visual treatment.",
    ]
      .filter(Boolean)
      .join(" ");
    if (/background/i.test(request)) {
      patches.environment = [
        source.scene.environment,
        `ITERATION: Update background/environment per: ${request.trim()}`,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  if (classification.mode === "CREATIVE" || classification.mode === "FULL") {
    patches.visualStory = [
      classification.mode === "FULL"
        ? "New creative solution within the same campaign strategy."
        : source.scene.visualStory,
      `ITERATION (${classification.mode.toLowerCase()}): ${request.trim()}`,
    ]
      .filter(Boolean)
      .join(" ");
    patches.subjectTreatment = `Re-express subject treatment for: ${request.trim()}`;
    patches.composition =
      "New composition suited to the updated creative expression.";
    patches.humanPresence = /person|someone|people|drinking|workout|gym|using/i.test(
      request
    )
      ? "Human presence integrated naturally with the product."
      : source.scene.humanPresence;
    patches.environment = /gym|workout/i.test(request)
      ? "Active fitness / post-workout environment."
      : source.scene.environment;
    patches.mood =
      classification.mode === "FULL"
        ? `Fresh creative mood for: ${request.trim()}`
        : [source.scene.mood, request.trim()].join(" — ");
    if (classification.mode === "FULL") {
      patches.visualTerritory = source.scene.visualTerritory;
      patches.photographyStyle =
        "Commercial photography aligned to a new creative direction.";
      patches.graphicLanguage = "Renewed graphic language for a new creative solution.";
    } else {
      patches.photographyStyle = [
        source.scene.photographyStyle,
        "Adapt photography to the new creative expression.",
      ]
        .filter(Boolean)
        .join(" ");
      patches.graphicLanguage = [
        source.scene.graphicLanguage,
        "Adapt graphic language to the new creative expression.",
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  return Object.keys(patches).length ? patches : null;
}

function userFacingSummary(mode: IterationMode, target: string): string {
  switch (mode) {
    case "LOCAL":
      return `Update ${target} while preserving product identity, marketing message, and creative direction.`;
    case "DESIGN":
      return "Refine the visual treatment while keeping your marketing message, product, and campaign objective.";
    case "CREATIVE":
      return "Create a new creative direction while keeping your marketing objective and product consistent.";
    case "FULL":
      return "Explore a completely new creative direction. Your product and campaign strategy will remain intact.";
  }
}

function buildCopyChanges(
  classification: ClassificationResult
): IterationCopyChanges | null {
  if (!classification.signals.wantsCopyChange) return null;
  if (classification.signals.copyHeadline) {
    return { headline: classification.signals.copyHeadline };
  }
  return {};
}

export function buildIterationPlan(options: {
  iterationId: string;
  input: IterationClassifierInput;
  classification: ClassificationResult;
}): IterationPlan {
  const { iterationId, input, classification } = options;
  const mode = classification.mode;
  const copyChanges = buildCopyChanges(classification);
  const locks = locksForMode(mode, {
    copyModify: !!classification.signals.wantsCopyChange,
    referencesMaybe: mode === "DESIGN" || mode === "FULL",
  });

  const scenePatches = buildScenePatches(
    classification,
    input.userRequest,
    input.specification
  );

  const productScaleDelta = classification.signals.wantsProductScale
    ? inferProductScaleDelta(input.userRequest)
    : null;

  const changes: IterationChanges = {
    target: classification.target,
    summary: classification.rationale,
    copyChanges,
    scenePatches,
    productScaleDelta,
  };

  const { preserved, changed } = dnaFieldsForLocks(locks);

  return {
    iterationId,
    parentGenerationId: input.parentAsset.generationId,
    sourceSpecificationId: input.specification.id,
    mode,
    classification: classification.classification,
    classificationDetail: classification.detail,
    locks,
    changes,
    preservedDnaFields: preserved,
    changedDnaFields: changed,
    userFacingSummary: userFacingSummary(mode, classification.target),
    userRequest: input.userRequest.trim(),
  };
}

export function planMode(plan: IterationPlan): IterationMode {
  return plan.mode || editClassificationToMode(plan.classification);
}
