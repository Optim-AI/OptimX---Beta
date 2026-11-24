/**
 * Poster art direction and brand-data hygiene (pure logic, no model calls).
 * Run: npm run test:poster-art
 */
import assert from "node:assert/strict";
import { cleanBrandColors, isRealFontFamily, isThemeDefaultColor, realFontOrNull } from "../brand-kit/design-hygiene";
import { artBriefInstruction, cleanArtBrief, cleanProductName, formatArtBrief } from "./art-brief";
import { buildAdStudioBrief, buildAdStudioArtDirection } from "./engine-posters";
import { brandRangeProduct, isBrandRange } from "../ad-studio/service";
import { cleanConcept, conceptLines, tooSimilar } from "./creative-ideas";
import { detectUserOverrides } from "../creative-studio/poster-generation/strategy/strategy-input";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Poster art direction");

test("theme default colours are dropped, brand colours kept", () => {
  assert.equal(isThemeDefaultColor("#007AFF"), true);
  assert.equal(isThemeDefaultColor("#0d6efd"), true);
  assert.equal(isThemeDefaultColor("#fab83d"), false);
  assert.deepEqual(cleanBrandColors(["#cc1818", "#3858e9", "#0274be", "#f9fafb", "#111827"]), ["#f9fafb", "#111827"]);
  assert.deepEqual(cleanBrandColors(["#fab83d", "#ffeecf", "#007aff"]), ["#fab83d", "#ffeecf"]);
  assert.deepEqual(cleanBrandColors([{ hex: "#007aff" }]), [{ hex: "#007aff" }]); // never empties a palette
});

test("CSS variable names are not fonts", () => {
  for (const bad of ["M-Heading-Font", "M-Body-Font", "var(--font-heading)", "heading-font", "font-1", "sans-serif", "inherit", ""]) {
    assert.equal(isRealFontFamily(bad), false, bad);
  }
  for (const good of ["Playfair Display", "Inter", "Poppins", "DM Serif Display", "Bebas Neue"]) {
    assert.equal(isRealFontFamily(good), true, good);
  }
  assert.equal(realFontOrNull("'Inter'"), "Inter");
});

test("shop titles become clean product names", () => {
  assert.equal(cleanProductName("Peri Peri Fried Anchovies - oorgaa - snacks", "oorgaa"), "Peri Peri Fried Anchovies");
  assert.equal(cleanProductName("Vitamin C Glow Serum", "LUMÉ"), "Vitamin C Glow Serum");
});

const ctx = { brandColors: ["#fab83d", "#ffeecf", "#007aff"], productName: "Peri Peri Fried Anchovies", fallbackHeadline: "Straight from the pack. No cooking." };

test("art brief keeps only brand colours and a short headline", () => {
  const a = cleanArtBrief(
    { direction: "commercial", idea: "Jar tilted, anchovies bursting out", palette: ["#FAB83D", "#007aff", "#123456"], headline: "Straight from the jar. Zero cooking.", cta: "Order now", packaging: "jar" },
    ctx
  );
  assert.ok(a);
  assert.equal(a!.direction, "bold"); // retail "commercial" is not allowed
  assert.deepEqual(a!.palette, ["#fab83d"]);
  assert.equal(a!.headline, "Straight from the jar. Zero cooking.");
  assert.equal(cleanArtBrief({ idea: "" }, ctx), null);
  const long = cleanArtBrief({ idea: "x", headline: "one two three four five six seven eight nine ten" }, ctx);
  assert.equal(long!.headline, ctx.fallbackHeadline);
});

