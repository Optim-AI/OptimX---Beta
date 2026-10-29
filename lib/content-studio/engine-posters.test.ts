/**
 * Run: npx tsx lib/content-studio/engine-posters.test.ts
 */
import assert from "node:assert/strict";
import { buildAdStudioArtDirection, buildAdStudioBrief } from "./engine-posters";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";

const brand = {
  name: "Oorgaa",
  description: "",
  audience: "coastal food lovers",
  offering: "",
  tone: "warm",
  logo: "https://cdn.example.com/logo.png",
  primaryColors: ["#F5A623"],
} as BrandSnapshot;

const product = {
  product_name: "Crunchy Peri Peri Fried Anchovies Snacks",
  price: "₹249",
  description: "Crispy anchovies in peri peri.",
  key_benefits: ["crispy", "ready to eat"],
  product_images: ["https://cdn.example.com/a.jpg", "data:image/png;base64,xx", "https://cdn.example.com/b.jpg"],
} as Product;

console.log("=== Ad Studio engine brief ===");

const brief = buildAdStudioBrief({
  brand,
  product,
  angle: {
    title: "Hear that crunch? Not a drop of soggy oil.",
    angle: "Shatter Crunch",
    message: "Bone-dry crunch, no pickle oil.",
    insight: "Buyers complain fish snacks go chewy",
    proof: "Close-up of a dry anchovy snapping",
    audience: "late-night snackers",
    funnel: "Conversion",
  },
  campaign: { bigIdea: "Real coastal anchovies. Zero sogginess.", positioning: "For snackers who…", avoid: ["generic 'spicy and crispy' claims"] },
});

assert.equal(brief.adGoal, "feature", "conversion never uses the rating-badge format without real proof");
assert.equal(brief.audienceHint, "late-night snackers");
assert.equal(brief.productReferences.length, 2, "only http product images become references");
assert.equal(brief.product?.name, product.product_name);
assert.ok(brief.userInstruction.includes("Shatter Crunch"));
assert.ok(brief.userInstruction.includes("Real coastal anchovies. Zero sogginess."));
assert.ok(brief.userInstruction.includes("never write 'CTA:'"));
assert.ok(!/headline\s*:\s*["“]/i.test(brief.userInstruction), "hook is guidance, not a forced headline override");
console.log("  ok  angle, campaign and product reach the brief");

const plain = buildAdStudioBrief({ brand, product, angle: null });
assert.equal(plain.adGoal, "feature");
assert.equal(plain.audienceHint, null);
assert.equal(buildAdStudioBrief({ brand, product, angle: { title: "x", funnel: "Awareness" } }).adGoal, "awareness");
console.log("  ok  goal falls back sensibly without an angle");

const art = buildAdStudioArtDirection(brand, product, { title: "x", proof: "Whole anchovies snapping, peri peri dust in the air" });
assert.ok(art.startsWith("=== ART DIRECTION"), "art direction block is marked for the image stages");
assert.ok(art.includes("Never a plain product on an empty backdrop."));
assert.ok(art.includes("Whole anchovies snapping"), "the angle's proof becomes the visual idea");
console.log("  ok  art direction asks for a campaign-grade visual idea");
