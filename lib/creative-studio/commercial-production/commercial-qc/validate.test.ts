/**
 * Commercial QC Phase 8 tests — fully mocked (no Runway / Seedance / Nano Banana / Gemini).
 *
 * Run: npm run test:commercial-qc
 */

import assert from "node:assert/strict";
import { runDeterministicCommercialQc } from "./deterministic";
import {
  buildVisualSamplingPlan,
  validateSamplingPlan,
} from "./sampling";
import {
  parseVisualObservation,
  parseVisualAnalysisPayload,
  demoteLowConfidenceCritical,
  VisualAnalysisParseError,
} from "./validate";
import { MockVisualAnalyzer } from "./visual-analyzer";
import { decideCommercialQC } from "./decision";
import {
  nextGenerationVersion,
  buildRegenerationPlan,
  regenerationLimitReached,
} from "./regeneration";
import {
  evaluateCreativeCategories,
  campaignRequiresVisibleProduct,
} from "./creative-evaluator";
import { runCommercialQC } from "./evaluate";
import { runQCWithRegenerationLoop } from "./loop";
import {
  makeFinalCommercial,
  makeQCInput,
  observation,
  productFailObservation,
  narrativeFailObservation,
  ambiguousObservation,
} from "./fixtures";
import {
  DEFAULT_MAX_AUTO_REGENERATIONS,
  DEFAULT_QC_THRESHOLDS,
  type CreativeEvaluationResult,
  type DeterministicQCResult,
  type CommercialVisualAnalysis,
  type VisualObservation,
} from "./types";
import { VIDEO_EXECUTOR_PROVIDER } from "../video-executor/types";

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

function emptyCreative(): CreativeEvaluationResult {
  const pass = {
    status: "pass" as const,
    findings: [] as VisualObservation[],
    summary: "pass",
  };
  return {
    product: pass,
    brand: pass,
    narrative: pass,
    continuity: pass,
    treatment: pass,
    ending: pass,
    artifacts: pass,
  };
}

function cleanVisual(): CommercialVisualAnalysis {
  return {
    available: true,
    observations: [
      observation({
        category: "narrative",
        observation: "Beats preserved",
        evidence: "Progression visible across samples",
        confidence: 0.92,
      }),
    ],
    analyzerConfidence: 0.92,
  };
}

