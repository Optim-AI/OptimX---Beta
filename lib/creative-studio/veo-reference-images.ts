/**
 * Veo reference image assembly — product photos are passed through unchanged when possible.
 */

import sharp from "sharp";

export const VEO_MAX_REFERENCE_IMAGES = 3;

/** Parse image data URL without regex on large base64 payloads. */
export function parseImageDataUrl(
  dataUrl: string
): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl?.startsWith("data:")) return null;
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;
  const meta = dataUrl.slice(5, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  if (!meta.includes("base64") || !base64) return null;
  const mimeType = meta.split(";")[0].trim();
  if (!mimeType.startsWith("image/")) return null;
  return { mimeType, imageBytes: base64 };
}

/**
 * Convert to Veo-supported format. JPEG/PNG bytes are returned unchanged (no re-encode).
 * WebP/GIF → PNG to preserve label detail.
 */
export async function convertToVeoReferenceFormat(
  buffer: Buffer,
  inputMime: string
): Promise<{ imageBytes: string; mimeType: string }> {
  const mime = inputMime.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpeg" || mime === "image/png") {
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
  try {
    const sharpInput = mime.includes("svg") ? { density: 144 } : undefined;
    const converted = await sharp(buffer, sharpInput).png().toBuffer();
    return { imageBytes: converted.toString("base64"), mimeType: "image/png" };
  } catch (e) {
    console.warn("Sharp conversion failed, passing through:", e);
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
}

export async function fetchImageForVeoReference(
  url: string
): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const parsed = parseImageDataUrl(url);
      if (!parsed) return null;
      const buffer = Buffer.from(parsed.imageBytes, "base64");
      return convertToVeoReferenceFormat(buffer, parsed.mimeType);
    }

    const response = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0 (compatible; OptimX-VideoGenerator/1.0)",
      },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch image from URL: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(mimeType)) {
      console.warn(`Unsupported image type: ${mimeType}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const result = await convertToVeoReferenceFormat(buffer, mimeType);
    if (result.imageBytes.length > 14_000_000) {
      console.warn("Image too large, skipping");
      return null;
    }
    return result;
  } catch (error) {
    console.warn("Error fetching image:", error);
    return null;
  }
}

export type VeoReferenceAsset = {
  image: { imageBytes: string; mimeType: string };
  referenceType: "asset";
};

export async function createVeoReferenceAsset(
  imageSource: string
): Promise<VeoReferenceAsset | null> {
  const imageData = await fetchImageForVeoReference(imageSource);
  if (!imageData) return null;
  return {
    image: { imageBytes: imageData.imageBytes, mimeType: imageData.mimeType },
    referenceType: "asset",
  };
}

/**
 * Collect reference sources — hero product first, then extra product angles, logo last.
 * Never duplicates; preserves fetched product image order.
 */
export function collectProductReferenceSources(args: {
  hero_image?: string | null;
  product_images?: string[] | null;
  brand_logo?: string | null;
  max?: number;
}): string[] {
  const max = args.max ?? VEO_MAX_REFERENCE_IMAGES;
  const hero = args.hero_image?.trim() || "";
  const logo = args.brand_logo?.trim() || "";
  const products = Array.isArray(args.product_images)
    ? args.product_images.filter((img): img is string => Boolean(img?.trim()))
    : [];

  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (src: string) => {
    if (!src || seen.has(src) || ordered.length >= max) return;
    seen.add(src);
    ordered.push(src);
  };

  push(hero);
  for (const img of products) {
    if (img !== hero && img !== logo) push(img);
  }
  if (ordered.length < max) push(logo);

  return ordered;
}

export async function buildVeoReferenceAssets(args: {
  hero_image?: string | null;
  product_images?: string[] | null;
  brand_logo?: string | null;
  extra?: string[];
}): Promise<VeoReferenceAsset[]> {
  const base = collectProductReferenceSources(args);
  const extras = (args.extra || []).filter(Boolean);
  const sources = [...base];
  for (const src of extras) {
    if (sources.length >= VEO_MAX_REFERENCE_IMAGES) break;
    if (!sources.includes(src)) sources.push(src);
  }

  const results = await Promise.all(sources.map((src) => createVeoReferenceAsset(src)));
  return results.filter((r): r is VeoReferenceAsset => r != null).slice(0, VEO_MAX_REFERENCE_IMAGES);
}
