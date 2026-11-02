/**
 * Idea cards + ad type tests — mocked writer / renderer, no network.
 *
 * Run: npx tsx lib/creative-studio/commercial-production/concepts/generate-concepts.test.ts
 */

import assert from "node:assert/strict";
import sharp from "sharp";
import { makeValidBrief } from "../commercial-director/fixtures";
import { buildDirectorUserPrompt } from "../commercial-director/prompts";
import { buildCampaignPrompt } from "../campaign-compiler/prompt-builder";
import { make15sCompileInput } from "../campaign-executor/fixtures";
import { mergeProductAssets } from "../campaign-executor/produce";
import { endCardContentFromBrief } from "../finishing/attach-end-card";
import { voiceoverAdContext } from "../audio/attach-gemini-voiceover";
import { mapStudioFormToCampaignBrief } from "../studio-mapper";
import { normalizeAdType, suggestedOccasions } from "../campaign/ad-type";
import { buildConceptsPrompt, buildStoryboardPrompt, generateConceptCards } from "./generate-concepts";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

const img = (id: string, url: string) => ({ id, kind: "product_image" as const, url, mimeType: "image/png" });

async function main() {
  console.log("\nIdea cards + ad type tests\n");

  const comboBrief = makeValidBrief({
    adType: "combo_offer",
    product: { ...makeValidBrief().product, images: [img("p1", "https://example.com/a.png")] },
    additionalProducts: [
      { name: "Shaker Bottle", images: [img("p2", "https://example.com/b.png")] },
      { name: "Energy Bar", images: [] },
    ],
    endCard: { enabled: true, offer: "Buy the kit, save 25%" },
  });

  await test("ad type aliases normalise; unknown is undefined", () => {
    assert.equal(normalizeAdType("Combo"), "combo_offer");
    assert.equal(normalizeAdType("shop"), "shop_service");
    assert.equal(normalizeAdType("nonsense"), undefined);
  });

  await test("season-aware occasions include this month and next", () => {
    const oct = suggestedOccasions(new Date("2026-10-05"));
    assert.ok(oct.includes("Diwali"));
    assert.ok(oct.includes("Navratri"));
    const dec = suggestedOccasions(new Date("2026-12-10"));
    assert.ok(dec.includes("Christmas") && dec.includes("Pongal"));
  });

  await test("combo: director prompt lists every product and the ad type", () => {
    const p = buildDirectorUserPrompt(comboBrief);
    assert.ok(p.includes("Ad type: Combo or offer"));
    assert.ok(p.includes("ADDITIONAL PRODUCT 2") && p.includes("Shaker Bottle"));
    assert.ok(p.includes("ADDITIONAL PRODUCT 3") && p.includes("Energy Bar"));
  });

  await test("combo: extra product photos join the references, deduplicated, primary first", () => {
    const merged = mergeProductAssets(comboBrief, {
      productImages: [img("p1", "https://example.com/a.png")],
    });
    assert.deepEqual(merged.productImages?.map((p) => p.id), ["p1", "p2"]);
  });

  await test("combo: video prompt names products in reference order", () => {
    const input = make15sCompileInput();
    const { campaignPrompt } = buildCampaignPrompt({
      ...input,
      adType: "combo_offer",
      productNames: ["Pulse Protein+", "Shaker Bottle"],
    });
    assert.ok(campaignPrompt.includes("AD TYPE (CRITICAL): Ad type: Combo or offer"));
    assert.ok(campaignPrompt.includes("1. Pulse Protein+; 2. Shaker Bottle"));
    assert.ok(campaignPrompt.includes("same order as the product list"));
  });

  await test("voiceover context names the deal and every product", () => {
    const ctx = voiceoverAdContext(comboBrief) || "";
    assert.ok(ctx.includes("Combo or offer"));
    assert.ok(ctx.includes("Shaker Bottle") && ctx.includes("Energy Bar"));
    assert.ok(ctx.includes("save 25%"));
    assert.equal(voiceoverAdContext(makeValidBrief()), undefined);
  });

  await test("festival: end card greets when there is no offer", () => {
    const brief = makeValidBrief({ adType: "festival", occasion: "Diwali", endCard: { enabled: true } });
    assert.equal(endCardContentFromBrief(brief)?.offer, "Happy Diwali!");
  });

  await test("studio mapper: brand ad without a product name, extras capped at 3", () => {
    const brief = mapStudioFormToCampaignBrief({
      campaignId: "c1",
      product: { product_name: "" },
      brand: { name: "Saravana Textiles" },
      adSetup: { duration: 15, aspect_ratio: "9:16" },
      adType: "brand",
    });
    assert.equal(brief.adType, "brand");
    assert.equal(brief.product.name, "Saravana Textiles");
    assert.throws(() =>
      mapStudioFormToCampaignBrief({
        campaignId: "c2",
        product: { product_name: "" },
        adSetup: { duration: 15, aspect_ratio: "9:16" },
        adType: "product",
      })
    );
    const many = mapStudioFormToCampaignBrief({
      campaignId: "c3",
      product: { product_name: "A" },
      adSetup: { duration: 15, aspect_ratio: "9:16" },
      adType: "multi_product",
      extraProducts: [
        { name: "B", image: "https://example.com/b.png" },
        { name: "C" },
        { name: "D" },
        { name: "E" },
        { name: " " },
      ],
    });
    assert.deepEqual(many.additionalProducts?.map((p) => p.name), ["B", "C", "D"]);
    assert.equal(many.additionalProducts?.[0].images.length, 1);
  });

  await test("approved concept is locked into the director prompt", () => {
    const p = buildDirectorUserPrompt(
      makeValidBrief({ approvedConcept: { title: "Gym Bag Rush", idea: "A rushed morning", beats: ["Alarm", "Scoop", "Run"] } })
    );
    assert.ok(p.includes("APPROVED CONCEPT (CRITICAL"));
    assert.ok(p.includes("1. Alarm 2. Scoop 3. Run"));
    assert.ok(!buildDirectorUserPrompt(makeValidBrief()).includes("APPROVED CONCEPT"));
  });

  await test("concept prompts are plain-language and storyboards forbid text", () => {
    const p = buildConceptsPrompt(comboBrief);
    assert.ok(p.includes("not technical"));
    assert.ok(p.includes("Shaker Bottle"));
    const sb = buildStoryboardPrompt(comboBrief, { storyboardPanels: ["a", "b", "c"] });
    assert.ok(sb.includes("exactly 3 panels"));
    assert.ok(sb.includes("No text"));
  });

  const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#336699" } }).png().toBuffer();
  const drafts = JSON.stringify({
    concepts: [1, 2, 3, 4].map((n) => ({
      title: `Idea ${n}`,
      idea: "Simple idea.",
      beats: ["One", "Two", "Three"],
      whyItWorks: "Customers relate.",
      storyboardPanels: ["a", "b", "c"],
    })),
  });

  await test("generates 3 cards with compressed storyboard images", async () => {
    const cards = await generateConceptCards(makeValidBrief(), {
      writer: async () => drafts,
      renderer: async () => png,
    });
    assert.equal(cards.length, 3);
    assert.equal(cards[0].id, "idea-1");
    assert.ok(cards[0].storyboardImage?.startsWith("data:image/jpeg;base64,"));
    const meta = await sharp(Buffer.from(cards[0].storyboardImage!.split(",")[1], "base64")).metadata();
    assert.equal(meta.width, 960);
  });

  await test("a failed storyboard image still returns the idea", async () => {
    let call = 0;
    const cards = await generateConceptCards(makeValidBrief(), {
      writer: async () => drafts,
      renderer: async () => {
        call += 1;
        if (call === 2) throw new Error("image quota");
        return png;
      },
    });
    assert.equal(cards.filter((c) => c.storyboardImage === null).length, 1);
    assert.equal(cards.length, 3);
  });

  await test("unparseable ideas fail with a plain message", async () => {
    await assert.rejects(
      generateConceptCards(makeValidBrief(), { writer: async () => "not json", renderer: async () => png }),
      /couldn't come up with ideas/
    );
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
