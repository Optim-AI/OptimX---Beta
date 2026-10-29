// pages/api/brand/research.ts
// Deep brand research (site + live web). Slow (~1 min), so it runs alongside the
// fast /api/brand/fullAnalyze and is saved on the brand snapshot when done.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { normalizeAuditUrl } from "@/lib/audit/url-safety";
import { researchBrand } from "@/lib/research/brand-research";
import { getBrandResearch, saveBrandResearch } from "@/lib/research/store";
import { researchCompetitorAds } from "@/lib/research/competitor-ads";

export const config = {
  maxDuration: 180,
};

const REUSE_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  if (req.method === "GET") {
    const url = typeof req.query.url === "string" ? req.query.url : null;
    const research = await getBrandResearch(userId, url).catch(() => null);
    return res.status(200).json({ ok: true, research });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const check = normalizeAuditUrl(req.body?.url);
  if (!check.ok) return res.status(400).json({ ok: false, error: check.message });
  const force = req.body?.force === true;

  // Refresh only the competitor ads on saved research (fast; e.g. after a new Meta token).
  if (req.body?.adsOnly === true) {
    const saved = await getBrandResearch(userId, check.url).catch(() => null);
    if (!saved) return res.status(404).json({ ok: false, error: "Run the research first." });
    saved.competitor_ads = await researchCompetitorAds({
      competitors: saved.competitors.map((c) => c.name),
      market: saved.snapshot.market,
      accessToken: process.env.META_AD_LIBRARY_ACCESS_TOKEN,
    });
    await saveBrandResearch(userId, saved);
    return res.status(200).json({ ok: true, research: saved, reused: false });
  }

  try {
    if (!force) {
      const saved = await getBrandResearch(userId, check.url).catch(() => null);
      if (saved && Date.now() - Date.parse(saved.generatedAt) < REUSE_FOR_MS) {
        return res.status(200).json({ ok: true, research: saved, reused: true });
      }
    }

    const { research, timings } = await researchBrand(check.url);
    if (!research) {
      return res.status(502).json({ ok: false, error: "Research could not be completed. Please try again." });
    }
    await saveBrandResearch(userId, research).catch((e) =>
      console.error("[brandResearch] save failed", { userId, error: (e as Error)?.message })
    );
    console.log("[brandResearch] done", { userId, site: research.websiteUrl, timings, web: research.evidence.web_research });
    return res.status(200).json({ ok: true, research, reused: false });
  } catch (e) {
    const message = (e as Error)?.message || "";
    console.error("[brandResearch] failed", { userId, error: message });
    const status = /could not open the website/i.test(message) ? 422 : 500;
    return res.status(status).json({
      ok: false,
      error: status === 422 ? "We couldn't open that website." : "Research failed. Please try again.",
    });
  }
}
