/**
 * Smoke + unit tests for creative-studio video/hook utilities.
 * Run: npx tsx scripts/test-creative-studio.ts
 */
import {
  normalizeVeoDuration,
  computeVoiceoverBudget,
  countWords,
  truncateVoiceover,
  finalizeVoiceoverForClip,
  ensurePerformanceAdVoiceover,
  compressVoiceoverPreservingStructure,
  validateVoiceoverCommercial,
  splitVoiceoverForStitch,
  redistributeVoiceoverToStoryboard,
  filterStoryboardForSegment,
  getStyleDirectorSpec,
  buildVeoVideoPrompt,
  estimateVeoPromptTokens,
  stripEmbeddedDialogueDirections,
  sanitizeVisualTreatmentForVeo,
  stripStoryboardDialogue,
  VEO_PROMPT_MAX_TOKENS,
  buildShotByShotBlock,
} from "../lib/creative-studio/video-prompt-utils";
import { resolveRequestFromApiBody } from "../lib/creative-studio/resolve-veo-prompt";
import { buildCompactStoryboardLines } from "../lib/creative-studio/director-pipeline";
import { parseVideoDataUrl } from "../lib/creative-studio/parse-video-data-url";

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
assert(budget8.maxSpokenSeconds === 6.5, "8s clip: max spoken 6.5s");
assert(budget8.finishBySecond === 6.5, "8s clip: finish by 6.5s");
assert(budget8.minWords === 16, "8s clip: min 16 words");
assert(budget8.maxWords === 20, "8s clip: max 20 words");

const budget16 = computeVoiceoverBudget(16);
assert(budget16.maxSpokenSeconds === 14, "16s clip: max spoken 14s");
assert(budget16.finishBySecond === 14, "16s clip: finish by 14s");
assert(budget16.minWords === 32, "16s clip: min 32 words");
assert(budget16.maxWords === 40, "16s clip: max 40 words");

assertEqual(countWords("one two three"), 3, "countWords basic");
assertEqual(
  truncateVoiceover("This is a short line.", 20),
  "This is a short line.",
  "truncateVoiceover under limit"
);

const longScript =
  "Discover the secret to radiant skin with our new serum. It works in just seven days. Try it today and see the difference.";
const truncated = truncateVoiceover(
  longScript,
  18,
  { brandName: "Serum Co", productName: "radiant serum", cta: "Try it today", keyMessage: "glowing skin in seven days" }
);
assert(countWords(truncated) <= 18, "truncateVoiceover respects max words");
assert(/[.!?]$/.test(truncated), "truncateVoiceover ends on complete sentence");
assert(/try it/i.test(truncated), "truncateVoiceover keeps CTA when compressing");

const split = splitVoiceoverForStitch(longScript, 20);
assert(split.part1.length > 0, "splitVoiceover part1 non-empty");
assert(/[.!?]$/.test(split.part1) || countWords(split.part1) <= 20, "split part1 is sentence-safe");
assert(countWords(split.part1) <= 20, "split part1 within per-clip budget");
if (split.part2) assert(countWords(split.part2) <= 20, "split part2 within per-clip budget");

const finalized8 = finalizeVoiceoverForClip(
  "Craving mango? Yoga Bar protein mango shake — 26g protein, no added sugar. Try it today.",
  8,
  { brandName: "Yoga Bar", productName: "protein mango shake" }
);
assert(countWords(finalized8) <= 20, "finalizeVoiceoverForClip caps 8s script at max");
assert(countWords(finalized8) >= budget8.minWords, "finalizeVoiceoverForClip keeps full ad sentences");

const fragmented = validateVoiceoverCommercial("Still skipping breakfast?", {
  brandName: "Yoga Bar",
  productName: "protein shake",
  minWords: 16,
});
assert(!fragmented.valid, "problem-only hook fails validation");
assert(fragmented.missing.includes("cta"), "problem-only hook missing CTA");

const expandedShort = ensurePerformanceAdVoiceover(
  { brandName: "Yoga Bar", productName: "protein shake", keyMessage: "26g protein" },
  "Try it.",
  budget8.maxWords,
  budget8.minWords
);
assert(countWords(expandedShort) >= budget8.minWords, "ensurePerformanceAdVoiceover expands too-short scripts");
const expandedValidation = validateVoiceoverCommercial(expandedShort, {
  brandName: "Yoga Bar",
  productName: "protein shake",
  keyMessage: "26g protein",
  minWords: budget8.minWords,
  maxWords: budget8.maxWords,
});
assert(expandedValidation.valid, "expanded voiceover passes completion validation");

const longVo =
  "Still skipping breakfast every single morning and feeling drained? Yoga Bar protein mango shake fuels your day with 26g protein, no added sugar, real results you can actually feel. Grab yours and try it today.";
