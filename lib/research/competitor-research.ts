/**
 * Competitor discovery shared by Creative Intelligence and the free marketing audit.
 * Google search via SerpApi (serpapi.com). Meta Ad Library via Graph API, with a
 * SearchApi.io fallback only when that provider's Meta engines are available.
 * Server-only: reads API keys from env and never returns them.
 */

import { serpGoogleSearch, serpGoogleSearchDetailed } from './serp-search';

export const AMBIGUOUS_BRAND_WORDS = new Set([
  "boat", "apple", "orange", "nothing", "noise", "real", "one", "true", "pure", "simple",
  "basic", "prime", "core", "peak", "bolt", "spark", "nova", "pixel", "nest", "echo",
]);

export type BrandContext = {
  brand_name: string;
  domain_name: string;
  industry_category: string;
  product_category: string;
  primary_keywords: string[];
  country: string;
  price_positioning?: string;
  is_ambiguous_brand?: boolean;
  official_facebook_url?: string | null;
  official_instagram_url?: string | null;
};

export type CompetitorSearchHit = {
  domain: string;
  title: string;
  snippet: string;
  url: string;
  date?: string;
};

export type CompetitorSearchBatch = {
  results: CompetitorSearchHit[];
  queries: string[];
  outcome: 'ok' | 'empty' | 'missing_key' | 'provider_error' | 'timeout';
  errorClass?: string;
  providerFailures: number;
  successfulQueries: number;
};

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const trimmed = q.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function buildContextualQueries(ctx: BrandContext): string[] {
  const { brand_name, domain_name, industry_category, product_category, country, is_ambiguous_brand } =
    ctx;
  const industry = (industry_category || '').trim();
  const product = (product_category || '').trim();
  const loc = country ? ` in ${country}` : '';
  const keywords = (ctx.primary_keywords || []).map((k) => k.trim()).filter(Boolean).slice(0, 5);
  const kw = keywords[0] || product || industry || 'brand';
  const kw2 = keywords[1] || industry || product || kw;
  const category = product || kw || industry || 'consumer brands';

  if (is_ambiguous_brand) {
    return uniqueQueries([
      `${domain_name} ${category} competitor brands${loc}`,
      `top ${category} brands${loc}`,
      `${industry || category} brands like ${domain_name}`,
      `best ${category} brands${loc}`,
      `brands similar to ${domain_name} ${category}`,
    ]);
  }

  // Multiple angles: category listicles, product alternatives, geo peers, direct competitors.
  return uniqueQueries([
    `top ${category} brands${loc}`,
    `best ${kw} brands${loc}`,
    `best ${kw2} brands${loc}`,
    `${brand_name} competitors ${category}${loc}`,
    `brands like ${brand_name} ${category}${loc}`,
    `${category} brands similar to ${brand_name}${loc}`,
    `${category} alternatives to ${brand_name}${loc}`,
    industry
      ? `best ${industry} ${category} companies${loc} -site:${domain_name}`
      : `best ${category} companies${loc} -site:${domain_name}`,
    country
      ? `${category} brands targeting ${country} customers`
      : `${category} brands for the same customers as ${brand_name}`,
  ]);
}

/** Bounded fallback queries when the first pass yields weak/empty competitor evidence. */
export function buildFallbackQueries(ctx: BrandContext): string[] {
  const product = (ctx.product_category || ctx.primary_keywords?.[0] || 'brands').trim();
  const loc = ctx.country ? ` in ${ctx.country}` : '';
  const brand = ctx.brand_name;
  return uniqueQueries([
    `${product} competitors${loc}`,
    `popular ${product} brands${loc}`,
    `${brand} vs ${product} brands${loc}`,
    `similar brands to ${brand}${loc}`,
    `"${product}" brand list${loc}`,
  ]);
}

