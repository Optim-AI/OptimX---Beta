/**
 * Competitor discovery shared by Creative Intelligence and the free marketing audit.
 * Google search via SerpApi (serpapi.com). Meta Ad Library via Graph API, with a
 * SearchApi.io fallback only when that provider's Meta engines are available.
 * Server-only: reads API keys from env and never returns them.
 */

import { serpGoogleSearch } from './serp-search';

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

export function buildContextualQueries(ctx: BrandContext): string[] {
  const { brand_name, domain_name, industry_category, product_category, country, is_ambiguous_brand } = ctx;
  const industry = industry_category || "this industry";
  const product = product_category || "products";
  const loc = country ? ` in ${country}` : "";

  if (is_ambiguous_brand) {
    return [
      `${domain_name} ${product} competitor brands${loc}`,
      `top ${product} brands${loc}`,
      `${industry} brands like ${domain_name}`,
      `best ${product} under 5000${loc}`,
      `brands similar to ${domain_name} ${product}`,
    ];
  }
  // Prefer queries that surface competitor brand names and official sites.
  return [
    `${brand_name} competitors ${product}${loc}`,
    `top ${product} brands${loc}`,
    `brands like ${brand_name}${loc}`,
    `${brand_name} vs ${product}`,
    `best ${product} brands${loc} -site:${domain_name}`,
  ];
}

export async function searchWithContextualQueries(
  ctx: BrandContext,
  searchApiKey: string | undefined
): Promise<any[]> {
  if (!searchApiKey) return [];
  // Cap queries to conserve free-tier SerpApi credits (100/month typical).
  const queries = buildContextualQueries(ctx).slice(0, 3);
  const seen = new Set<string>();
  const results: any[] = [];
  const brandDomainNorm = ctx.domain_name?.replace("www.", "").toLowerCase() || "";
  for (const q of queries) {
    if (!q?.trim()) continue;
    try {
      const organic = await serpGoogleSearch(searchApiKey, { q, num: 8 });
      for (const r of organic) {
        if (!r.link) continue;
        try {
          const host = new URL(r.link).hostname.replace("www.", "").toLowerCase();
          if (seen.has(host)) continue;
          if (host === brandDomainNorm || host.endsWith("." + brandDomainNorm)) continue;
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
    } catch (e) {
      console.warn("Search API error:", e);
    }
  }
  return results.slice(0, 15);
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
