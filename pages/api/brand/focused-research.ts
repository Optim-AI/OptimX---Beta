// pages/api/brand/focused-research.ts
// Product and regional research (see lib/research/focused-research.ts). Slow (~1–2 min).
//   GET                → saved reports (newest first) + the region list for the picker
//   POST {product, regions} → run one, save it, return it
//   DELETE ?id=…       → remove a saved report
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getUserBrand } from "@/lib/brand-kit/server";
import { normalizeAuditUrl } from "@/lib/audit/url-safety";
import { researchFocused } from "@/lib/research/focused-research";
import { CITIES, STATES, resolveRegions } from "@/lib/research/regions";
import { researchDigest } from "@/lib/research/brand-research";
import { deleteFocusedResearch, getBrandResearch, listFocusedResearch, saveFocusedResearch } from "@/lib/research/store";

export const config = { maxDuration: 240 };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (r: { id: string; name: string; kind: string; stateName: string }) => ({ id: r.id, name: r.name, kind: r.kind, stateName: r.stateName });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  if (req.method === "GET") {
    const reports = await listFocusedResearch(userId).catch(() => []);
    return res.status(200).json({ ok: true, reports, regions: { states: STATES.map(pick), cities: CITIES.map(pick) } });
  }

  if (req.method === "DELETE") {
    const id = text(req.query.id, 80);
    const removed = id ? await deleteFocusedResearch(userId, id) : false;
    return res.status(removed ? 200 : 404).json({ ok: removed });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Record<string, any>;
  const regions = resolveRegions(body.regions);
  const name = text(body.product?.name, 120);
  let productUrl: string | null = null;
  if (text(body.product?.url, 600)) {
    const check = normalizeAuditUrl(body.product.url);
    if (!check.ok) return res.status(400).json({ ok: false, error: "That product link doesn't look right. Check it, or leave it empty." });
    productUrl = check.url;
  }
  if (!name && !regions.length) {
    return res.status(400).json({ ok: false, error: "Pick a product, a region, or both." });
  }

  try {
    const { kit, snapshot } = await getUserBrand(userId);
    const brandName = kit?.name || (snapshot as any)?.brand_name || (snapshot as any)?.name || "";
    if (!brandName) {
      return res.status(400).json({ ok: false, error: "Set up your Brand Kit first so SkalX knows which brand this is for." });
    }
    const website = kit?.websiteUrl || (snapshot as any)?.website_url || null;
    const brandResearch = await getBrandResearch(userId, website).catch(() => null);

    const report = await researchFocused({
      brand: {
        name: brandName,
        description: kit?.identity.description || kit?.identity.offering || "",
        category: kit?.identity.productCategory || kit?.identity.industry || "",
        website,
        digest: brandResearch ? researchDigest(brandResearch, 1500) : "",
      },
      product: name
        ? { name, url: productUrl, details: text(body.product?.details, 600) || null, price: text(body.product?.price, 80) || null }
        : null,
      regions,
    });
    await saveFocusedResearch(userId, report).catch((e) =>
      console.error("[focusedResearch] save failed", { userId, error: (e as Error)?.message })
    );
    console.log("[focusedResearch] done", { userId, product: !!name, regions: regions.length, web: report.evidence.web_research, trends: report.evidence.trends });
    return res.status(200).json({ ok: true, report });
  } catch (e) {
    console.error("[focusedResearch] failed", { userId, error: (e as Error)?.message });
    return res.status(500).json({ ok: false, error: "Research failed. Please try again." });
  }
}