const compressed = compressVoiceoverPreservingStructure(
  longVo,
  budget8.maxWords,
  { brandName: "Yoga Bar", productName: "protein mango shake", keyMessage: "26g protein", cta: "Try it today" },
  budget8.minWords
);
assert(countWords(compressed) <= budget8.maxWords, "compressVoiceover fits 8s max words");
assert(compressed.length > 0, "compressVoiceover returns non-empty script");

const full16 =
  "Craving mango? Yoga Bar protein mango shake fuels your morning. Real results after every workout. Grab yours and try it today.";
const split16 = splitVoiceoverForStitch(
  truncateVoiceover(full16, budget16.maxWords),
  budget8.maxWords
);
const clip2Vo = finalizeVoiceoverForClip(split16.part2, 8, {
  totalDurationSeconds: 16,
  segmentIndex: 1,
  segmentCount: 2,
});
assert(countWords(clip2Vo) > 0, "clip 2 keeps pre-split voiceover (no empty wipe)");
assert(countWords(clip2Vo) <= 20, "clip 2 within per-clip budget");
2
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
assert(prompt.includes("STRICT ZERO-TEXT") || /zero on-screen text/i.test(prompt), "prompt includes zero-text rule");
assert(/BEAT-BASED STORYBOARD|CREATIVE TREATMENT|STORYBOARD/i.test(prompt), "prompt includes storyboard or treatment");
assert(estimateVeoPromptTokens(prompt) <= VEO_PROMPT_MAX_TOKENS, `prompt within Veo token limit (${estimateVeoPromptTokens(prompt)} tokens)`);

const sanitizedTreatment = sanitizeVisualTreatmentForVeo(`OVERALL VISION: clean ad
SPOKEN_DIALOGUE:
This old line should be removed.
HEADLINE: Yoga Bar Mango
COLOR GRADE: warm`);
assert(!sanitizedTreatment.includes("old line should be removed"), "sanitizeVisualTreatment removes embedded dialogue");
assert(!sanitizedTreatment.includes("Yoga Bar Mango"), "sanitizeVisualTreatment removes headline blocks");

const strippedStoryboard = stripStoryboardDialogue([
  {
    scene: 1,
    visual_description: "Close-up product",
    voiceover_line: "Old line",
    voiceover_script: "Old line",
    on_screen_text: "Buy now",
    marketing_message: "Shop Yoga Bar today",
    proof_element: "26g protein",
  },
]);
assert(strippedStoryboard?.[0]?.voiceover_line === "", "stripStoryboardDialogue clears voiceover_line");
assert(strippedStoryboard?.[0]?.on_screen_text === "", "stripStoryboardDialogue clears on_screen_text");
assert(strippedStoryboard?.[0]?.marketing_message === "", "stripStoryboardDialogue clears marketing_message");

const perfBoard = [
  {
    scene: 1,
    beat: "Hook",
    marketing_message: "This headline must not appear in Veo prompt",
    visual_description: "Woman opens protein shake bottle",
  },
];
const veoStoryboardLines = buildCompactStoryboardLines(perfBoard as any, "veo");
assert(!veoStoryboardLines.includes("This headline must not appear"), "veo storyboard mode is visual-only");
assert(veoStoryboardLines.includes("opens protein shake"), "veo storyboard keeps visual description");

const resolvedReq = resolveRequestFromApiBody(
  {
    product_name: "TestProduct",
    brand_name: "TestBrand",
    final_video_prompt: "OVERALL VISION: premium.\nSPOKEN_DIALOGUE:\nToo long old copy.\nCOLOR GRADE: warm.",
    storyboard: [{ scene: 1, visual_description: "Shot", voiceover_line: "Leaked line" }],
  },
  {
    clipDurationSeconds: 8,
    totalDurationSeconds: 8,
    aspectRatio: "9:16",
    hasReferenceImages: false,
    voiceoverScript: "Fresh canonical line.",
  }
);
assert(
  !String(resolvedReq.veoInput.finalVideoPrompt || "").includes("Too long old copy"),
  "resolveRequestFromApiBody strips embedded dialogue from final prompt"
);
assert(
  resolvedReq.veoInput.storyboard?.every((scene) => !scene.voiceover_line && !scene.voiceover_script),
  "resolveRequestFromApiBody strips storyboard dialogue"
);
assert(resolvedReq.veoInput.headline == null && resolvedReq.veoInput.subtext == null, "resolveRequestFromApiBody drops headline/subtext");

const largeBase64 = "A".repeat(512_000);
const parsedLarge = parseVideoDataUrl(`data:video/mp4;base64,${largeBase64}`);
assert(parsedLarge != null && parsedLarge.length > 0, "parseVideoDataUrl handles large base64 without stack overflow");
assert(parseVideoDataUrl("not-a-data-url") == null, "parseVideoDataUrl rejects non-data URLs");

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
