/**
 * Run: npx tsx lib/creative-studio/product-cutouts/cutouts.test.ts
 * Set CUTOUT_MODEL_PATH to a local isnet-general-use.onnx to also run the real model.
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { BUILTIN_CUTOUT_ID, BuiltInCutoutProvider, getCutoutProvider, getProductCutout, type CutoutCache, type CutoutCacheRow } from ".";
import { isnetInput, isnetMask } from "./builtin";

async function main() {
  // Provider selection: paid keys win; Photo Studio falls back to the built-in model.
  const id = (env: Record<string, string>, builtin = false) => getCutoutProvider(env as NodeJS.ProcessEnv, { builtin })?.id ?? null;
  assert.equal(id({}), null, "posters keep cut-outs off without a key");
  assert.equal(id({}, true), BUILTIN_CUTOUT_ID);
  assert.equal(id({ PHOTOROOM_API_KEY: "k" }, true), "photoroom");
  assert.equal(id({ REMOVE_BG_API_KEY: "k" }, true), "removebg");
  assert.equal(id({ CUTOUT_PROVIDER: "none", PHOTOROOM_API_KEY: "k" }, true), null);
  assert.equal(id({ CUTOUT_PROVIDER: "builtin" }), BUILTIN_CUTOUT_ID);
  assert.equal(id({ CUTOUT_PROVIDER: "local" }, true), "local-uniform");
  console.log("  ok  provider selection");

  // Pre/post-processing: max-scaled, centred at 0.5, NCHW; mask min-max normalised.
  const input = isnetInput(Buffer.from([0, 128, 255]), 1);
  assert.deepEqual(Array.from(input), [-0.5, Math.fround(128 / 255 - 0.5), 0.5]);
  const mask = isnetMask(Float32Array.from([-2, 0, 2, 6]), 2);
  assert.deepEqual(Array.from(mask), [0, 64, 128, 255]);
  console.log("  ok  model input/output");

  // A built-in cut-out is redone once a paid provider is set up.
  const rows = new Map<string, CutoutCacheRow>();
  const cache: CutoutCache = { get: async (u, h) => rows.get(`${u}:${h}`) ?? null, put: async (u, row) => void rows.set(`${u}:${row.sourceHash}`, row) };
  const product = await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: 120, height: 180, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer(), left: 90, top: 60 }])
    .png()
    .toBuffer();
  const files = new Map<string, Buffer>();
  const calls: string[] = [];
  const deps = (pid: string) => ({
    provider: { id: pid, remove: async () => (calls.push(pid), product) },
    cache,
    store: async ({ sourceHash, png }: { sourceHash: string; png: Buffer }) => (files.set(`mem://${sourceHash}`, png), { url: `mem://${sourceHash}`, storagePath: sourceHash }),
    loadImage: async (src: string) => files.get(src) ?? Buffer.from(`photo:${src}`),
  });
  assert.ok((await getProductCutout({ userId: "u", source: "p" }, deps(BUILTIN_CUTOUT_ID))).ok);
  assert.ok((await getProductCutout({ userId: "u", source: "p" }, deps(BUILTIN_CUTOUT_ID))).cached, "built-in result is reused");
  const upgraded = await getProductCutout({ userId: "u", source: "p" }, deps("photoroom"));
  assert.ok(upgraded.ok && !upgraded.cached && upgraded.provider === "photoroom", "paid provider redoes a built-in cut-out");
  assert.ok((await getProductCutout({ userId: "u", source: "p" }, deps("photoroom"))).cached, "paid result then sticks");
  assert.deepEqual(calls, [BUILTIN_CUTOUT_ID, "photoroom"]);
  console.log("  ok  upgrade from built-in to paid cut-outs");

  if (process.env.CUTOUT_MODEL_PATH) {
    // Red product on a light-grey studio background → the product survives, the backdrop goes.
    const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 235, g: 235, b: 232 } } })
      .composite([{ input: await sharp({ create: { width: 300, height: 460, channels: 3, background: { r: 190, g: 30, b: 40 } } }).png().toBuffer(), left: 250, top: 170 }])
      .jpeg()
      .toBuffer();
    const t = Date.now();
    const png = await new BuiltInCutoutProvider().remove({ buffer: photo, mimeType: "image/jpeg" });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    assert.ok(alphaAt(400, 400) > 200, "product kept");
    assert.ok(alphaAt(40, 40) < 30 && alphaAt(760, 760) < 30, "backdrop removed");
    console.log(`  ok  built-in model (${Date.now() - t} ms)`);
  } else {
    console.log("  --  built-in model skipped (set CUTOUT_MODEL_PATH to run it)");
  }
  console.log("product-cutouts tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