async function runQueryBatch(
  ctx: BrandContext,
  searchApiKey: string,
  queries: string[],
  seen: Set<string>,
  results: CompetitorSearchHit[]
): Promise<{ providerFailures: number; successfulQueries: number; lastErrorClass?: string; lastOutcome?: CompetitorSearchBatch['outcome'] }> {
  const brandDomainNorm = ctx.domain_name?.replace(/^www\./, '').toLowerCase() || '';
  let providerFailures = 0;
  let successfulQueries = 0;
  let lastErrorClass: string | undefined;
  let lastOutcome: CompetitorSearchBatch['outcome'] | undefined;
  const gl = /india/i.test(ctx.country || '') || /\.in$/i.test(brandDomainNorm) ? 'in' : undefined;

  for (const q of queries) {
    if (!q?.trim()) continue;
    const detailed = await serpGoogleSearchDetailed(searchApiKey, {
      q,
      num: 10,
      gl,
      hl: gl ? 'en' : undefined,
    });
    if (detailed.outcome === 'ok' || detailed.outcome === 'empty') {
      successfulQueries++;
      lastOutcome = detailed.outcome;
    } else {
      providerFailures++;
      lastErrorClass = detailed.errorClass;
      lastOutcome = detailed.outcome;
      continue;
    }
    for (const r of detailed.results) {
      if (!r.link) continue;
      try {
        const host = new URL(r.link).hostname.replace(/^www\./, '').toLowerCase();
        if (seen.has(host)) continue;
        if (host === brandDomainNorm || host.endsWith('.' + brandDomainNorm)) continue;
        seen.add(host);
        results.push({
          domain: host,
          title: r.title,
          snippet: r.snippet,
          url: r.link,
          date: r.date,
        });
      } catch {
        // skip invalid URLs
      }
    }
  }
  return { providerFailures, successfulQueries, lastErrorClass, lastOutcome };
}

/**
 * Competitor search with explicit empty-vs-failure outcomes and optional fallback queries.
 * Bounded SerpApi usage: primary ≤5 queries, fallback ≤3 more only when weak.
 */
export async function searchWithContextualQueriesDetailed(
  ctx: BrandContext,
  searchApiKey: string | undefined,
  opts: { includeFallback?: boolean; minResultsForSkipFallback?: number } = {}
): Promise<CompetitorSearchBatch> {
  if (!searchApiKey) {
    return {
      results: [],
      queries: [],
      outcome: 'missing_key',
      errorClass: 'missing_key',
      providerFailures: 0,
      successfulQueries: 0,
    };
  }

  const primary = buildContextualQueries(ctx).slice(0, 5);
  const seen = new Set<string>();
  const results: CompetitorSearchHit[] = [];
  const ran: string[] = [...primary];
  const first = await runQueryBatch(ctx, searchApiKey, primary, seen, results);

  const minKeep = opts.minResultsForSkipFallback ?? 4;
  const wantFallback = opts.includeFallback !== false && results.length < minKeep;
  let second: {
    providerFailures: number;
    successfulQueries: number;
    lastErrorClass?: string;
    lastOutcome?: CompetitorSearchBatch['outcome'];
  } = { providerFailures: 0, successfulQueries: 0 };
  if (wantFallback) {
    const fallback = buildFallbackQueries(ctx).slice(0, 3);
    ran.push(...fallback);
    second = await runQueryBatch(ctx, searchApiKey, fallback, seen, results);
  }

  const providerFailures = first.providerFailures + second.providerFailures;
  const successfulQueries = first.successfulQueries + second.successfulQueries;
  const lastErrorClass = second.lastErrorClass || first.lastErrorClass;
  const lastOutcome = second.lastOutcome || first.lastOutcome;

  if (!results.length) {
    if (successfulQueries === 0 && providerFailures > 0) {
      return {
        results: [],
        queries: ran,
        outcome: lastOutcome === 'timeout' ? 'timeout' : 'provider_error',
        errorClass: lastErrorClass,
        providerFailures,
        successfulQueries,
      };
    }
    return {
      results: [],
      queries: ran,
      outcome: 'empty',
      providerFailures,
      successfulQueries,
    };
  }

  return {
    results: results.slice(0, 28),
    queries: ran,
    outcome: 'ok',
    providerFailures,
    successfulQueries,
  };
}

