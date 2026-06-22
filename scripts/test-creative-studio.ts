/**
 * Smoke + unit tests for creative-studio video/hook utilities.
 * Run: npx tsx scripts/test-creative-studio.ts
 */
import {
  normalizeVeoDuration,
  computeVoiceoverBudget,
  countWords,
  truncateVoiceover,
  splitVoiceoverForStitch,
  redistributeVoiceoverToStoryboard,
  filterStoryboardForSegment,
  getStyleDirectorSpec,
  buildVeoVideoPrompt,
  estimateVeoPromptTokens,
  VEO_PROMPT_MAX_TOKENS,
  buildShotByShotBlock,
} from "../lib/creative-studio/video-prompt-utils";

import {
  buildHookCreativeBrief,
  buildPosterPromptFromHook,
  buildVideoDescriptionFromHook,
  mapHookTypeToVideoStyle,
  mergeBrandSnapshots,
  pickProductFromScan,
  productToProductData,
} from "../lib/creative-studio/hook-creative-context";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("\n=== video-prompt-utils ===\n");

assertEqual(normalizeVeoDuration(3), 4, "duration 3s → 4s");
assertEqual(normalizeVeoDuration(5), 4, "duration 5s → 4s");
assertEqual(normalizeVeoDuration(6), 6, "duration 6s → 6s");
assertEqual(normalizeVeoDuration(7), 6, "duration 7s → 6s");
assertEqual(normalizeVeoDuration(8), 8, "duration 8s → 8s");
assertEqual(normalizeVeoDuration(16), 8, "duration 16s → 8s (single clip)");
assertEqual(normalizeVeoDuration(6, true), 8, "with refs → always 8s");

const budget8 = computeVoiceoverBudget(8);
assert(budget8.maxSpokenSeconds === 6, "8s clip: max spoken 6s");
assert(budget8.tailSilenceSeconds === 2, "8s clip: 2s tail silence");
assert(budget8.maxWords === 13, "8s clip: ~13 max words");

assertEqual(countWords("one two three"), 3, "countWords basic");
assertEqual(
  truncateVoiceover("This is a short line.", 20),
  "This is a short line.",
  "truncateVoiceover under limit"
);

const longScript =
  "Discover the secret to radiant skin with our new serum. It works in just seven days. Try it today and see the difference.";
const truncated = truncateVoiceover(longScript, 10);
assert(countWords(truncated) <= 10, "truncateVoiceover respects max words");

const split = splitVoiceoverForStitch(longScript, 8);
assert(split.part1.length > 0, "splitVoiceover part1 non-empty");
assert(split.part1.length + split.part2.length > 0, "splitVoiceover produces content");
assert(
  countWords(`${split.part1} ${split.part2}`.trim()) >= countWords(longScript) - 2,
  "splitVoiceover preserves most of the script"
);

const storyboard = [
  { scene: 1, visual_description: "Hook shot" },
  { scene: 2, visual_description: "Product hero" },
  { scene: 3, visual_description: "CTA" },
];
const redistributed = redistributeVoiceoverToStoryboard(storyboard, "word one two three four five six");
assert(redistributed.length === 3, "redistribute preserves scene count");
assert(redistributed.every((s) => "voiceover_line" in s), "redistribute adds voiceover_line");

const fullBoard = [
  { scene: 1, time_range: "0-3s", visual_description: "Hook" },
  { scene: 2, time_range: "3-8s", visual_description: "Product" },
  { scene: 3, time_range: "8-14s", visual_description: "Payoff" },
  { scene: 4, time_range: "14-16s", visual_description: "CTA" },
];
const seg0 = filterStoryboardForSegment(fullBoard, 0, 8);
const seg1 = filterStoryboardForSegment(fullBoard, 1, 8);
assert(seg0.length >= 1, "segment 0 has scenes");
assert(seg1.length >= 1, "segment 1 has scenes");
assert(seg0.some((s) => s.scene === 1), "segment 0 includes hook scene");
assert(seg1.some((s) => s.scene === 3 || s.scene === 4), "segment 1 includes later scenes");

const hookStyle = getStyleDirectorSpec("Hook");
assert(hookStyle.role.includes("Performance"), "Hook style has performance director role");
const unknownStyle = getStyleDirectorSpec("Nonexistent");
assert(unknownStyle.role.includes("commercial"), "unknown style falls back to default");

