// pages/api/ads/metrics.ts — warehouse-backed performance API
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { IntegrationDAO } from "@/database";
import { AdMetricsDAO } from "@/database/models/AdMetrics.dao";
import { AdPlatformEntityDAO } from "@/database/models/AdMetrics.dao";
import { daysAgo, isoDate, deriveMetricRates, emptyAggregatedMetrics } from "@/lib/ads/types";

function daysForPreset(preset: string) {
  switch (preset) {
    case "1d":
      return 1;
    case "7d":
      return 7;
    case "15d":
      return 15;
    case "1m":
      return 30;
    case "3m":
      return 90;
    case "6m":
      return 180;
    case "1y":
      return 365;
    default:
      return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "missing_user" });

  const provider = String(req.query.provider || "meta");
  const integration = await IntegrationDAO.findByUserAndProvider(userId, provider);
  if (!integration) {
    return res.status(200).json({
      ok: true,
      source: "none",
      current: null,
      previous: null,
      campaigns: [],
    });
  }

  let since: string;
  let until: string;
  if (req.query.start && req.query.end) {
    since = String(req.query.start);
    until = String(req.query.end);
  } else {
    const preset = String(req.query.range || "7d");
    const days = daysForPreset(preset) || 7;
    until = daysAgo(1);
    since = daysAgo(days);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const sinceDate = new Date(since + "T00:00:00Z");
  const untilDate = new Date(until + "T00:00:00Z");
  const lengthDays =
    Math.round((untilDate.getTime() - sinceDate.getTime()) / msPerDay) + 1;
  const prevUntil = new Date(sinceDate.getTime() - msPerDay);
  const prevSince = new Date(prevUntil.getTime() - (lengthDays - 1) * msPerDay);
  const prevSinceStr = isoDate(prevSince);
  const prevUntilStr = isoDate(prevUntil);

  const hasData = await AdMetricsDAO.hasData(integration.id);
  if (!hasData) {
    return res.status(200).json({
      ok: true,
      source: "empty",
      message: "No synced metrics yet. Trigger POST /api/ads/sync.",
      ranges: { current: { since, until }, previous: { since: prevSinceStr, until: prevUntilStr } },
      current: null,
      previous: null,
      campaigns: [],
      integrationId: integration.id,
    });
  }

  const current = await AdMetricsDAO.aggregateRange(
    integration.id,
    since,
    until,
    "account"
  );
  const previous = await AdMetricsDAO.aggregateRange(
    integration.id,
    prevSinceStr,
    prevUntilStr,
    "account"
  );

  const campaignRows = await AdMetricsDAO.listCampaignMetrics(
    integration.id,
    since,
    until
  );

  // Roll up campaign metrics by entity id
  const byCampaign = new Map<string, ReturnType<typeof emptyAggregatedMetrics>>();
  for (const row of campaignRows) {
    const id = row.entityExternalId;
    const agg = byCampaign.get(id) || emptyAggregatedMetrics();
    agg.spend += Number(row.spend || 0);
    agg.impressions += Number(row.impressions || 0);
    agg.reach += Number(row.reach || 0);
    agg.clicks += Number(row.clicks || 0);
    agg.conversions += Number(row.conversions || 0);
    agg.conversionValue += Number(row.conversionValue || 0);
    byCampaign.set(id, agg);
  }

  const entities = await AdPlatformEntityDAO.listByIntegration(
    integration.id,
    "campaign"
  );
  const nameById = new Map(entities.map((e) => [e.externalId, e.name]));

  const campaigns = [...byCampaign.entries()].map(([id, agg]) => {
    const d = deriveMetricRates(agg);
    return {
      id,
      name: nameById.get(id) || id,
      spend: d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      conversions: d.conversions,
      conversion_value: d.conversionValue,
      ctr: d.ctr,
      cpc: d.cpc,
      cpa: d.cpa,
      roas: d.roas,
    };
  });

  function changePct(curr: number | null, prev: number | null) {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  return res.status(200).json({
    ok: true,
    source: "warehouse",
    provider,
    ranges: {
      current: { since, until },
      previous: { since: prevSinceStr, until: prevUntilStr },
    },
    current: {
      total_spend: current.spend,
      total_reach: current.reach,
      impressions: current.impressions,
      clicks: current.clicks,
      avg_ctr: current.ctr,
      cpc: current.cpc,
      cpm: current.cpm,
      conversions: current.conversions,
      conversion_value: current.conversionValue,
      cpa: current.cpa,
      cpl: current.cpl,
      roas: current.roas,
      frequency: current.frequency,
    },
    previous: {
      total_spend: previous.spend,
      total_reach: previous.reach,
      avg_ctr: previous.ctr,
      conversions: previous.conversions,
      roas: previous.roas,
      conversion_value: previous.conversionValue,
    },
    change: {
      total_spend_pct: changePct(current.spend, previous.spend),
      total_reach_pct: changePct(current.reach, previous.reach),
      avg_ctr_pct: changePct(current.ctr, previous.ctr),
      conversions_pct: changePct(current.conversions, previous.conversions),
      roas_pct: changePct(current.roas, previous.roas),
    },
    campaigns,
  });
}