test("the locked headline and button reach the strategist word for word", () => {
  const art = cleanArtBrief({ direction: "bold", idea: "Jar bursting", headline: "Straight from the jar. Zero cooking.", cta: "Order now" }, ctx)!;
  const brief = buildAdStudioBrief({
    brand: { name: "oorgaa", primaryColors: ["#fab83d"] } as never,
    product: { product_name: "Peri Peri Fried Anchovies - oorgaa - snacks", product_images: ["https://example.com/a.jpg"] } as never,
    angle: { title: "Straight from the pack", proof: "Opening the pack with crisp sound effects" },
    art,
  });
  assert.equal(brief.visualDirection, "bold");
  assert.equal(brief.brandOnPackaging, false);
  const onPack = cleanArtBrief({ direction: "bold", idea: "Jar bursting", headline: "Zero cooking", cta: "Order now", brandOnPack: true }, ctx)!;
  assert.equal(onPack.brandOnPack, true);
  assert.ok(/no separate logo/.test(formatArtBrief(onPack)));
  assert.equal(buildAdStudioBrief({ brand: { name: "oorgaa" } as never, product: { product_name: "X", product_images: ["https://example.com/a.jpg"] } as never, angle: null, art: onPack }).brandOnPackaging, true);
  assert.ok(!/proof|sound effects/i.test(brief.userInstruction));
  const o = detectUserOverrides(brief);
  assert.equal(o.headline, "Straight from the jar. Zero cooking.");
  assert.equal(o.cta, "Order now");
  assert.deepEqual(artBriefInstruction(art).length, 2);
  const block = buildAdStudioArtDirection({ name: "oorgaa" } as never, {} as never, null, art);
  assert.equal(block, formatArtBrief(art));
  assert.ok(/never cropped/.test(block) && /once only/.test(block));
});

test("without an art brief Ad Studio keeps the older brief", () => {
  const brief = buildAdStudioBrief({
    brand: { name: "oorgaa" } as never,
    product: { product_name: "X", product_images: ["https://example.com/a.jpg"] } as never,
    angle: { title: "Hook", proof: "Show it" },
  });
  assert.equal(brief.visualDirection, null);
  assert.ok(/What the poster should show as proof/.test(brief.userInstruction));
});

test("whole-brand ads show the range, or the brand alone", () => {
  const prods = ["A", "B", "C", "D"].map((n) => ({ product_name: n, product_images: [`https://example.com/${n}.jpg`] })) as never[];
  const range = brandRangeProduct({ name: "oorgaa", description: "Coastal snacks" }, prods);
  assert.equal(isBrandRange(range), true);
  assert.equal(range.product_images.length, 3);
  const brief = buildAdStudioBrief({ brand: { name: "oorgaa" } as never, product: range, angle: null });
  assert.equal(brief.productReferences.length, 3);
  assert.ok(/whole-brand ad/i.test(brief.userInstruction));
  const art = cleanArtBrief({ idea: "Three jars in a row", headline: "Taste the coast" }, { ...ctx, range: ["A", "B", "C"] })!;
  assert.ok(/together as one set/.test(formatArtBrief(art)));
  const dupes = brandRangeProduct({ name: "x" }, [
    { product_name: "Bundle – Pack of 6", product_images: ["https://e.com/1.jpg"] },
    { product_name: "Bundle – Pack of 6 - x - Combo", product_images: ["https://e.com/2.jpg"] },
    { product_name: "Classic", product_images: ["https://e.com/3.jpg"] },
  ] as never[]);
  assert.equal(dupes.product_images.length, 2);
  const bare = brandRangeProduct({ name: "oorgaa" }, []);
  assert.equal(bare.product_images.length, 0);
  assert.ok(/no product photo/i.test(buildAdStudioBrief({ brand: { name: "oorgaa" } as never, product: bare, angle: null }).userInstruction));
});

test("each poster carries its own creative idea, not a template", () => {
  assert.equal(cleanConcept({ device: "metaphor" }), null); // needs a picture and type treatment
  const c = cleanConcept({ device: "Visual metaphor", thought: "Lunch is boring", visual: "A tiffin opening like a treasure chest", type: "Hand-lettered script curling out of the tiffin", colour: "Warm gold on deep teal", composition: "Low angle, eye travels from lid to words", why: "Surprise" })!;
  assert.ok(c);
  const lines = conceptLines(c);
  assert.ok(lines[0].startsWith("Creative idea (Visual metaphor)"));
  const twin = { ...c, visual: "Something else" };
  assert.equal(tooSimilar(c, twin), true);
  assert.equal(tooSimilar(c, { ...c, device: "Exaggerated scale", type: "Tiny serif caption" }), false);
  const art = cleanArtBrief({ direction: "premium", idea: "x", headline: "Lunch, upgraded" }, { ...ctx, concept: c })!;
  const block = formatArtBrief(art);
  assert.ok(block.includes("A tiffin opening like a treasure chest") && block.includes("Hand-lettered script"));
  assert.ok(!/huge heavy|One dominant move/i.test(block));
});

console.log(`\n${passed} passed`);