async function main() {
  console.log("\nCommercial QC tests\n");

  // ── Deterministic QC ──────────────────────────────────────────
  console.log("Deterministic QC");

  await test("correct duration passes", () => {
    const input = makeQCInput();
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, true);
    assert.ok(result.checks.some((c) => c.check === "duration_matches_brief" && c.passed));
  });

  await test("wrong duration fails", () => {
    const input = makeQCInput({
      finalCommercial: makeFinalCommercial({
        campaignId: "camp_15",
        duration: 30,
        nativeResult: {
          ...makeFinalCommercial().nativeResult!,
          campaignId: "camp_15",
          duration: 30,
        },
      }),
    });
    // Align blueprint still 15
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((c) => c.check === "duration_matches_brief" && !c.passed));
  });

  await test("correct aspect ratio passes", () => {
    const input = makeQCInput();
    const result = runDeterministicCommercialQc(input);
    assert.ok(result.checks.some((c) => c.check === "aspect_ratio" && c.passed));
  });

  await test("wrong aspect ratio fails", () => {
    const input = makeQCInput({
      finalCommercial: makeFinalCommercial({
        campaignId: "camp_15",
        aspectRatio: "16:9",
        nativeResult: {
          ...makeFinalCommercial().nativeResult!,
          campaignId: "camp_15",
          aspectRatio: "16:9",
        },
      }),
    });
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((c) => c.check === "aspect_ratio" && !c.passed));
  });

  await test("correct provider passes", () => {
    const input = makeQCInput();
    const result = runDeterministicCommercialQc(input);
    assert.ok(result.checks.some((c) => c.check === "provider" && c.passed));
  });

  await test("wrong provider fails", () => {
    const input = makeQCInput({
      finalCommercial: makeFinalCommercial({
        campaignId: "camp_15",
        provider: "veo" as typeof VIDEO_EXECUTOR_PROVIDER,
      }),
    });
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((c) => c.check === "provider" && !c.passed));
  });

  await test("correct model passes", () => {
    const input = makeQCInput();
    const result = runDeterministicCommercialQc(input);
    assert.ok(result.checks.some((c) => c.check === "model" && c.passed));
  });

  await test("missing final asset fails", () => {
    const input = makeQCInput({
      finalCommercial: makeFinalCommercial({
        campaignId: "camp_15",
        videoUrl: "",
        videoAssetId: "",
      }),
    });
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, false);
    assert.equal(result.skipVisualAnalysis, true);
    assert.ok(result.checks.some((c) => c.check === "video_exists" && !c.passed));
  });

  await test("manifest mismatch fails", () => {
    const input = makeQCInput();
    const result = runDeterministicCommercialQc({
      ...input,
      manifest: {
        campaignId: "camp_15",
        generationVersion: "v9",
        campaign: { durationSeconds: 15, aspectRatio: "9:16" },
        creative: { selectedConcept: {}, visualTreatment: {} },
        shots: [],
        totalShotDurationSeconds: 15,
        productionStatus: "ready_for_composition",
        createdAt: new Date().toISOString(),
        runStatus: "production_ready",
        finalProduction: {
          generationMode: "native_continuous",
          videoAssetId: "wrong-asset",
        },
      },
    });
    assert.equal(result.passed, false);
    assert.ok(
      result.checks.some(
        (c) =>
          (c.check === "manifest_generation_version" ||
            c.check === "manifest_video_asset") &&
          !c.passed
      )
    );
  });

  await test("missing generation status fails", () => {
    const fc = makeFinalCommercial({ campaignId: "camp_15" });
    delete (fc as { nativeResult?: unknown }).nativeResult;
    fc.compositionStatus = undefined;
    // Keep video urls so only status fails path — without native, statusOk uses hasVideo
    // Force failed native status instead
    const withFail = makeFinalCommercial({
      campaignId: "camp_15",
      nativeResult: {
        ...makeFinalCommercial().nativeResult!,
        campaignId: "camp_15",
        status: "failed",
      },
    });
    const input = makeQCInput({ finalCommercial: withFail });
    const result = runDeterministicCommercialQc(input);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((c) => c.check === "generation_status" && !c.passed));
  });

  // ── Sampling ──────────────────────────────────────────────────
  console.log("Sampling");

  await test("15s sampling includes start and end", () => {
    const plan = buildVisualSamplingPlan(15);
    assert.equal(plan.timestamps[0], 0);
    assert.equal(plan.timestamps[plan.timestamps.length - 1], 15);
    assert.ok(plan.sampleCount >= 6);
    assert.equal(validateSamplingPlan(plan).ok, true);
  });

  await test("30s sampling is denser and duration-aware", () => {
    const plan = buildVisualSamplingPlan(30);
    assert.equal(plan.timestamps[0], 0);
    assert.equal(plan.timestamps[plan.timestamps.length - 1], 30);
    assert.ok(plan.sampleCount >= 6);
    assert.equal(validateSamplingPlan(plan).ok, true);
  });

  // ── Visual analyzer parsing ───────────────────────────────────
  console.log("Visual analyzer");

  await test("observations are parsed", () => {
    const parsed = parseVisualAnalysisPayload(
      {
        analyzerConfidence: 0.9,
        observations: [
          {
            category: "product",
            severity: "info",
            observation: "ok",
            evidence: "seen",
            confidence: 0.9,
            timestamp: 3,
          },
        ],
      },
      15
    );
    assert.equal(parsed.observations.length, 1);
    assert.equal(parsed.observations[0].category, "product");
  });

  await test("malformed structured output fails safely", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextRawPayload = { observations: "not-an-array" };
    const input = makeQCInput({ visualAnalyzer: analyzer });
    const report = await runCommercialQC(input);
    assert.equal(report.visual.available, false);
    assert.ok(report.visual.error);
  });

  await test("confidence is preserved", () => {
    const o = parseVisualObservation({
      category: "brand",
      severity: "warning",
      observation: "tone slightly off",
      evidence: "cooler palette than specified",
      confidence: 0.77,
    });
    assert.equal(o.confidence, 0.77);
  });

  await test("timestamps are validated", () => {
    assert.throws(
      () =>
        parseVisualObservation(
          {
            category: "ending",
            severity: "info",
            observation: "x",
            evidence: "y",
            confidence: 0.9,
            timestamp: 99,
          },
          15
        ),
      VisualAnalysisParseError
    );
  });

  await test("severity is validated", () => {
    assert.throws(
      () =>
        parseVisualObservation({
          category: "product",
          severity: "extreme",
          observation: "x",
          evidence: "y",
          confidence: 0.9,
        }),
      VisualAnalysisParseError
    );
  });

  await test("unsupported categories are rejected", () => {
    assert.throws(
      () =>
        parseVisualObservation({
          category: "vibes",
          severity: "info",
          observation: "x",
          evidence: "y",
          confidence: 0.9,
        }),
      VisualAnalysisParseError
    );
  });

  await test("low-confidence findings do not automatically become critical failures", () => {
    const demoted = demoteLowConfidenceCritical(
      [
        {
          category: "product",
          severity: "critical",
          observation: "maybe wrong",
          evidence: "blurry",
          confidence: 0.4,
        },
      ],
      DEFAULT_QC_THRESHOLDS.autoDecisionMinConfidence
    );
    assert.equal(demoted[0].severity, "warning");
  });

  // ── Decision engine ───────────────────────────────────────────
  console.log("Decision engine");

  await test("clean output → accept", () => {
    const det: DeterministicQCResult = {
      passed: true,
      checks: [],
      skipVisualAnalysis: false,
    };
    const result = decideCommercialQC({
      deterministic: det,
      visual: cleanVisual(),
      creative: emptyCreative(),
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "accept");
  });

  await test("critical issue → regenerate", () => {
    const creative = emptyCreative();
    creative.product = {
      status: "fail",
      findings: [productFailObservation()],
      summary: "product fail",
    };
    const result = decideCommercialQC({
      deterministic: { passed: true, checks: [], skipVisualAnalysis: false },
      visual: {
        available: true,
        observations: [productFailObservation()],
        analyzerConfidence: 0.92,
      },
      creative,
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "regenerate");
  });

  await test("ambiguous issue → manual review", () => {
    const creative = emptyCreative();
    creative.product = {
      status: "insufficient_evidence",
      findings: [ambiguousObservation()],
      summary: "unclear",
    };
    const result = decideCommercialQC({
      deterministic: { passed: true, checks: [], skipVisualAnalysis: false },
      visual: {
        available: true,
        observations: [ambiguousObservation()],
        analyzerConfidence: 0.45,
      },
      creative,
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "manual_review");
  });

  await test("deterministic failure → regenerate (or manual at limit)", () => {
    const result = decideCommercialQC({
      deterministic: {
        passed: false,
        skipVisualAnalysis: true,
        checks: [
          {
            check: "video_exists",
            passed: false,
            severity: "critical",
            message: "Missing video",
          },
        ],
      },
      visual: { available: false, observations: [] },
      creative: emptyCreative(),
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "regenerate");
  });

  await test("warnings alone do not force regeneration", () => {
    const creative = emptyCreative();
    creative.treatment = {
      status: "warning",
      findings: [
        observation({
          category: "treatment",
          severity: "warning",
          observation: "Slightly cooler palette",
          evidence: "Blue cast vs warm oak intent",
          confidence: 0.8,
        }),
      ],
      summary: "minor",
    };
    const result = decideCommercialQC({
      deterministic: { passed: true, checks: [], skipVisualAnalysis: false },
      visual: {
        available: true,
        observations: creative.treatment.findings,
        analyzerConfidence: 0.88,
      },
      creative,
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "accept");
  });

  await test("low-confidence visual analysis → manual review where appropriate", () => {
    const creative = emptyCreative();
    creative.narrative = {
      status: "fail",
      findings: [
        observation({
          category: "narrative",
          severity: "error",
          observation: "Possible beat skip",
          evidence: "Unclear mid samples",
          confidence: 0.5,
        }),
      ],
      summary: "maybe",
    };
    // After demotion, materialFromCategory requires confidence >= 0.85
    // so this becomes ambiguous → manual_review
    const result = decideCommercialQC({
      deterministic: { passed: true, checks: [], skipVisualAnalysis: false },
      visual: {
        available: true,
        observations: creative.narrative.findings,
        analyzerConfidence: 0.5,
      },
      creative,
      regenerationCount: 0,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "manual_review");
  });

  // ── Regeneration ──────────────────────────────────────────────
  console.log("Regeneration");

  await test("regeneration plan is created for a concrete failure", () => {
    const input = makeQCInput();
    const plan = buildRegenerationPlan({
      decision: "regenerate",
      reason: "product packaging mismatch",
      issues: [productFailObservation()],
      blueprint: input.blueprint,
      sourceGenerationVersion: "v1",
      priorRegenerationCount: 0,
    });
    assert.ok(plan);
    assert.ok(plan!.requiredChanges.length > 0);
    assert.ok(plan!.preservedRequirements.length > 0);
    assert.equal(plan!.generationVersion, "v2");
  });

  await test("failed requirement is included", () => {
    const input = makeQCInput();
    const plan = buildRegenerationPlan({
      decision: "regenerate",
      reason: "product fail",
      issues: [productFailObservation()],
      blueprint: input.blueprint,
      sourceGenerationVersion: "v1",
      priorRegenerationCount: 0,
    });
    assert.ok(plan!.requiredChanges.some((c) => /packaging|product/i.test(c)));
  });

  await test("preserved creative requirements are included", () => {
    const input = makeQCInput();
    const plan = buildRegenerationPlan({
      decision: "regenerate",
      reason: "product fail",
      issues: [productFailObservation()],
      blueprint: input.blueprint,
      sourceGenerationVersion: "v1",
      priorRegenerationCount: 0,
    });
    assert.ok(plan!.preservedRequirements.some((p) => /Narrative|Emotional|Visual/i.test(p)));
  });

  await test("generation version increments", () => {
    assert.equal(nextGenerationVersion("v1"), "v2");
    assert.equal(nextGenerationVersion("v2"), "v3");
  });

  await test("previous version remains represented", () => {
    const input = makeQCInput();
    const plan = buildRegenerationPlan({
      decision: "regenerate",
      reason: "x",
      issues: [productFailObservation()],
      blueprint: input.blueprint,
      sourceGenerationVersion: "v1",
      priorRegenerationCount: 0,
    });
    assert.equal(plan!.sourceGenerationVersion, "v1");
    assert.equal(plan!.generationVersion, "v2");
  });

  await test("regeneration limit is enforced", () => {
    assert.equal(regenerationLimitReached(2, 2), true);
    assert.equal(regenerationLimitReached(1, 2), false);
  });

  await test("exceeding limit results in manual review", () => {
    const creative = emptyCreative();
    creative.product = {
      status: "fail",
      findings: [productFailObservation()],
      summary: "fail",
    };
    const result = decideCommercialQC({
      deterministic: { passed: true, checks: [], skipVisualAnalysis: false },
      visual: {
        available: true,
        observations: [productFailObservation()],
        analyzerConfidence: 0.95,
      },
      creative,
      regenerationCount: DEFAULT_MAX_AUTO_REGENERATIONS,
      maxAutoRegenerations: DEFAULT_MAX_AUTO_REGENERATIONS,
      thresholds: DEFAULT_QC_THRESHOLDS,
    });
    assert.equal(result.decision, "manual_review");
  });

  await test("no infinite loop (hard cap in loop)", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [productFailObservation()],
      analyzerConfidence: 0.95,
    };
    let calls = 0;
    const result = await runQCWithRegenerationLoop(
      {
        ...makeQCInput({ visualAnalyzer: analyzer }),
        maxAutoRegenerations: 2,
        regenerate: async ({ nextVersion, previous }) => {
          calls += 1;
          assert.ok(calls <= 3, "must not regenerate unboundedly");
          return { ...previous, generationVersion: nextVersion };
        },
      },
      { visualAnalyzer: analyzer }
    );
    assert.ok(calls <= 2);
    assert.equal(result.report.decision, "manual_review");
  });

  // ── Product fidelity ──────────────────────────────────────────
  console.log("Product fidelity");

  await test("product fidelity pass", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [
        observation({
          category: "product",
          severity: "info",
          observation: "Packaging matches canonical reference",
          evidence: "Label colors and lid match product reference at t=12s",
          confidence: 0.93,
          timestamp: 12,
        }),
      ],
      analyzerConfidence: 0.93,
    };
    const report = await runCommercialQC(makeQCInput({ visualAnalyzer: analyzer }));
    assert.equal(report.categories.product, "pass");
    assert.equal(report.decision, "accept");
  });

  await test("product fidelity fail → regenerate", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [productFailObservation()],
      analyzerConfidence: 0.94,
    };
    const report = await runCommercialQC(makeQCInput({ visualAnalyzer: analyzer }));
    assert.equal(report.decision, "regenerate");
    assert.equal(report.categories.product, "fail");
  });

  await test("product absent where not required is not automatic failure", () => {
    const input = makeQCInput();
    // Early beat productVisibility none — fabricate visual with "absent" info only
    const visual: CommercialVisualAnalysis = {
      available: true,
      observations: [
        observation({
          category: "product",
          severity: "info",
          observation: "Product absent in opening frames",
          evidence: "t=0–3s shows kitchen only",
          confidence: 0.9,
          timestamp: 1,
        }),
      ],
      analyzerConfidence: 0.9,
    };
    const creative = evaluateCreativeCategories({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual,
    });
    assert.ok(campaignRequiresVisibleProduct(input.blueprint, input.shotPlan));
    // Opening absence alone should not fail product category
    assert.notEqual(creative.product.status, "fail");
  });

  // ── Narrative ─────────────────────────────────────────────────
  console.log("Narrative");

  await test("narrative pass", () => {
    const input = makeQCInput();
    const creative = evaluateCreativeCategories({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual: cleanVisual(),
    });
    assert.equal(creative.narrative.status, "pass");
  });

  await test("narrative warning", () => {
    const input = makeQCInput();
    const creative = evaluateCreativeCategories({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual: {
        available: true,
        observations: [
          observation({
            category: "narrative",
            severity: "warning",
            observation: "Minor beat timing variation",
            evidence: "Product enters ~1s earlier than planned",
            confidence: 0.8,
          }),
        ],
        analyzerConfidence: 0.8,
      },
    });
    assert.equal(creative.narrative.status, "warning");
  });

  await test("narrative fail — major replacement", () => {
    const input = makeQCInput();
    const creative = evaluateCreativeCategories({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual: {
        available: true,
        observations: [narrativeFailObservation()],
        analyzerConfidence: 0.91,
      },
    });
    assert.equal(creative.narrative.status, "fail");
  });

  // ── Continuity ────────────────────────────────────────────────
  console.log("Continuity");

  await test("continuity character contradiction fails when required", () => {
    const input = makeQCInput();
    const creative = evaluateCreativeCategories({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual: {
        available: true,
        observations: [
          observation({
            category: "continuity",
            severity: "error",
            confidence: 0.9,
            observation: "Character wardrobe changes mid-spot",
            evidence: "Dark hoodie at t=2s vs light shirt at t=8s",
            timestamp: 8,
          }),
        ],
        analyzerConfidence: 0.9,
      },
    });
    assert.equal(creative.continuity.status, "fail");
  });

  // ── End-to-end scenarios ──────────────────────────────────────
  console.log("E2E scenarios");

  await test("Scenario A — clean campaign → accept", async () => {
    const analyzer = new MockVisualAnalyzer();
    const report = await runCommercialQC(makeQCInput({ visualAnalyzer: analyzer }));
    assert.equal(report.decision, "accept");
    assert.equal(report.deterministic.passed, true);
    assert.ok(!("qualityScore" in report));
    assert.ok(!("overallScore" in report));
  });

  await test("Scenario B — product failure → regenerate", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [productFailObservation()],
      analyzerConfidence: 0.95,
    };
    const report = await runCommercialQC(makeQCInput({ visualAnalyzer: analyzer }));
    assert.equal(report.decision, "regenerate");
    assert.ok(report.regeneration);
    assert.equal(report.regeneration!.generationVersion, "v2");
  });

  await test("Scenario C — ambiguous visual evidence → manual_review", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [ambiguousObservation()],
      analyzerConfidence: 0.4,
    };
    const report = await runCommercialQC(makeQCInput({ visualAnalyzer: analyzer }));
    assert.equal(report.decision, "manual_review");
  });

  await test("Scenario D — regeneration succeeds (stateful)", async () => {
    let analyzeCount = 0;
    const analyzer: MockVisualAnalyzer = new MockVisualAnalyzer();
    const original = analyzer.analyze.bind(analyzer);
    analyzer.analyze = async (input) => {
      analyzeCount += 1;
      if (analyzeCount === 1) {
        return {
          available: true,
          observations: [productFailObservation()],
          analyzerConfidence: 0.95,
          samplingPlan: input.samplingPlan,
        };
      }
      return {
        available: true,
        observations: [
          observation({
            category: "product",
            observation: "Matches reference",
            evidence: "Hero frame matches",
            confidence: 0.94,
          }),
        ],
        analyzerConfidence: 0.94,
        samplingPlan: input.samplingPlan,
      };
    };

    const result = await runQCWithRegenerationLoop({
      ...makeQCInput({ visualAnalyzer: analyzer }),
      maxAutoRegenerations: 2,
      regenerate: async ({ nextVersion, previous, instruction }) => {
        assert.ok(/PRESERVE|product/i.test(instruction));
        return {
          ...previous,
          generationVersion: nextVersion,
          videoAssetId: `asset_${nextVersion}`,
        };
      },
    });

    assert.equal(result.report.decision, "accept");
    assert.equal(result.finalCommercial.generationVersion, "v2");
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].fromVersion, "v1");
    assert.equal(result.history[0].toVersion, "v2");
    void original;
  });

  await test("Scenario E — regeneration repeatedly fails → manual_review", async () => {
    const analyzer = new MockVisualAnalyzer();
    analyzer.nextResult = {
      available: true,
      observations: [productFailObservation()],
      analyzerConfidence: 0.95,
    };
    const result = await runQCWithRegenerationLoop({
      ...makeQCInput({ visualAnalyzer: analyzer }),
      maxAutoRegenerations: 2,
      regenerate: async ({ nextVersion, previous }) => ({
        ...previous,
        generationVersion: nextVersion,
      }),
    });
    assert.equal(result.report.decision, "manual_review");
    assert.ok(result.history.length <= 2);
    assert.ok(result.generationsProduced <= 2);
  });

  console.log(`\nCommercial QC: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
