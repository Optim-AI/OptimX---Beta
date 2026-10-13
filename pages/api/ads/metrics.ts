// pages/api/ads/metrics.ts — warehouse-backed performance API
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { buildWarehouseMetricsPayload } from "@/lib/ads/analytics/warehouse-metrics";
import { FeatureService } from "@/lib/features/feature.service";
import { enforceBasicAnalyticsForMetricsApi } from "@/lib/features/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserIdFromRequest(req);
  const access = userId
    ? await FeatureService.requireFeatureEntitled(userId, "basic_analytics")
    : { enabled: false, comingSoon: false, entitled: false };
  const gate = enforceBasicAnalyticsForMetricsApi({ userId, access });
  if (!gate.ok) {
    return res.status(gate.status).json(gate.body);
  }
  if (!userId) {
    return res.status(401).json({ error: "missing_user" });
  }

  const provider = String(req.query.provider || "meta");
  const payload = await buildWarehouseMetricsPayload({
    userId,
    provider,
    query: {
      start: req.query.start,
      end: req.query.end,
      range: req.query.range,
    },
  });

  if (!payload) {
    return res.status(500).json({ ok: false, error: "metrics_build_failed" });
  }

  return res.status(200).json(payload);
}