export async function searchWithContextualQueries(
  ctx: BrandContext,
  searchApiKey: string | undefined
): Promise<CompetitorSearchHit[]> {
  const batch = await searchWithContextualQueriesDetailed(ctx, searchApiKey, { includeFallback: true });
  return batch.results;
}

export const META_GRAPH_VERSION = "v25.0";
export const META_ADS_ARCHIVE_FIELDS = "id,page_id,page_name,ad_creative_bodies,ad_snapshot_url,publisher_platforms,ad_delivery_start_time";

/** Fetch ads via Meta Graph API (ads_archive) - preferred when META_AD_LIBRARY_ACCESS_TOKEN is set */
export async function fetchMetaAdLibraryAdsViaGraphAPI(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    accessToken: string;
    adReachedCountries?: string[];
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], accessToken, adReachedCountries = ["IN", "US"] } = options;
  const allAds: any[] = [];
  const seenIds = new Set<string>();

  const normalizeAd = (ad: any, searchKeyword: string) => {
    const bodyText = Array.isArray(ad.ad_creative_bodies)
      ? (ad.ad_creative_bodies[0] || "").slice(0, 2000)
      : "";
    const id = ad.id || `${ad.page_id}-${bodyText.slice(0, 50)}`;
    if (seenIds.has(id)) return null;
    seenIds.add(id);
    return {
      search_keyword: searchKeyword,
      page_name: ad.page_name || null,
      page_id: ad.page_id || null,
      body_text: bodyText,
      cta_text: null,
      cta_type: null,
      display_format: null,
      platforms: ad.publisher_platforms || [],
      image_url: ad.ad_snapshot_url || null,
      raw_data: ad,
    };
  };

  for (const pageId of pageIds.slice(0, 5)) {
    if (!pageId?.trim()) continue;
    try {
      const params = new URLSearchParams({
        search_page_ids: JSON.stringify([pageId]),
        ad_reached_countries: JSON.stringify(adReachedCountries),
        ad_active_status: "ACTIVE",
        ad_type: "ALL",
        access_token: accessToken,
        fields: META_ADS_ARCHIVE_FIELDS,
      });
      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        console.warn("Meta Ad Library (page_id) API error:", res.status, err);
        continue;
      }
      const data = await res.json();
      for (const ad of (data.data || []).slice(0, 8)) {
        const normalized = normalizeAd(ad, `page:${pageId}`);
        if (normalized) allAds.push(normalized);
      }
    } catch (e) {
      console.warn("Meta Ad Library (page_id) fetch error:", e);
    }
  }

  if (allAds.length < 5 && contextualKeywords.length > 0) {
    for (const kw of contextualKeywords.slice(0, 3)) {
      if (!kw?.trim()) continue;
      try {
        const params = new URLSearchParams({
          search_terms: kw.trim().slice(0, 100),
          ad_reached_countries: JSON.stringify(adReachedCountries),
          ad_active_status: "ACTIVE",
          ad_type: "ALL",
          access_token: accessToken,
          fields: META_ADS_ARCHIVE_FIELDS,
        });
        const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        for (const ad of (data.data || []).slice(0, 8)) {
          const normalized = normalizeAd(ad, kw.trim());
          if (normalized) allAds.push(normalized);
        }
      } catch (e) {
        console.warn("Meta Ad Library (keyword) fetch error:", e);
      }
    }
  }

  return allAds.slice(0, 25);
}

