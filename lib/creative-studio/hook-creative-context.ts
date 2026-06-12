import type { BrandSnapshot, Product, ProductData } from "@/app/web/src/components/creative-studio/types";

export type HookCreativeInput = {
  hookStatement: string;
  hookType?: string | null;
  whyItWorks?: string | null;
  supportingReviewPhrase?: string | null;
};

export type ContentStudioScanSummary = {
  url: string;
  brandSummary: Record<string, string> | null;
  products: Product[];
};

function normalizeHost(url: string): string {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

/** Build a director brief from ranked hook research signals. */
export function buildHookCreativeBrief(hook: HookCreativeInput): string {
  const parts = [
    `HOOK (primary message): ${hook.hookStatement}`,
    hook.hookType ? `Hook type: ${hook.hookType}` : null,
    hook.whyItWorks ? `Why it works: ${hook.whyItWorks}` : null,
    hook.supportingReviewPhrase ? `Customer evidence: ${hook.supportingReviewPhrase}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

export function buildPosterPromptFromHook(
  hook: HookCreativeInput,
  brand: BrandSnapshot,
  product: Product | null
): string {
  const productLine = product
    ? `Product: ${product.product_name}. ${product.short_benefit || product.description || ""}`.trim()
    : brand.offering || brand.description || "";
  return [
    `Create a high-converting marketing poster for ${brand.name}.`,
    productLine,
    buildHookCreativeBrief(hook),
    product
      ? `CRITICAL — EXACT PRODUCT IMAGE: A reference photo of "${product.product_name}" from Ad Studio is attached. You MUST use this exact product image as the hero — same packaging, colors, label, shape, and branding. Do NOT redraw, replace, or hallucinate a different product. Only change background, layout, typography, and graphics around the product.`
      : null,
    `Visual direction: premium ad creative, product as hero, scroll-stopping composition aligned with the hook.`,
    brand.audience ? `Target audience: ${brand.audience}.` : null,
    brand.tone ? `Brand tone: ${brand.tone}.` : null,
    brand.primaryColors?.length
      ? `Brand colors (mandatory): ${brand.primaryColors.join(", ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildVideoDescriptionFromHook(
  hook: HookCreativeInput,
  brand: BrandSnapshot,
  product: Product | null
): string {
  const productLine = product
    ? `Feature ${product.product_name} (${product.short_benefit || product.description || "key benefits from scan"}).`
    : `Feature ${brand.name} (${brand.offering || brand.description}).`;
  return [
    `Create an 8-second premium video ad for ${brand.name}.`,
    productLine,
    buildHookCreativeBrief(hook),
    "Structure: 0-2s pattern interrupt using the hook → 2-5s product hero → 5-7s benefit/payoff → 7-8s brand lock-in.",
    brand.audience ? `Audience: ${brand.audience}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function mapHookTypeToVideoStyle(hookType?: string | null): string {
  const t = (hookType || "").toLowerCase();
  if (t.includes("ugc") || t.includes("authentic")) return "UGC Style";
  if (t.includes("emotional") || t.includes("aspir") || t.includes("lifestyle")) return "Cinematic";
  if (t.includes("product") || t.includes("close")) return "Product Close-up";
  if (t.includes("luxury") || t.includes("premium")) return "Luxury";
  return "Commercial";
}

/** Prefer brand guideline, fill gaps from CI / content studio. */
export function mergeBrandSnapshots(
  guideline: BrandSnapshot | null | undefined,
  fallback: BrandSnapshot,
  scanBrand?: Record<string, string> | null
): BrandSnapshot {
  const scanName = scanBrand?.brand_name || scanBrand?.name;
  const merged: BrandSnapshot = {
    ...fallback,
    ...(guideline || {}),
    name: guideline?.name || scanName || fallback.name,
    description: guideline?.description || scanBrand?.primary_value_proposition || fallback.description,
    audience: guideline?.audience || scanBrand?.target_audience || fallback.audience,
    offering: guideline?.offering || fallback.offering,
    tone: guideline?.tone || scanBrand?.brand_tone || fallback.tone,
    logo: guideline?.logo || guideline?.logoUrl || fallback.logo,
    logoUrl: guideline?.logoUrl || guideline?.logo || fallback.logoUrl,
    primaryColors: guideline?.primaryColors?.length ? guideline.primaryColors : fallback.primaryColors,
    productCategory: guideline?.productCategory || fallback.productCategory,
    industry: guideline?.industry || scanBrand?.industry || fallback.industry,
    coreValueProp: guideline?.coreValueProp || scanBrand?.primary_value_proposition || fallback.coreValueProp,
  };
  return merged;
}

export function pickProductFromScan(
  products: Product[] | null | undefined,
  brandUrl?: string
): Product | null {
  if (!products?.length) return null;
  if (!brandUrl) return products[0];
  const host = normalizeHost(brandUrl);
  const matched = products.find((p) => {
    const name = (p.product_name || "").toLowerCase();
    return name && host.split(".")[0] && name.includes(host.split(".")[0]);
  });
  return matched || products[0];
}

export function productToProductData(product: Product, brand: BrandSnapshot): ProductData {
  const images = (product.product_images || []).filter(Boolean);
  return {
    product_name: product.product_name,
    brand_name: brand.name,
    product_images: images,
    hero_image: images[0] || null,
    brand_logo: brand.logo || brand.logoUrl || null,
    category: product.category || brand.productCategory || "general",
    product_url: undefined,
  };
}

export type PosterSessionProductData = {
  prompt: string;
  imageDataUrls: string[];
  productName?: string;
  productSource?: "ad-studio";
};

export function productToPosterProductData(
  product: Product,
  posterPrompt: string,
  primaryImageDataUrl: string
): PosterSessionProductData {
  return {
    prompt: posterPrompt,
    imageDataUrls: [primaryImageDataUrl],
    productName: product.product_name,
    productSource: "ad-studio",
  };
}

/** Fetch a single image URL and return a base64 data URL (required for poster generation API). */
export async function resolveImageToDataUrl(
  authFetch: (url: string, init?: RequestInit) => Promise<Response>,
  source: string
): Promise<string | null> {
  const src = source?.trim();
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  if (!src.startsWith("http://") && !src.startsWith("https://")) return null;

  try {
    const res = await authFetch("/api/creative-studio/fetch-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: src, directFetch: true }),
    });
    const data = await res.json();
    if (data.ok && typeof data.dataUrl === "string" && data.dataUrl.startsWith("data:")) {
      return data.dataUrl;
    }
  } catch {
    // fall through
  }
  return null;
}

/** Resolve the hero product image from Ad Studio for poster generation. */
export async function resolvePrimaryProductImageDataUrl(
  authFetch: (url: string, init?: RequestInit) => Promise<Response>,
  product: Product
): Promise<string | null> {
  const hero = (product.product_images || []).find(Boolean);
  if (!hero) return null;
  return resolveImageToDataUrl(authFetch, hero);
}

/** Client-side: load brand guideline + latest content studio scan. */
export async function fetchCreativeStudioContext(
  authFetch: (url: string, init?: RequestInit) => Promise<Response>,
  brandUrl?: string
): Promise<{
  brandGuideline: BrandSnapshot | null;
  scan: ContentStudioScanSummary | null;
  product: Product | null;
}> {
  let brandGuideline: BrandSnapshot | null = null;
  let scan: ContentStudioScanSummary | null = null;

  try {
    const brandRes = await authFetch("/api/brand/snapshot");
    const brandData = await brandRes.json();
    if (brandData.ok && brandData.brandSnapshot) {
      brandGuideline = brandData.brandSnapshot as BrandSnapshot;
    }
  } catch {
    // optional
  }

  try {
    const scansRes = await authFetch("/api/content-studio/scans");
    const scansData = await scansRes.json();
    if (scansData.ok && Array.isArray(scansData.scans) && scansData.scans.length > 0) {
      const host = brandUrl ? normalizeHost(brandUrl) : "";
      const matchedScan =
        host &&
        scansData.scans.find((s: { url?: string }) => s.url && normalizeHost(s.url) === host);
      const latest = matchedScan || scansData.scans[0];
      scan = {
        url: latest.url || "",
        brandSummary: (latest.brandSummary as Record<string, string>) || null,
        products: (latest.products as Product[]) || [],
      };
    }
  } catch {
    // optional
  }

  const product = pickProductFromScan(scan?.products, brandUrl);
  return { brandGuideline, scan, product };
}
