/**
 * Clean product names scraped from shop pages and catalogs.
 *
 * Page titles carry SEO and site-name tails ("Beef Pickle Online | Homemade Beef
 * Pickle | oorgaa", "Pickle Bundle – Pack of 6 - oorgaa - classic combo"). The name
 * reaches prompts and the spoken voiceover, so the tails must go.
 */

const SEO_WORDS = /\b(?:buy|online|shop|order|best price|free shipping)\b/gi;

export function cleanProductName(raw: string | null | undefined, brandName?: string | null): string {
  let name = String(raw || "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return "";

  // "Product | Tagline | Site" → the first part is the product.
  name = name.split(/\s+[|•·]\s+/)[0].trim();

  // "Product - brand - collection" → stop at the brand segment.
  const brand = brandName?.trim().toLowerCase();
  if (brand) {
    // Split keeping the separators (odd indexes) so dashes are preserved on rejoin.
    const pieces = name.split(/(\s+[-–—]\s+)/);
    const at = pieces.findIndex((p, i) => i > 0 && i % 2 === 0 && p.trim().toLowerCase() === brand);
    if (at > 0) name = pieces.slice(0, at - 1).join("");
    // Trailing brand on its own ("Beef Pickle by oorgaa", "Beef Pickle oorgaa").
    name = name.replace(new RegExp(`\\s+(?:by\\s+)?${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "");
  }

  const stripped = name.replace(SEO_WORDS, "").replace(/\s{2,}/g, " ").trim();
  // Only drop SEO words when something meaningful is left.
  return (stripped.length >= 3 ? stripped : name).slice(0, 120);
}

/** Best product-name candidate from a product page's HTML. */
export function productNameFromHtml(html: string): string {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const data = JSON.parse(m[1].trim());
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      const product = nodes.find((n: { "@type"?: string | string[] }) =>
        [].concat((n?.["@type"] as never) || []).some((t: string) => /^product$/i.test(t))
      );
      if (product?.name) return String(product.name);
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  const h1 = html.match(/<h1[^>]*>\s*([^<]{2,200}?)\s*<\/h1>/i)?.[1];
  if (h1) return h1;
  const og = html.match(/property="og:title"[^>]*content="([^"]+)"/i)?.[1] || html.match(/content="([^"]+)"[^>]*property="og:title"/i)?.[1];
  if (og) return og;
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
}
