/**
 * Detect image format from magic bytes (not filename / declared MIME).
 */

export type DetectedImageFormat = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  extension: "jpg" | "png" | "webp" | "gif";
};

export function detectImageFormatFromBuffer(
  buffer: Buffer | Uint8Array | null | undefined
): DetectedImageFormat | null {
  if (!buffer || buffer.length < 12) return null;
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  // GIF: GIF87a / GIF89a
  if (
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return { mimeType: "image/gif", extension: "gif" };
  }

  // WEBP: RIFF....WEBP
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return null;
}

/** Meta Page Photos supported types we accept for publish. */
export function isMetaSupportedImageFormat(
  format: DetectedImageFormat | null
): format is DetectedImageFormat {
  if (!format) return false;
  return (
    format.mimeType === "image/jpeg" ||
    format.mimeType === "image/png" ||
    format.mimeType === "image/gif" ||
    format.mimeType === "image/webp"
  );
}
