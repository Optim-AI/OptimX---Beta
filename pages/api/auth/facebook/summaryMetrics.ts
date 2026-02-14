// pages/api/auth/facebook/summaryMetrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function getContext(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "missing_user", details: userErr?.message ?? "no session" };
  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "meta")
    .limit(1)
    .maybeSingle();
  if (intErr) return { error: "db_error", details: intErr.message };
  if (!integration) return { error: "no_integration", details: "No meta integration for user" };
  return { supabase, user, integration };
}

function sumNumeric(v: any): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
function normalizeCurrencyValueMaybeMinorUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Number.isInteger(n) && Math.abs(n) >= 1000) return n / 100;
  return n;
}
function stripActPrefix(id?: string | null) {
  if (!id) return null;
  return String(id).replace(/^act_/, "");
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

type GraphFetchResp = { ok: boolean; status: number; text: string; json: unknown | null; url: string; };

async function fetchGraphText(url: string): Promise<GraphFetchResp> {
  const gRes = await fetch(url);
  const text = await gRes.text();
  let parsed: unknown | null = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { ok: gRes.ok, status: gRes.status, text, json: parsed, url };
}

function parseISODateString(s?: string | string[] | null): Date | null {
  if (!s) return null;
  const str = Array.isArray(s) ? s[0] : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function daysForPreset(preset: string) {
  switch (preset) {
    case "1d": return 1; case "7d": return 7; case "15d": return 15; case "1m": return 30;
    case "3m": return 90; case "6m": return 180; case "1y": return 365; default: return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await getContext(req, res);
    if ((ctx as any).error) return res.status(401).json(ctx);
    const { integration } = ctx as any;

    const userAccessToken = integration?.access_token || integration?.metadata?.userAccessToken || integration?.metadata?.pageAccessToken || integration?.raw?.tokenJson?.access_token;
    let rawAdAccount = integration?.ad_account_id || integration?.metadata?.adAccountId || integration?.raw?.adAccountsJson?.data?.[0]?.account_id || process.env.AD_ACCOUNT_ID || null;

    if (!userAccessToken || !rawAdAccount) {
      return res.status(400).json({ error: "Missing userAccessToken or adAccountId in integration or env" });
    }

    const numericAdId = String(stripActPrefix(rawAdAccount));
    if (!numericAdId) return res.status(400).json({ error: "adAccountId could not be parsed" });
    const graphAdAccount = `act_${numericAdId}`;

    const { range: rangeQ, start: startQ, end: endQ } = req.query;
    let currRange: { since: string; until: string };
    let prevRange: { since: string; until: string };

    function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d; }

    if (startQ && endQ) {
      const startDate = parseISODateString(startQ); const endDate = parseISODateString(endQ);
      if (!startDate || !endDate) return res.status(400).json({ error: "Invalid start or end. Use YYYY-MM-DD." });
      if (startDate.getTime() > endDate.getTime()) return res.status(400).json({ error: "start must be <= end" });
      const msPerDay = 24 * 60 * 60 * 1000;
      const lengthDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
      const prevEnd = new Date(startDate.getTime() - msPerDay);
      const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * msPerDay);
      currRange = { since: isoDate(startDate), until: isoDate(endDate) };
      prevRange = { since: isoDate(prevStart), until: isoDate(prevEnd) };
    } else if (rangeQ) {
      const preset = Array.isArray(rangeQ) ? rangeQ[0] : (rangeQ ?? "7d");
      const days = daysForPreset(preset);
      if (!days) return res.status(400).json({ error: "Unsupported range preset." });
      const end = yesterday(); const start = new Date(end); start.setDate(end.getDate() - (days - 1));
      const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1); const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - (days - 1));
      currRange = { since: isoDate(start), until: isoDate(end) }; prevRange = { since: isoDate(prevStart), until: isoDate(prevEnd) };
    } else {
      const today = new Date(); const endCurr = new Date(today); endCurr.setDate(endCurr.getDate() - 1);
      const startCurr = new Date(endCurr); startCurr.setDate(startCurr.getDate() - 6);
      const endPrev = new Date(startCurr); endPrev.setDate(endPrev.getDate() - 1);
      const startPrev = new Date(endPrev); startPrev.setDate(startPrev.getDate() - 6);
      currRange = { since: isoDate(startCurr), until: isoDate(endCurr) }; prevRange = { since: isoDate(startPrev), until: isoDate(endPrev) };
    }

    const fields = ["spend","impressions","reach","clicks","actions","action_values"].join(",");

    async function fetchInsightsForRange(range: { since: string; until: string }): Promise<GraphFetchResp> {
      const timeRangeStr = encodeURIComponent(JSON.stringify(range));
      const urlsToTry = [
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(graphAdAccount)}/insights?time_range=${timeRangeStr}&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}&limit=500`,
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(numericAdId)}/insights?time_range=${timeRangeStr}&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}&limit=500`,
      ];
      let last: GraphFetchResp | null = null;
      for (const u of urlsToTry) {
        try {
          const r = await fetchGraphText(u);
          last = r;
          if (r.ok && r.json) return r;
          if (!r.ok && r.json) return r;
        } catch (err) {
          last = { ok: false, status: 500, text: String(err), json: null, url: u };
        }
      }
      return last ?? { ok: false, status: 500, text: "no response", json: null, url: urlsToTry[0] };
    }

    const [currRaw, prevRaw] = await Promise.all([fetchInsightsForRange(currRange), fetchInsightsForRange(prevRange)]);

    function aggregateInsights(rawObj: GraphFetchResp | null) {
      const parsed = rawObj?.json ?? null;
      let rows: any[] = [];
      if (parsed && typeof parsed === "object") {
        const asAny = parsed as any;
        if (Array.isArray(asAny.data)) rows = asAny.data;
        else if (Array.isArray(asAny)) rows = asAny;
      }
      const agg: any = { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, purchase_value: 0, ctr: 0, roas: null };
      for (const r of rows) {
        agg.spend += sumNumeric(r.spend); agg.impressions += sumNumeric(r.impressions); agg.reach += sumNumeric(r.reach); agg.clicks += sumNumeric(r.clicks);
        if (Array.isArray(r.actions)) {
          for (const a of r.actions) {
            const actionType = String(a.action_type ?? a.action_type_name ?? "").toLowerCase();
            const valueNum = sumNumeric(a.value);
            if (["offsite_conversion","purchase","lead","omni_purchase","conversion"].some(k => actionType.includes(k))) agg.conversions += valueNum;
            else { if (actionType.includes("lead")) agg.conversions += valueNum; }
          }
        }
        if (Array.isArray(r.action_values)) {
          for (const av of r.action_values) {
            const at = String(av.action_type ?? "").toLowerCase();
            const v = sumNumeric(av.value);
            if (["purchase","offsite_conversion"].some(k => at.includes(k))) agg.purchase_value += v;
          }
        }
      }
      agg.ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      agg.roas = agg.spend > 0 ? agg.purchase_value / agg.spend : null;
      return agg;
    }

    const currAgg = currRaw && currRaw.ok ? aggregateInsights(currRaw) : aggregateInsights(currRaw ?? null);
    const prevAgg = prevRaw && prevRaw.ok ? aggregateInsights(prevRaw) : aggregateInsights(prevRaw ?? null);

    async function fetchCampaignsBudget() {
      const urls = [
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(graphAdAccount)}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&access_token=${encodeURIComponent(userAccessToken)}&limit=200`,
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(numericAdId)}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&access_token=${encodeURIComponent(userAccessToken)}&limit=200`,
      ];
      for (const u of urls) {
        const info = await fetchGraphText(u);
        if (info.ok && info.json) {
          const maybe = info.json as any;
          const rows = Array.isArray(maybe?.data) ? maybe.data : Array.isArray(maybe) ? maybe : [];
          let dailySumMajor = 0, lifetimeSumMajor = 0;
          for (const c of rows) {
            const rawDaily = sumNumeric(c.daily_budget); const rawLifetime = sumNumeric(c.lifetime_budget);
            dailySumMajor += normalizeCurrencyValueMaybeMinorUnit(rawDaily);
            lifetimeSumMajor += normalizeCurrencyValueMaybeMinorUnit(rawLifetime);
          }
          return { daily_budget_sum: dailySumMajor, lifetime_budget_sum: lifetimeSumMajor, count: rows.length, raw: info.json, ok: true, url: info.url };
        }
      }
      return { daily_budget_sum: 0, lifetime_budget_sum: 0, count: 0, raw: { currRaw, prevRaw }, ok: false };
    }

    const budgetInfo = await fetchCampaignsBudget();
    const changePct = (curr: number | null, prev: number | null) => { const c = curr ?? 0; const p = prev ?? 0; if (p === 0) return c === 0 ? 0 : 100; return ((c - p) / Math.abs(p)) * 100; };

    const response = {
      ok: true,
      ranges: { current: currRange, previous: prevRange },
      meta: {
        current: { total_spend: currAgg.spend, budget_estimate_daily: budgetInfo?.daily_budget_sum ?? 0, total_reach: currAgg.reach, avg_ctr: currAgg.ctr, conversions: currAgg.conversions, roas: currAgg.roas, purchase_value: currAgg.purchase_value },
        previous: { total_spend: prevAgg.spend, total_reach: prevAgg.reach, avg_ctr: prevAgg.ctr, conversions: prevAgg.conversions, roas: prevAgg.roas, purchase_value: prevAgg.purchase_value },
        change: { total_spend_pct: changePct(currAgg.spend, prevAgg.spend), total_reach_pct: changePct(currAgg.reach, prevAgg.reach), avg_ctr_pct: changePct(currAgg.ctr, prevAgg.ctr), conversions_pct: changePct(currAgg.conversions, prevAgg.conversions), roas_pct: currAgg.roas === null || prevAgg.roas === null ? null : changePct(currAgg.roas, prevAgg.roas) },
        raw: { currentRaw: currRaw ?? null, previousRaw: prevRaw ?? null, budgetInfo, adAccountUsed: { numericAdId, graphAdAccount, original: rawAdAccount } },
      },
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("summaryMetrics error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
