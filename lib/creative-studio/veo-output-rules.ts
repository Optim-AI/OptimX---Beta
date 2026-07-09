/**
 * Veo output constraints — zero on-screen text; brand + product in audio only.
 */

/** Injected into every Veo prompt. Non-negotiable for ad generation. */
export const VEO_STRICT_NO_TEXT_BLOCK = `
STRICT ZERO-TEXT VIDEO (NON-NEGOTIABLE — 8s, 16s, 9:16, 16:9, 4:5):
- NO readable text, letters, numbers, or symbols anywhere in any frame, clip, or orientation.
- FORBIDDEN: captions, titles, subtitles, lower thirds, chyrons, tickers, watermarks, badges, stickers, price tags, nutritional callouts, flavor callouts, slogans, hashtags, social handles, UI overlays, animated typography, kinetic text, brand typography overlays, floating logos as graphics, end cards with words, duplicate brand marks, decorative lettering, headline graphics, CTA text cards, supers, or any AI-generated text.
- FORBIDDEN in 16s stitched ads: repeating brand/flavor text in Part 1 AND Part 2 — zero typography in both halves.
- ALLOWED ONLY: factory printing already on the physical product pack in the reference photo (never duplicated, enlarged, copied elsewhere, or added as overlay).
- NEVER render brand, product, tagline, or CTA as on-screen typography. All messaging is VOICEOVER ONLY.
- Closing shot (every duration): product hero on clean background — silent hold, NO text, NO logo graphic overlay, NO end-card words.
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
