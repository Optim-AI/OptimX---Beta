/**
 * Run: npx tsx lib/photo-studio/photo-studio.test.ts
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { recommendShots, shotDirection, SHOTS } from "./shots";
import { normalizeProductProfile } from "./analyze";
import { refineCutout } from "./cutout-refine";
import { CANVAS, renderPackshot } from "./packshot";
import { renderShot } from "./render";
import { prepareMaster } from "./master";
import { shootShot } from "./shoot";
import type { ImageGenerationProvider } from "@/lib/creative-studio/poster-generation/types";

async function main() {
  // Profile normalisation + recommendations
  const food = normalizeProductProfile({ name: "Peri Peri Anchovies", isFood: true, storyProps: ["chillies", "anchovies"], finish: "glossy plastic", sizeClass: "handheld" });
  const recs = recommendShots(food);
  assert.ok(recs.includes("marketplace_white") && recs.includes("in_hand") && recs.includes("levitation") && recs.includes("acrylic_reflection"));
  const sofa = normalizeProductProfile({ name: "Sofa", sizeClass: "large" });
  assert.ok(!recommendShots(sofa).includes("in_hand"), "no in-hand shot for large products");
  assert.equal(normalizeProductProfile({ sizeClass: "huge", viewAngle: "weird" }).sizeClass, "handheld");
  assert.equal(new Set(SHOTS.map((s) => s.id)).size, SHOTS.length);
  const dir = shotDirection("styled_still_life", food, { aspect: "4:5", lighting: "dramatic", backdrop: "#F2C14E" });
  assert.ok(dir.includes("chillies") && dir.includes("#F2C14E") && /hard key light/.test(dir));
  assert.ok(!/softbox/i.test(shotDirection("pedestal", food, { aspect: "4:5", lighting: "studio_soft", backdrop: "#fff" })), "no studio-gear words in set direction");
  console.log("  ok  shot list and direction");

  // Cut-out cleanup: drops a stray logo island and keeps the product
  const W = 200, H = 200;
  const rgba = Buffer.alloc(W * H * 4);
  const paint = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; rgba[i] = 120; rgba[i + 1] = 80; rgba[i + 2] = 40; rgba[i + 3] = a; }
  };
  paint(60, 60, 140, 170, 255); // product
  paint(5, 5, 30, 15, 255); // logo island
  paint(100, 100, 102, 102, 140); // see-through patch inside product
  const refined = await refineCutout(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
  const meta = await sharp(refined).metadata();
  assert.equal(meta.width, 80, "trimmed to the product, logo island dropped");
  assert.equal(meta.height, 110);
  // Multi-part products (earbuds beside their case) keep every sizeable part
  rgba.fill(0);
  paint(20, 60, 120, 160, 255); // case
  paint(150, 120, 175, 150, 255); // earbud (~7% of the case)
  paint(185, 5, 195, 10, 255); // stray speck
  const parts = await sharp(await refineCutout(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())).metadata();
  assert.equal(parts.width, 155, "earbud kept beside the case");
  assert.equal(parts.height, 100, "speck dropped");
  console.log("  ok  cut-out cleanup");

  // Exact packshot: pure white edges for marketplace, right canvas size
  const product = await sharp({ create: { width: 300, height: 400, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
  const white = await renderPackshot({ cutout: product, aspect: "1:1", style: "white" });
  const wm = await sharp(white).metadata();
  assert.deepEqual([wm.width, wm.height], [CANVAS["1:1"].width, CANVAS["1:1"].height]);
  const corner = await sharp(white).extract({ left: 0, top: 0, width: 10, height: 10 }).raw().toBuffer();
  assert.ok(corner.every((v) => v === 255), "marketplace background is pure white");
  console.log("  ok  exact packshot");

  // Guided shot: low fidelity → one corrective reshoot, keep the better
  let calls = 0;
  const prompts: string[] = [];
  const provider = {
    id: "mock",
    async generate(req: any) {
      calls++;
      prompts.push(req.prompt);
      return { ok: true, imageBuffer: await sharp({ create: { width: 64, height: 80, channels: 3, background: "#888" } }).png().toBuffer(), provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  let checks = 0;
  const out = await renderShot({
    shotId: "in_hand", profile: food, settings: { aspect: "4:5", lighting: "studio_soft", backdrop: "#fff" }, aspect: "4:5",
    source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: "g",
    checkFidelity: async () => (++checks === 1 ? { checked: true, score: 4, issues: ["label says Crunchie"] } : { checked: true, score: 9, issues: [] }),
  });
  assert.equal(calls, 2);
  assert.ok(prompts[1].includes("PRODUCT FIDELITY FIX") && prompts[1].includes("Crunchie"));
  assert.equal(out.fidelity, 9);
  assert.equal(out.method, "guided");
  // Exact shot without a cut-out falls back to guided
  const fallback = await renderShot({
    shotId: "marketplace_white", profile: food, settings: { aspect: "1:1", lighting: "studio_soft", backdrop: "#fff" }, aspect: "1:1",
    source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: "g2",
    checkFidelity: async () => ({ checked: true, score: 9, issues: [] }),
  });
  assert.equal(fallback.method, "guided");
  assert.ok(prompts[prompts.length - 1].includes("pure white (#FFFFFF)"));
  console.log("  ok  guided shots and fidelity reshoot");

  // Variations: the second take is a genuinely different photo
  const settings = { aspect: "4:5" as const, lighting: "studio_soft" as const, backdrop: "#E07A5F" };
  const guidedTake = (variation: number) =>
    renderShot({ shotId: "in_hand", profile: food, settings, aspect: "4:5", source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: `v${variation}`, variation, checkFidelity: async () => ({ checked: true, score: 9, issues: [] }) });
  await guidedTake(0);
  assert.ok(!prompts[prompts.length - 1].includes("SECOND TAKE"));
  await guidedTake(1);
  assert.ok(prompts[prompts.length - 1].includes("SECOND TAKE"), "second take asks for a different photo");
  const sweepTake = (variation: number) =>
    renderShot({ shotId: "color_sweep", profile: food, settings, aspect: "4:5", source: { buffer: product, mimeType: "image/png" }, cutout: product, provider, userId: "u", sessionId: "s", generationId: "c", variation });
  assert.ok(!(await sweepTake(0)).buffer.equals((await sweepTake(1)).buffer), "exact second take differs");
  console.log("  ok  variations differ");

  // Scene: the set is built around the product in the frame (edit), then the exact product is put back
  const edits: any[] = [];
  const editProvider = {
    id: "mock",
    async generate(req: any) {
      edits.push(req);
      // A model that keeps the product where it is: return the base image unchanged.
      const base = req.referenceImages[0]?.base64Data;
      const img = base ? Buffer.from(base, "base64") : await sharp({ create: { width: 64, height: 80, channels: 3, background: "#888" } }).png().toBuffer();
      return { ok: true, imageBuffer: img, provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  // A labelled product (stripes), so the "did the product stay put" check has structure to compare.
  const stripes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="200">${Array.from({ length: 10 }, (_, i) => `<rect y="${i * 20}" width="120" height="10" fill="${i % 2 ? "#c33" : "#fff"}"/>`).join("")}</svg>`);
  const labelled = await sharp(stripes).png().toBuffer();
  const scene = await renderShot({ shotId: "styled_still_life", profile: food, settings, aspect: "4:5", source: { buffer: labelled, mimeType: "image/png" }, cutout: labelled, provider: editProvider, userId: "u", sessionId: "s", generationId: "sc" });
  assert.equal(scene.method, "scene");
  assert.equal(edits.length, 1, "one edit when the product stays put");
  assert.equal(edits[0].mode, "edit");
  assert.ok(/built around the product/.test(edits[0].prompt) && /chillies/.test(edits[0].prompt));
  console.log("  ok  scene built around the product");

  // Master packshot: recreated when faithful; upload cut-out only when nothing covers the product
  const cutCalls: Buffer[] = [];
  const cutout = async (b: Buffer) => (cutCalls.push(b), product);
  const masterOf = (score: number, obstructed: boolean) =>
    prepareMaster({
      source: { buffer: Buffer.from("upload"), mimeType: "image/png" },
      profile: { ...food, obstructed },
      provider,
      checkFidelity: async () => ({ checked: true, score, issues: score < 8 ? ["label differs"] : [] }),
      cutout,
      userId: "u",
      sessionId: "s",
    });
  const good = await masterOf(9, true);
  assert.equal(good.via, "recreated");
  assert.ok(good.packshot && !cutCalls[cutCalls.length - 1].equals(Buffer.from("upload")), "cut-out made from the recreated packshot");
  const drifted = await masterOf(5, false);
  assert.equal(drifted.via, "upload");
  assert.ok(cutCalls[cutCalls.length - 1].equals(Buffer.from("upload")));
  const held = await masterOf(5, true);
  assert.equal(held.via, "none", "a held product never uses the upload's cut-out");
  assert.equal(held.cutout, null);
  console.log("  ok  master packshot");

  // Beta: shots are free, and the marketplace image is one photo
  let charged = 0;
  const dataUrl = `data:image/png;base64,${product.toString("base64")}`;
  const results = await shootShot(
    {
      userId: "u", sessionId: "s", shotId: "marketplace_white", variations: 2,
      state: { sourceUrl: dataUrl, masterUrl: dataUrl, cutoutUrl: dataUrl, prepared: true, profile: food, settings, shots: [], results: [] },
    },
    {
      provider,
      store: async () => "mem://photo",
      save: async () => undefined,
      getBalance: async () => 0,
      deduct: async () => (charged++, true),
    }
  );
  assert.equal(results.length, 1, "marketplace main image is a single photo");
  assert.equal(results[0].method, "exact");
  assert.equal(charged, 0, "no credits during the beta");
  console.log("  ok  free beta shots");
  console.log("photo-studio tests passed");
}
void main();
