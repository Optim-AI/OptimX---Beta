/**
 * Campaign compiler Phase 7 tests — no live providers.
 *
 * Run: npm run test:campaign-compiler
 */

import assert from "node:assert/strict";
import { compileCampaignGeneration } from "./compiler";
import { buildCampaignPrompt } from "./prompt-builder";
import { buildCampaignReferences } from "./reference-builder";
import { validateCampaignGenerationSpec } from "./validate";
import { CampaignCompilerError } from "./types";
import { make15sCompileInput, make30sCompileInput, makeAvailableAssets } from "./fixtures";
import { makeValidBlueprint } from "../commercial-director/fixtures";
import { makeValid15sShotPlan } from "../shot-planner/fixtures";

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

async function main() {
  console.log("\nCampaign Compiler tests\n");

  await test("15-second campaign compiles", () => {
    const spec = compileCampaignGeneration(make15sCompileInput());
    assert.equal(spec.duration, 15);
    assert.equal(spec.generationMode, "native_continuous");
    assert.equal(spec.provider, "runway");
    assert.equal(spec.model, "seedance2_5");
    assert.ok(spec.campaignPrompt.includes("15-second") || spec.campaignPrompt.includes("15"));
  });

  await test("30-second campaign compiles", () => {
    const spec = compileCampaignGeneration(make30sCompileInput());
    assert.equal(spec.duration, 30);
    assert.match(spec.campaignPrompt, /30/);
    assert.ok(spec.visualBeats.length >= 1);
  });

  await test("creative concept preserved", () => {
    const input = make15sCompileInput();
    const spec = compileCampaignGeneration(input);
    assert.equal(spec.creativeConcept.title, input.blueprint.selectedConcept.title);
    assert.ok(spec.campaignPrompt.includes(input.blueprint.selectedConcept.title));
  });

  await test("narrative beats preserved in order", () => {
    const input = make30sCompileInput();
    const spec = compileCampaignGeneration(input);
    for (let i = 1; i < spec.visualBeats.length; i++) {
      assert.ok(
        spec.visualBeats[i].timestampStartSeconds >=
          spec.visualBeats[i - 1].timestampStartSeconds
      );
    }
  });

  await test("product requirements preserved", () => {
    const spec = compileCampaignGeneration(make15sCompileInput());
    assert.ok(spec.productRequirements.preservePackaging);
    assert.ok(spec.productRequirements.visibilityRequirements);
    assert.match(spec.campaignPrompt, /product|packaging/i);
  });

  await test("product reference selected", () => {
    const spec = compileCampaignGeneration(make15sCompileInput());
    assert.equal(spec.diagnostics.usesProductReference, true);
    assert.ok(spec.referenceAssets.some((r) => r.purpose === "product"));
  });

  await test("character reference selected when provided", () => {
    const input = make15sCompileInput({
      availableAssets: makeAvailableAssets({
        characterReferences: [
          {
            id: "char-1",
            kind: "creative_reference",
            url: "https://example.com/char.png",
            mimeType: "image/png",
          },
        ],
      }),
    });
    const spec = compileCampaignGeneration(input);
    assert.ok(spec.referenceAssets.some((r) => r.purpose === "character"));
  });

  await test("reference priority keeps product over optional style", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `extra-${i}`,
      kind: "creative_reference" as const,
      url: `https://example.com/extra-${i}.png`,
      mimeType: "image/png",
    }));
    const result = buildCampaignReferences({
      blueprint: make15sCompileInput().blueprint,
      shotPlan: make15sCompileInput().shotPlan,
      availableAssets: makeAvailableAssets({
        characterReferences: many,
      }),
      maxReferenceImages: 3,
    });
    assert.ok(result.selected.some((r) => r.purpose === "product"));
    assert.ok(result.selected.length <= 3);
    assert.ok(result.omitted.length > 0);
  });

  await test("excess references handled deterministically", () => {
    const a = buildCampaignReferences({
      blueprint: make15sCompileInput().blueprint,
      shotPlan: make15sCompileInput().shotPlan,
      availableAssets: makeAvailableAssets({
        characterReferences: [
          { id: "c2", kind: "creative_reference", url: "https://example.com/c2.png", mimeType: "image/png" },
          { id: "c1", kind: "creative_reference", url: "https://example.com/c1.png", mimeType: "image/png" },
        ],
      }),
      maxReferenceImages: 2,
    });
    const b = buildCampaignReferences({
      blueprint: make15sCompileInput().blueprint,
      shotPlan: make15sCompileInput().shotPlan,
      availableAssets: makeAvailableAssets({
        characterReferences: [
          { id: "c1", kind: "creative_reference", url: "https://example.com/c1.png", mimeType: "image/png" },
          { id: "c2", kind: "creative_reference", url: "https://example.com/c2.png", mimeType: "image/png" },
        ],
      }),
      maxReferenceImages: 2,
    });
    assert.deepEqual(
      a.selected.map((r) => r.assetId),
      b.selected.map((r) => r.assetId)
    );
  });

  await test("unsupported duration fails validation", () => {
    const input = make15sCompileInput();
    (input.blueprint as { campaignDuration: number }).campaignDuration = 20;
    assert.throws(
      () => compileCampaignGeneration(input),
      (e: unknown) => e instanceof CampaignCompilerError && e.code === "UNSUPPORTED_DURATION"
    );
  });

  await test("missing product reference fails when required", () => {
    const input = make15sCompileInput({
      availableAssets: { productImages: [] },
    });
    assert.throws(
      () => compileCampaignGeneration(input),
      (e: unknown) => e instanceof CampaignCompilerError && e.code === "MISSING_PRODUCT_REFERENCE"
    );
  });

  await test("empty creative blueprint fails", () => {
    const input = make15sCompileInput();
    input.blueprint = {
      ...input.blueprint,
      selectedConcept: {
        ...input.blueprint.selectedConcept,
        title: "",
        creativeConcept: "",
      },
    };
    assert.throws(
      () => compileCampaignGeneration(input),
      (e: unknown) => e instanceof CampaignCompilerError && e.code === "EMPTY_CREATIVE"
    );
  });

  await test("prompt describes continuous commercial not clip stitch", () => {
    const { campaignPrompt } = buildCampaignPrompt({
      blueprint: make15sCompileInput().blueprint,
      shotPlan: makeValid15sShotPlan(),
    });
    assert.match(campaignPrompt, /continuous|single unbroken|one coherent/i);
    assert.doesNotMatch(campaignPrompt, /stitch together|separate clips to generate/i);
  });

  await test("validateCampaignGenerationSpec rejects wrong model", () => {
    const spec = compileCampaignGeneration(make15sCompileInput());
    const bad = { ...spec, model: "veo" as typeof spec.model };
    const result = validateCampaignGenerationSpec(bad);
    assert.equal(result.ok, false);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
