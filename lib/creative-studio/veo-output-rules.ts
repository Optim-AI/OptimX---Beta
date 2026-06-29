/**
 * Veo output constraints — zero on-screen text; brand + product in audio only.
 */

/** Injected into every Veo prompt. Non-negotiable for ad generation. */
export const VEO_STRICT_NO_TEXT_BLOCK = `
STRICT ZERO-TEXT VIDEO (NON-NEGOTIABLE):
- NO readable text anywhere in the video frame.
- FORBIDDEN: captions, titles, subtitles, lower thirds, slogans, flavor callouts, brand typography overlays, floating logos as graphics, end cards with words, duplicate brand marks, decorative lettering, or any AI-generated text.
- ALLOWED ONLY: the physical product pack/bottle exactly as in the reference photo (factory printing on the pack itself — never duplicated elsewhere in the scene).
- NEVER render the brand name or product name as on-screen typography. Names are spoken in VOICEOVER ONLY.
- Closing shot: product hero on a clean background — silent hold, NO text, NO logo graphic overlay.
`.trim();

/** Spoken phrase: brand + product together, e.g. "Yoga Bar protein mango shake". */
export function buildSpokenBrandedProductPhrase(
  brandName?: string,
  productName?: string
): string {
  const brand = brandName?.trim() || "";
  let product = (productName?.trim() || "product")
    .replace(/\b\d+\s*(gm|g|kg|ml|l|oz|%)\b/gi, "")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!brand) return product || "this product";

  const brandLower = brand.toLowerCase();
  const productLower = product.toLowerCase();
  if (productLower.startsWith(brandLower)) return product;

  return `${brand} ${product}`.replace(/\s+/g, " ").trim();
}