/** Fetch ads via SearchAPI (fallback when Meta token not set or fails) */
export async function fetchMetaAdLibraryAdsViaSearchAPI(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    searchApiKey: string | undefined;
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], searchApiKey } = options;
  if (!searchApiKey) return [];
  const allAds: any[] = [];
  const seenIds = new Set<string>();

  const addAdsFromResponse = (ads: any[], searchKeyword: string) => {
    for (const ad of ads.slice(0, 8)) {
      const id = ad.ad_archive_id || ad.page_id + "-" + (ad.snapshot?.body?.text?.slice(0, 50) || "");
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const snapshot = ad.snapshot || {};
      const bodyText = snapshot.body?.text || "";
      const firstImage = snapshot.images?.[0]?.resized_image_url || snapshot.images?.[0]?.original_image_url
        || snapshot.cards?.[0]?.resized_image_url || snapshot.cards?.[0]?.original_image_url;
      allAds.push({
        search_keyword: searchKeyword,
        page_name: ad.page_name || snapshot.page_name,
        page_id: ad.page_id || snapshot.page_id,
        body_text: bodyText.slice(0, 2000),
        cta_text: snapshot.cta_text,
        cta_type: snapshot.cta_type,
        display_format: snapshot.display_format,
        platforms: ad.publisher_platform || [],
        image_url: firstImage,
        raw_data: ad,
      });
    }
  };

  for (const pageId of pageIds.slice(0, 3)) {
    if (!pageId?.trim()) continue;
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&page_id=${encodeURIComponent(pageId)}&api_key=${searchApiKey}&sort_by=impressions_high_to_low`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      addAdsFromResponse(data.ads || [], `page:${pageId}`);
    } catch (e) {
      console.warn("Meta Ad Library (page_id) fetch error:", e);
    }
  }

  if (allAds.length < 5 && contextualKeywords.length > 0) {
    for (const kw of contextualKeywords.slice(0, 3)) {
      if (!kw?.trim()) continue;
      try {
        const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&q=${encodeURIComponent(kw.trim())}&api_key=${searchApiKey}&sort_by=impressions_high_to_low`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        addAdsFromResponse(data.ads || [], kw.trim());
      } catch (e) {
        console.warn("Meta Ad Library (keyword) fetch error:", e);
      }
    }
  }

  return allAds.slice(0, 25);
}

/** Unified Meta Ad Library fetch: prefers Graph API when token set, falls back to SearchAPI */
export async function fetchMetaAdLibraryAds(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    searchApiKey: string | undefined;
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], searchApiKey } = options;

  const metaAdLibraryToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (metaAdLibraryToken) {
    try {
      const ads = await fetchMetaAdLibraryAdsViaGraphAPI({
        pageIds,
        contextualKeywords,
        accessToken: metaAdLibraryToken,
      });
      if (ads.length > 0) return ads;
    } catch (e) {
      console.warn("Meta Ad Library (Graph API) failed, falling back to SearchAPI:", e);
    }
  }

  return fetchMetaAdLibraryAdsViaSearchAPI({
    pageIds,
    contextualKeywords,
    searchApiKey,
  });
}

export function extractPageIdFromFacebookUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (path[0] === "pages" && path[2]) return path[2];
    if (/^\d+$/.test(path[0])) return path[0];
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Facebook Page id for Meta Ad Library.
 * Prefer a numeric id from a facebook.com URL in Google results; SerpApi does
 * not expose Meta Ad Library page search.
 */
export async function searchFacebookPages(
  query: string,
  searchApiKey: string | undefined
): Promise<string | null> {
  if (!searchApiKey || !query?.trim()) return null;
  try {
    const organic = await serpGoogleSearch(searchApiKey, {
      q: `${query.trim()} site:facebook.com`,
      num: 5,
    });
    for (const r of organic) {
      const fromLink = extractPageIdFromFacebookUrl(r.link);
      if (fromLink) return fromLink;
      // Path slug like facebook.com/Allbirds — Graph page_id search needs numeric;
      // return null and let keyword Meta/ads-transparency paths handle it.
      try {
        const u = new URL(r.link);
        if (!/facebook\.com$/i.test(u.hostname.replace(/^www\./, ''))) continue;
        const slug = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[0];
        if (slug && !['pages', 'profile.php', 'people', 'groups', 'watch', 'share'].includes(slug.toLowerCase())) {
          // Non-numeric slug — not usable as ads_archive search_page_ids.
          continue;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch (e) {
    console.warn("Facebook page search error:", e);
    return null;
  }
}
