/**
 * Competitor ads — what the named competitors are running on Meta right now.
 *
 * Meta's Ad Library API only returns commercial ads delivered in the EU (plus
 * political/issue ads everywhere), so for many markets it finds nothing. Every
 * competitor therefore also gets a link to Meta's public Ad Library, which shows
 * all active ads in any country.
 *
 * Server-only. Never returns the access token (Meta's ad_snapshot_url embeds it,
 * so ads link to the public Ad Library page instead).
 */

import { META_GRAPH_VERSION } from "./competitor-research";
import { generateResearchJson } from "./gemini";
import { adLibrarySearchUrl, countryCodeFor } from "./ad-library-links";

export type CompetitorAd = {
  id: string;
  body: string;
  title?: string;
  startedAt?: string;
  daysRunning?: number;
  platforms: string[];
  libraryUrl: string;
};

export type CompetitorAdsEntry = {
  name: string;
  pageName?: string;
  libraryUrl: string;
  activeAds: number;
  ads: CompetitorAd[];
  /** What their ads lead with (only when ads were found). */
  leadsWith?: string;
};

export type CompetitorAdsReport = {
  status: "ok" | "none_found" | "no_token" | "token_invalid" | "error";
  country: string;
  checkedAt: string;
  competitors: CompetitorAdsEntry[];
  patterns: string[];
  implication: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function sameBrand(pageName: string, competitor: string): boolean {
  const a = norm(pageName);
  const b = norm(competitor.split(/[(\-–|]/)[0]);
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
}

type GraphAd = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  publisher_platforms?: string[];
};

class MetaTokenError extends Error {}

async function searchAds(token: string, term: string): Promise<GraphAd[]> {
  const params = new URLSearchParams({
    search_terms: term.slice(0, 100),
    ad_reached_countries: JSON.stringify(["ALL"]),
    ad_active_status: "ACTIVE",
    ad_type: "ALL",
    limit: "50",
    fields: "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,publisher_platforms",
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: GraphAd[]; error?: { code?: number; message?: string } };
  if (json.error) {
    // 190 = invalid/expired token; 10/200 = missing ads_read / Ad Library access
    if ([190, 10, 200].includes(Number(json.error.code))) throw new MetaTokenError(json.error.message || "token");
    throw new Error(json.error.message || `Meta ${res.status}`);
  }
  return json.data || [];
}

function toAd(ad: GraphAd, now: number): CompetitorAd {
  const started = ad.ad_delivery_start_time ? Date.parse(ad.ad_delivery_start_time) : NaN;
  return {
    id: ad.id,
    body: (ad.ad_creative_bodies?.[0] || "").replace(/\s+/g, " ").trim().slice(0, 500),
    title: ad.ad_creative_link_titles?.[0]?.trim().slice(0, 140) || undefined,
    startedAt: Number.isFinite(started) ? new Date(started).toISOString().slice(0, 10) : undefined,
    daysRunning: Number.isFinite(started) ? Math.max(0, Math.round((now - started) / 86_400_000)) : undefined,
    platforms: ad.publisher_platforms || [],
    libraryUrl: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.id)}`,
  };
}

/** Longest-running first (a proxy for ads that work), distinct copy only. */
function pickAds(ads: CompetitorAd[], n: number): CompetitorAd[] {
  const seen = new Set<string>();
  return ads
    .filter((a) => a.body || a.title)
    .sort((a, b) => (b.daysRunning ?? 0) - (a.daysRunning ?? 0))
    .filter((a) => {
      const k = norm(a.body.slice(0, 80));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

export async function researchCompetitorAds(input: {
  competitors: string[];
  market?: string;
  brandName?: string;
  accessToken?: string | null;
}): Promise<CompetitorAdsReport> {
  const country = countryCodeFor(input.market);
  const names = input.competitors.filter(Boolean).slice(0, 6);
  const base = (status: CompetitorAdsReport["status"], competitors?: CompetitorAdsEntry[]): CompetitorAdsReport => ({
    status,
    country,
    checkedAt: new Date().toISOString(),
    competitors:
      competitors ?? names.map((name) => ({ name, libraryUrl: adLibrarySearchUrl(name, country), activeAds: 0, ads: [] })),
    patterns: [],
    implication: "",
  });

  const token = input.accessToken?.trim();
  if (!token) return base("no_token");

  const now = Date.now();
  let entries: CompetitorAdsEntry[];
  try {
    entries = await Promise.all(
      names.map(async (name) => {
        const found = (await searchAds(token, name)).filter((a) => a.page_name && sameBrand(a.page_name, name));
        const ads = found.map((a) => toAd(a, now));
        return {
          name,
          pageName: found[0]?.page_name,
          libraryUrl: adLibrarySearchUrl(name, country),
          activeAds: ads.length,
          ads: pickAds(ads, 4),
        };
      })
    );
  } catch (e) {
    if (e instanceof MetaTokenError) {
      console.warn("[competitorAds] Meta token rejected", e.message.slice(0, 120));
      return base("token_invalid");
    }
    console.warn("[competitorAds] failed", (e as Error)?.message);
    return base("error");
  }

  const withAds = entries.filter((e) => e.ads.length);
  if (!withAds.length) return base("none_found", entries);

  // Read what the ads lead with — from the ad copy only.
  try {
    const raw = await generateResearchJson<{
      competitors?: Array<{ name?: string; leads_with?: string }>;
      patterns?: string[];
      implication?: string;
    }>(
      `These are competitors' live Meta ads (longest-running first). For each competitor, say in one line what their ads lead with (offer, claim, emotion, format). Then list 2-4 patterns across them, and one sentence on what it means for ${input.brandName || "the brand"}: what to avoid copying and where the gap is.

${withAds
  .map(
    (e) =>
      `== ${e.name} (${e.activeAds} active ads)\n${e.ads
        .map((a) => `- [${a.daysRunning ?? "?"} days] ${a.title ? a.title + " — " : ""}${a.body}`)
        .join("\n")}`
  )
  .join("\n\n")}

Return JSON: {"competitors":[{"name":"","leads_with":""}],"patterns":[""],"implication":""}
Plain text, no markdown. Only describe what the copy shows.`,
      { temperature: 0.3, label: "competitor-ads", timeoutMs: 45_000 }
    );
    for (const c of raw.competitors || []) {
      const hit = entries.find((e) => norm(e.name) === norm(c.name || ""));
      if (hit && c.leads_with) hit.leadsWith = String(c.leads_with).replace(/\*/g, "").slice(0, 240);
    }
    return {
      ...base("ok", entries),
      patterns: (raw.patterns || []).map((p) => String(p).replace(/\*/g, "").slice(0, 200)).slice(0, 4),
      implication: String(raw.implication || "").replace(/\*/g, "").slice(0, 400),
    };
  } catch {
    return base("ok", entries);
  }
}
