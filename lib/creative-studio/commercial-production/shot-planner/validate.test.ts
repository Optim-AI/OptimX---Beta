/**
 * Shot Planner validation + planner unit tests (no live AI).
 *
 * Run: npm run test:shot-planner
 *
 * Actual keyframe/image generation is NOT implemented in Phase 3.
 * Nano Banana is NOT called in Phase 3.
 * Runway/Seedance is NOT called in Phase 3.
 */

import assert from "node:assert/strict";
import { makeValidBlueprint } from "../commercial-director/fixtures";
import type { StructuredGenerationRequest, StructuredGenerationResult, StructuredGenerator } from "../commercial-director/llm";
import { defaultStrategyForId } from "../generation/types";
import { assembleShotPlanFromDraft, normalizeShotDurations, type ShotPlannerDraft } from "./assemble";
import {
  makeProtein30sBlueprint,
  makeValid15sShotPlan,
  makeValidProtein30sShotPlan,
} from "./fixtures";
import { DefaultShotPlanner } from "./planner";
import type { ShotPlan } from "./types";
import { validateShotPlan } from "./validate";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(err);
    });
}

class MockStructuredGenerator implements StructuredGenerator {
  readonly modelId = "mock-shot-planner-model";
  constructor(private readonly draft: ShotPlannerDraft) {}
  async generateJson<T>(
    _request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    return { data: this.draft as T, model: this.modelId, rawText: JSON.stringify(this.draft) };
  }
}

function planToDraft(plan: ShotPlan): ShotPlannerDraft {
  return {
    shots: plan.shots.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      durationSeconds: s.durationSeconds,
      role: s.role,
      beatIds: s.beatIds,
      shotWhy: s.shotWhy,
      storyBeat: s.storyBeat,
      visualDescription: s.visualDescription,
      subject: s.subject,
      productVisibility: s.productVisibility,
      productVisibilityReason: s.productVisibilityReason,
      environment: s.environment,
      lens: s.lens,
      framing: s.framing,
      cameraMovement: s.cameraMovement,
      cameraHeight: s.cameraHeight,
      cameraAngle: s.cameraAngle,
      depthOfField: s.depthOfField,
      subjectDistance: s.subjectDistance,
      lighting: s.lighting,
      composition: s.composition,
      transitionIn: s.transitionIn,
      transitionOut: s.transitionOut,
      generationStrategyId: s.generationStrategy.id,
      generationStrategyRationale: s.generationStrategy.rationale,
      referenceRequirements: s.referenceRequirements,
      continuesFromShotIds: s.continuity.continuesFromShotIds,
      mustMatch: s.continuity.mustMatch,
      mustMatchDimensions: s.continuity.mustMatchDimensions,
      allowedChanges: s.continuity.allowedChanges,
      characterContinuity: s.characterContinuity,
      productState: s.productState,
      artifactRisks: s.artifactRisks,
      qcRequirements: s.qcRequirements,
      qcNotes: s.qcNotes,
      generationRequired: s.generationRequired,
      estimatedComplexity: s.estimatedComplexity,
      referenceRequired: s.referenceRequired,
    })),
    continuityLinks: plan.continuityLinks,
  };
}

