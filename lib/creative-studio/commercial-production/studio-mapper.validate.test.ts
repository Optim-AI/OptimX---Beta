/**
 * Phase 9 — Studio → CampaignBrief mapper + native duration invariants.
 * No live providers. Run: npm run test:studio-mapper
 */

import assert from "node:assert/strict";
import {
  assertNativeDurationInvariant,
  buildStudioAvailableAssets,
  mapStudioFormToCampaignBrief,
  resolveCanonicalProductImage,
} from "./studio-mapper";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

function baseForm(duration: 15 | 30) {
  return {
    campaignId: "session_test_001",
    product: {
      product_name: "Pulse Protein+",
      brand_name: "Northline",
      hero_image: "https://example.com/product.png",
      product_images: [
        "https://example.com/product.png",
        "https://example.com/extra.png",
      ],
      category: "protein",
    },
    adSetup: {
      duration,
      aspect_ratio: "9:16",
      platform: "Instagram Reels / TikTok",
      campaignGoal: "Drive Sales",
      hookType: "Problem Agitation",
    },
    brand: { name: "Northline Athletics", tone: "direct" },
    userDescription: "Warm kitchen ritual that turns a rushed evening into training.",
    voiceoverCta: "Get Pulse Protein+",
  };
}

console.log("\nStudio mapper / Phase 9 invariant tests\n");

test("maps campaign name, creative direction, product, duration, aspect", () => {
  const brief = mapStudioFormToCampaignBrief(baseForm(15));
  assert.equal(brief.campaignId, "session_test_001");
  assert.equal(brief.product.name, "Pulse Protein+");
  assert.equal(brief.userConcept?.includes("kitchen ritual"), true);
  assert.equal(brief.campaignDuration, 15);
  assert.equal(brief.aspectRatio, "9:16");
  assert.ok(brief.product.images.length >= 1);
  assert.equal(brief.product.images[0].id, "product-canonical");
});

test("15s → campaignDuration 15 + native invariant", () => {
  const brief = mapStudioFormToCampaignBrief(baseForm(15));
  assert.equal(brief.campaignDuration, 15);
  const inv = assertNativeDurationInvariant(15, brief.campaignDuration);
  assert.equal(inv.generationMode, "native_continuous");
  assert.equal(inv.model, "seedance2_5");
  assert.equal(inv.providerSubmissionsExpected, 1);
  assert.equal(inv.campaignDuration, 15);
});

test("30s → campaignDuration 30 + native invariant", () => {
  const brief = mapStudioFormToCampaignBrief(baseForm(30));
  assert.equal(brief.campaignDuration, 30);
  const inv = assertNativeDurationInvariant(30, brief.campaignDuration);
  assert.equal(inv.generationMode, "native_continuous");
  assert.equal(inv.providerSubmissionsExpected, 1);
  assert.equal(inv.campaignDuration, 30);
});

test("rejects non 15/30 duration", () => {
  assert.throws(() =>
    mapStudioFormToCampaignBrief({
      ...baseForm(15),
      adSetup: { ...baseForm(15).adSetup, duration: 20 },
    })
  );
});

test("duration mismatch throws", () => {
  assert.throws(() => assertNativeDurationInvariant(15, 30));
});

test("canonical product is hero_image first", () => {
  const url = resolveCanonicalProductImage({
    product_name: "X",
    hero_image: "https://example.com/hero.png",
    product_images: ["https://example.com/other.png"],
  });
  assert.equal(url, "https://example.com/hero.png");
});

test("available assets send only the selected/canonical product image", () => {
  const assets = buildStudioAvailableAssets({
    product_name: "X",
    hero_image: "https://example.com/hero.png",
    product_images: [
      "https://example.com/hero.png",
      "https://example.com/other.png",
      "https://example.com/logo.gif",
    ],
  });
  assert.equal(assets.productImages?.length, 1);
  assert.equal(assets.productImages?.[0]?.url, "https://example.com/hero.png");
});

test("available assets put canonical product first", () => {
  const assets = buildStudioAvailableAssets(baseForm(15).product);
  assert.equal(assets.productImages?.[0]?.id, "product-canonical");
});

test("16:9 maps to youtube_ad platform when YouTube Ad selected", () => {
  const brief = mapStudioFormToCampaignBrief({
    ...baseForm(15),
    adSetup: {
      ...baseForm(15).adSetup,
      aspect_ratio: "16:9",
      platform: "YouTube Ad",
    },
  });
  assert.equal(brief.aspectRatio, "16:9");
  assert.equal(brief.platform, "youtube_ad");
});

test("invariant documents exactly one provider submission — never multi-shot split", () => {
  for (const d of [15, 30] as const) {
    const inv = assertNativeDurationInvariant(d, d);
    assert.equal(inv.providerSubmissionsExpected, 1);
    assert.equal(inv.generationMode, "native_continuous");
    // Explicit: must NOT imply 5+5+5 or 15+15
    assert.notEqual(inv.campaignDuration, 5);
    assert.ok(inv.campaignDuration === 15 || inv.campaignDuration === 30);
  }
});

console.log(`\nStudio mapper: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
