/**
 * Run: npx tsx lib/creative-studio/area-edit.test.ts
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { compositeArea, contextCrop, editPosterArea, normalizeBox } from "./area-edit";
import type { ImageGenerationProvider } from "./poster-generation/types";

async function main() {
  // Selection clean-up
  assert.equal(normalizeBox({ x: 0.1, y: 0.1, w: 0.01, h: 0.3 }), null, "a click is not a selection");
  const clamped = normalizeBox({ x: 0.9, y: -0.2, w: 0.5, h: 0.5 })!;
  assert.ok(clamped.x === 0.9 && clamped.y === 0 && Math.abs(clamped.w - 0.1) < 1e-9 && clamped.h === 0.5, "clamped to the poster");
  assert.equal(normalizeBox({ x: "a" as any, y: 0, w: 0.5, h: 0.5 }), null);
  console.log("  ok  selection");

  // Context crop: a supported ratio, inside the poster, containing the box
  const crop = contextCrop({ x: 0.65, y: 0.88, w: 0.3, h: 0.08 }, 725, 900);
  assert.ok(["1:1", "4:5", "9:16", "1.91:1"].includes(crop.aspect));
  assert.ok(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 725 && crop.top + crop.height <= 900);
  assert.ok(crop.left <= 0.65 * 725 && crop.left + crop.width >= 0.95 * 725, "box is inside the crop");
  console.log("  ok  context crop");

  // Paste-back: outside the box stays identical even if the model changed everything
  const W = 200, H = 250;
  const original = await sharp({ create: { width: W, height: H, channels: 3, background: "#204080" } }).png().toBuffer();
  const edited = await sharp({ create: { width: W, height: H, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const out = await compositeArea(original, edited, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
  const px = async (x: number, y: number) => Array.from(await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer());
  assert.deepEqual(await px(5, 5), [0x20, 0x40, 0x80], "far corner untouched");
  assert.deepEqual(await px(100, 125), [255, 0, 0], "box centre edited");
  console.log("  ok  paste-back");

  // The model gets only the crop, no outline, and the area's position in words
  const seen: any[] = [];
  const provider = {
    id: "mock",
    async generate(req: any) {
      seen.push(req);
      return { ok: true, imageBuffer: edited, provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  const result = await editPosterArea({ poster: original, box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, instruction: "Remove this", provider, userId: "u" });
  assert.equal(seen[0].referenceImages.length, 1, "one image: the section to edit");
  assert.equal(seen[0].mode, "edit");
  assert.ok(/across and .* down this image\. Change: Remove this/.test(seen[0].prompt));
  assert.deepEqual(Array.from(await sharp(result).extract({ left: 5, top: 5, width: 1, height: 1 }).removeAlpha().raw().toBuffer()), [0x20, 0x40, 0x80]);
  console.log("  ok  edit flow");
  console.log("area-edit tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