const prompt = buildVeoVideoPrompt({
  brandName: "TestBrand",
  productName: "TestProduct",
  style: "Commercial",
  clipDurationSeconds: 8,
  aspectRatio: "9:16",
  fallbackPrompt: "A premium product ad.",
  voiceoverScript: "Try TestProduct today.",
  hasReferenceImages: true,
  storyboard: fullBoard,
});
assert(prompt.includes("TestBrand") || prompt.includes("TestProduct"), "prompt includes brand or product");
assert(prompt.includes("reference images"), "prompt includes reference instruction when refs present");
assert(/SPOKEN AD|VO \(|VOICEOVER|AUDIO:/i.test(prompt), "prompt includes voiceover pacing");
assert(/BEAT-BASED STORYBOARD|CREATIVE TREATMENT|STORYBOARD/i.test(prompt), "prompt includes storyboard or treatment");
assert(estimateVeoPromptTokens(prompt) <= VEO_PROMPT_MAX_TOKENS, `prompt within Veo token limit (${estimateVeoPromptTokens(prompt)} tokens)`);

const promptNoRefs = buildVeoVideoPrompt({
  brandName: "B",
  productName: "P",
  clipDurationSeconds: 6,
  aspectRatio: "16:9",
  fallbackPrompt: "Text only ad.",
  hasReferenceImages: false,
});
assert(!promptNoRefs.includes("reference images provided"), "no ref block without images");

const shotBlock = buildShotByShotBlock(fullBoard, 8);
assert(shotBlock.includes("Hook"), "shot block includes scene descriptions");

console.log("\n=== hook-creative-context ===\n");

const hook = {
  hookStatement: "Your skin deserves better.",
  hookType: "emotional",
  whyItWorks: "Triggers self-care motivation",
  supportingReviewPhrase: "Best serum I've tried",
};

const brand = {
  name: "GlowCo",
  description: "Premium skincare",
  audience: "Women 25-45",
  tone: "Warm and aspirational",
  primaryColors: ["#FF6B6B", "#4ECDC4"],
  offering: "Natural skincare",
};

const product = {
  product_name: "Radiance Serum",
  short_benefit: "Glowing skin in 7 days",
  product_images: ["https://example.com/serum.jpg"],
  category: "skincare",
};

assert(buildHookCreativeBrief(hook).includes("Your skin deserves better"), "hook brief includes statement");
assert(buildPosterPromptFromHook(hook, brand, product).includes("Radiance Serum"), "poster prompt includes product");
assert(buildPosterPromptFromHook(hook, brand, product).includes("EXACT PRODUCT IMAGE"), "poster prompt demands exact product");
assert(buildVideoDescriptionFromHook(hook, brand, product).includes("8-second"), "video description is 8s");
assertEqual(mapHookTypeToVideoStyle("ugc authentic"), "UGC Style", "UGC hook → UGC Style");
assertEqual(mapHookTypeToVideoStyle("emotional aspirational"), "Cinematic", "emotional → Cinematic");
assertEqual(mapHookTypeToVideoStyle("product close-up"), "Product Close-up", "product → Product Close-up");
assertEqual(mapHookTypeToVideoStyle("luxury premium"), "Luxury", "luxury → Luxury");
assertEqual(mapHookTypeToVideoStyle("unknown"), "Commercial", "unknown → Commercial");

const merged = mergeBrandSnapshots(
  { name: "Guideline Brand", tone: "Professional" },
  { name: "Fallback", tone: "Casual", primaryColors: ["#000"] },
  { brand_name: "Scan Brand", brand_tone: "Friendly" }
);
assertEqual(merged.name, "Guideline Brand", "merge prefers guideline name");
assertEqual(merged.tone, "Professional", "merge prefers guideline tone");

const products = [
  { product_name: "Other Product", product_images: [] },
  { product_name: "glowco serum", product_images: ["img.jpg"] },
];
const picked = pickProductFromScan(products, "https://www.glowco.com");
assert(picked?.product_name === "glowco serum", "pickProductFromScan matches host");

const productData = productToProductData(product, brand);
assertEqual(productData.product_name, "Radiance Serum", "productToProductData name");
assertEqual(productData.brand_name, "GlowCo", "productToProductData brand");
assert(productData.hero_image === "https://example.com/serum.jpg", "productToProductData hero image");

console.log("\n=== API smoke tests ===\n");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function apiTest(
  method: string,
  path: string,
  body: object | null,
  expectStatus: number,
  label: string
) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === expectStatus) {
      passed++;
      console.log(`  ✓ ${label} (${res.status})`);
      return res;
    }
    failed++;
    const text = await res.text().catch(() => "");
    console.error(`  ✗ FAIL: ${label} — expected ${expectStatus}, got ${res.status}: ${text.slice(0, 200)}`);
    return res;
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ FAIL: ${label} — ${msg}`);
    return null;
  }
}

async function runApiTests() {
  let serverUp = false;
  try {
    const ping = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    serverUp = ping.ok || ping.status < 500;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    console.log("  ⚠ Dev server not running — skipping API smoke tests");
    console.log("    Start with: npm run dev:next");
    return;
  }

  await apiTest("GET", "/api/creative-studio/generate-video", null, 405, "generate-video rejects GET");
  await apiTest("POST", "/api/creative-studio/generate-video", {}, 400, "generate-video rejects empty body (no prompt)");
  await apiTest("GET", "/api/creative-studio/generate-video-stitched", null, 405, "generate-video-stitched rejects GET");
  await apiTest("POST", "/api/creative-studio/generate-video-stitched", {}, 400, "generate-video-stitched rejects empty body");
}

runApiTests().then(() => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(failed > 0 ? 1 : 0);
});