async function main() {
  console.log("\nShot Planner tests\n");

  await test("1. valid 15-second shot plan", () => {
    const plan = makeValid15sShotPlan();
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, true, format(result));
    assert.equal(plan.totalDurationSeconds, 15);
  });

  await test("2. valid 30-second shot plan (protein fixture)", () => {
    const plan = makeValidProtein30sShotPlan();
    const result = validateShotPlan(plan, 30);
    assert.equal(result.ok, true, format(result));
    assert.equal(plan.totalDurationSeconds, 30);
    assert.ok(plan.shots.length >= 5);
  });

  await test("3. invalid duration total", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[0].durationSeconds = 10;
    plan.totalDurationSeconds = plan.shots.reduce((s, x) => s + x.durationSeconds, 0);
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path === "totalDurationSeconds"));
  });

  await test("4. duplicate sequence", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[1].sequence = 1;
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("sequence")));
  });

  await test("5. missing sequence", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[2].sequence = 4; // gap at 3 when ordered
    // sequences become 1,2,4,4 after — also duplicate. Force gap: 1,2,4,5
    plan.shots[3].sequence = 5;
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("sequence")));
  });

  await test("6. nonexistent continuity reference", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[1].continuity.continuesFromShotIds = ["shot-does-not-exist"];
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes("nonexistent")));
  });

  await test("7. missing shotWhy", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[0].shotWhy = "";
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("shotWhy")));
  });

  await test("8. missing generation strategy", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[0].generationStrategy = undefined as never;
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("generationStrategy")));
  });

  await test("9. invalid reference requirements", () => {
    const plan = makeValid15sShotPlan();
    plan.shots[0].referenceRequirements = {
      ...plan.shots[0].referenceRequirements,
      strategyType: "not_a_real_type" as never,
      productReferenceReason: "",
    };
    const result = validateShotPlan(plan, 15);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("referenceRequirements")));
  });

  await test("10. product hero requiring product reference", () => {
    const plan = makeValidProtein30sShotPlan();
    const hero = plan.shots.find((s) => s.role === "product_hero");
    assert.ok(hero);
    assert.equal(hero!.referenceRequirements.productReferenceRequired, true);
    assert.equal(hero!.generationStrategy.id, "keyframe-first");

    hero!.referenceRequirements.productReferenceRequired = false;
    const result = validateShotPlan(plan, 30);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.path.includes("productReferenceRequired")),
      format(result)
    );
  });

  await test("11. character continuity", () => {
    const plan = makeValidProtein30sShotPlan();
    const withChar = plan.shots.filter((s) => (s.characterContinuity?.length || 0) > 0);
    assert.ok(withChar.length >= 2);
    assert.ok(withChar[0].characterContinuity![0].mustMatch.includes("face"));
    assert.ok(plan.shots[1].continuity.continuesFromShotIds.includes("shot-1"));
    assert.ok((plan.shots[1].continuity.mustMatchDimensions || []).includes("character"));
  });

  await test("12. motion-graphics shot", () => {
    const plan = makeValid15sShotPlan();
    const mg = plan.shots.find((s) => s.generationStrategy.id === "motion-graphics");
    assert.ok(mg);
    assert.equal(mg!.role, "end_card");
    assert.equal(mg!.generationStrategy.prefersCompositing, true);
  });

  await test("13. mixed generation strategies", () => {
    const plan = makeValidProtein30sShotPlan();
    const ids = new Set(plan.shots.map((s) => s.generationStrategy.id));
    assert.ok(ids.has("text-to-video"));
    assert.ok(ids.has("keyframe-first"));
    assert.ok(ids.size >= 3, `expected mixed strategies, got ${[...ids].join(",")}`);
  });

  await test("14. delayed product reveal", () => {
    const plan = makeValidProtein30sShotPlan();
    assert.equal(plan.shots[0].productVisibility, "none");
    assert.equal(plan.shots[1].productVisibility, "none");
    const firstProduct = plan.shots.findIndex((s) => s.productVisibility !== "none");
    assert.ok(firstProduct >= 2, "product should appear after opening shots");
    assert.ok(plan.shots.some((s) => s.productState?.state === "closed_package"));
    assert.ok(plan.shots.some((s) => s.productState?.state === "preparing"));
    assert.ok(plan.shots.some((s) => s.productState?.state === "hero_display"));
  });

  await test("duration normalization within tolerance", () => {
    const { durations, normalized } = normalizeShotDurations([4.1, 4, 5, 6, 5, 5.8], 30);
    const sum = durations.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 30) < 0.05, `sum=${sum}`);
    assert.equal(normalized, true);
  });

  await test("planner with mock generator produces validated 30s plan", async () => {
    const blueprint = makeProtein30sBlueprint();
    const draft = planToDraft(makeValidProtein30sShotPlan());
    const planner = new DefaultShotPlanner({
      generator: new MockStructuredGenerator(draft),
      log: () => undefined,
    });
    const plan = await planner.plan(blueprint);
    assert.equal(plan.campaignId, blueprint.campaignId);
    assert.equal(plan.campaignDuration, 30);
    assert.equal(plan.meta?.validationPassed, true);
    assert.equal(plan.meta?.model, "mock-shot-planner-model");
    assert.ok(plan.meta!.keyframeFirstCount >= 1);
    assert.ok(plan.meta!.textToVideoCount >= 1);
  });

  await test("assemble attaches blueprint continuity lock", () => {
    const blueprint = makeValidBlueprint({ campaignId: "camp_x", campaignDuration: 15 });
    const draft = planToDraft(makeValid15sShotPlan());
    const { plan } = assembleShotPlanFromDraft(blueprint, draft);
    assert.equal(plan.campaignId, "camp_x");
    assert.ok(plan.continuityLock.product);
  });

  await test("defaultStrategyForId keyframe-first flags", () => {
    const s = defaultStrategyForId("keyframe-first", "test rationale here");
    assert.equal(s.requiresKeyframe, true);
    assert.equal(s.requiresProductReference, true);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

function format(result: { issues: Array<{ path: string; message: string }> }): string {
  return result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
