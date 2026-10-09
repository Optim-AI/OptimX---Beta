// pages/api/ads/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { runAdsSync } from "@/lib/ads/sync/runner";
import { PLATFORMS } from "@/integrations/store";

/**
 * POST { provider, since?, until?, lookbackDays? }
 * Manual sync for the authenticated user.
 *
 * Cron (GET or POST):
 *   /api/ads/sync?cron=1
 *   Authorization: Bearer $CRON_SECRET  (recommended)
 *   or Vercel Cron header x-vercel-cron: 1
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  const vercelCron = String(req.headers["x-vercel-cron"] || "") === "1";
  const wantsCron = req.query.cron === "1" || req.body?.cron === true || vercelCron;

  if (wantsCron && (req.method === "GET" || req.method === "POST")) {
    const authorized =
      vercelCron ||
      (!!cronSecret && auth === `Bearer ${cronSecret}`) ||
      (!cronSecret && process.env.NODE_ENV !== "production");

    if (!authorized) {
      return res.status(401).json({ error: "unauthorized_cron" });
    }

    const providers = req.body?.provider
      ? [String(req.body.provider)]
      : typeof req.query.provider === "string"
        ? [req.query.provider]
        : ["meta", "google-ads", "linkedin"];

    const { db } = await import("@/database/client");
    const { integrations } = await import("@/database/schema");
    const { eq } = await import("drizzle-orm");

    const results: any[] = [];
    for (const provider of providers) {
      const rows = await db
        .select()
        .from(integrations)
        .where(eq(integrations.provider, provider));

      for (const row of rows) {
        if (!row.adAccountId) continue;
        try {
          const r = await runAdsSync({
            userId: row.userId,
            provider,
            triggerSource: "cron",
            lookbackDays: Number(req.body?.lookbackDays || req.query.lookbackDays) || 7,
          });
          results.push({ userId: row.userId, provider, ...r });
        } catch (e: any) {
          results.push({
            userId: row.userId,
            provider,
            ok: false,
            error: e?.message,
          });
        }
      }
    }
    return res.status(200).json({ ok: true, cron: true, results });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const provider = String(req.body?.provider || "");
    if (!PLATFORMS.includes(provider as any)) {
      return res.status(400).json({ error: "invalid_provider" });
    }
    if (!["meta", "google-ads", "linkedin"].includes(provider)) {
      return res.status(400).json({ error: "provider_not_supported_for_ads_sync" });
    }

    const result = await runAdsSync({
      userId,
      provider,
      since: req.body?.since,
      until: req.body?.until,
      lookbackDays: Number(req.body?.lookbackDays) || 30,
      triggerSource: "manual",
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("ads sync error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "sync_failed",
    });
  }
}
