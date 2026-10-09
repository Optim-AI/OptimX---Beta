/**
 * Run: npx --yes tsx lib/media/image-format.test.ts
 */
import assert from "assert";
import { detectImageFormatFromBuffer } from "@/lib/media/image-format";

// Minimal JPEG (SOI + APP0 JFIF stub + EOI) — magic is enough for detector
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
  0xd9,
]);
assert.deepStrictEqual(detectImageFormatFromBuffer(jpeg), {
  mimeType: "image/jpeg",
  extension: "jpg",
});

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
assert.deepStrictEqual(detectImageFormatFromBuffer(png), {
  mimeType: "image/png",
  extension: "png",
});

const webp = Buffer.alloc(12);
webp.write("RIFF", 0);
webp.write("WEBP", 8);
assert.deepStrictEqual(detectImageFormatFromBuffer(webp), {
  mimeType: "image/webp",
  extension: "webp",
});

assert.strictEqual(detectImageFormatFromBuffer(Buffer.from("not-an-image")), null);
assert.strictEqual(detectImageFormatFromBuffer(null), null);

console.log("image-format.test: PASS");
