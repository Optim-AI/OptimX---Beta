/**
 * Run: npx --yes tsx lib/creative-studio/poster-generation/generation/storage-format.test.ts
 */
import assert from "assert";
import {
  buildPosterStoragePath,
  resolvePosterStorageFormat,
} from "@/lib/creative-studio/poster-generation/generation/storage";

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
  0xd9,
]);
const jpegFmt = resolvePosterStorageFormat(jpeg, "image/png");
assert.strictEqual(jpegFmt.contentType, "image/jpeg");
assert.strictEqual(jpegFmt.extension, "jpg");

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const pngFmt = resolvePosterStorageFormat(png);
assert.strictEqual(pngFmt.contentType, "image/png");
assert.strictEqual(pngFmt.extension, "png");

const path = buildPosterStoragePath({
  userId: "u1",
  sessionId: "s1",
  generationId: "gen_1",
  extension: jpegFmt.extension,
});
assert.strictEqual(path, "poster-generation/u1/s1/gen_1.jpg");
assert.ok(!path.endsWith(".png"));

console.log("poster storage-format.test: PASS");
