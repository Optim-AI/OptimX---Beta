/**
 * Commercial Director validation + director unit tests (no live AI).
 *
 * Run: npm run test:commercial-director
 */

import assert from "node:assert/strict";
import { assembleBlueprintFromDraft, type DirectorDraft } from "./assemble";
import { DefaultCommercialDirector } from "./director";
import { makeValidBlueprint, makeValidBrief } from "./fixtures";
import type { StructuredGenerationRequest, StructuredGenerationResult, StructuredGenerator } from "./llm";
import { validateCommercialBlueprint } from "./validate";

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
  readonly modelId = "mock-director-model";
  constructor(private readonly draft: DirectorDraft) {}
  async generateJson<T>(
    _request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    return {
      data: this.draft as T,
      model: this.modelId,
      rawText: JSON.stringify(this.draft),
    };
  }
}

function draftFromValidBlueprint(): DirectorDraft {
  const b = makeValidBlueprint();
  return {
    exploredConcepts: b.exploredConcepts,
    selectedConceptId: b.exploredConcepts?.[0]?.id,
    rationale: b.selectedConcept.campaignFitRationale,
    selectedConcept: b.selectedConcept,
    creativeStrategy: b.creativeStrategy as Record<string, unknown>,
    visualTreatment: b.visualTreatment,
    visualBeats: b.visualBeats,
    editorialPlan: b.editorialPlan,
    soundDesignIntent: b.soundDesignIntent,
    productStrategy: b.productStrategy as unknown as Record<string, unknown>,
    brandStrategy: b.brandStrategy as unknown as Record<string, unknown>,
    platformStrategy: b.platformStrategy as unknown as Record<string, unknown>,
    continuityLock: b.continuityLock as unknown as Record<string, unknown>,
    artifactRisks: b.artifactRisks,
    commercialQCRequirements: b.commercialQCRequirements,
  };
}

async function main() {
  console.log("\nCommercial Director tests\n");

  await test("valid blueprint passes validation", () => {
    const result = validateCommercialBlueprint(makeValidBlueprint());
    assert.equal(result.ok, true, formatIssues(result));
  });

  await test("invalid blueprint: missing selected concept", () => {
    const bad = makeValidBlueprint({
      selectedConcept: undefined as unknown as never,
    });
    const result = validateCommercialBlueprint(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.startsWith("selectedConcept")));
  });

  await test("invalid duration rejected", () => {
    const bad = makeValidBlueprint({
      campaignDuration: 20 as unknown as 15,
    });
    const result = validateCommercialBlueprint(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path === "campaignDuration"));
  });

  await test("incomplete visual treatment rejected", () => {
    const good = makeValidBlueprint();
    const bad = makeValidBlueprint({
      visualTreatment: {
        ...good.visualTreatment,
        lighting: "dramatic",
        cameraLanguage: "dynamic",
      },
    });
    const result = validateCommercialBlueprint(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("visualTreatment")));
  });

  await test("missing visual beats rejected", () => {
    const bad = makeValidBlueprint({ visualBeats: [] });
    const result = validateCommercialBlueprint(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path === "visualBeats"));
  });

  await test("missing campaignId rejected", () => {
    const bad = makeValidBlueprint({ campaignId: "" });
    const result = validateCommercialBlueprint(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path === "campaignId"));
  });

  await test("assemble + director with mock generator yields validated blueprint", async () => {
    const brief = makeValidBrief();
    const draft = draftFromValidBlueprint();
    const assembled = assembleBlueprintFromDraft(brief, draft);
    assert.equal(assembled.campaignId, brief.campaignId);
    assert.equal(assembled.campaignDuration, 15);
    assert.ok(!("shots" in assembled && Array.isArray((assembled as { shots?: unknown }).shots)));

    const director = new DefaultCommercialDirector({
      generator: new MockStructuredGenerator(draft),
      log: () => undefined,
    });
    const output = await director.direct(brief);
    assert.equal(output.blueprint.campaignId, brief.campaignId);
    assert.ok(output.blueprint.selectedConcept.title);
    assert.ok(output.blueprint.visualBeats.length >= 3);
    assert.ok(output.blueprint.commercialQCRequirements.checks.length >= 3);
    assert.equal(output.meta?.validationPassed, true);
    assert.equal(output.meta?.model, "mock-director-model");
    // Phase 2: no shots on core blueprint
    assert.equal((output.blueprint as { shots?: unknown }).shots, undefined);
  });

  await test("director rejects brief with invalid duration before AI", async () => {
    const director = new DefaultCommercialDirector({
      generator: new MockStructuredGenerator(draftFromValidBlueprint()),
      log: () => undefined,
    });
    await assert.rejects(
      () =>
        director.direct(
          makeValidBrief({ campaignDuration: 12 as unknown as 15 })
        ),
      /campaignDuration/
    );
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

function formatIssues(result: { issues: Array<{ path: string; message: string }> }): string {
  return result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
