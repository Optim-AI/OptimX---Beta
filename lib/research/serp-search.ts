/**
 * SerpApi (serpapi.com) Google Search client used by competitor research and
 * the free marketing audit. SEARCH_API_KEY / SERPAPI_KEY hold the SerpApi key.
 * Server-only — never logs or returns the key.
 */

export function getSerpApiKey(): string | undefined {
  return process.env.SERPAPI_KEY || process.env.SEARCH_API_KEY || undefined;
}

export type OrganicResult = {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  displayed_link?: string;
};

export type SerpGoogleOptions = {
  q: string;
  num?: number;
  /** SerpApi/Google tbs, e.g. qdr:m = past month. */
  tbs?: string;
  gl?: string;
  hl?: string;
  timeoutMs?: number;
};

/**
 * Google organic results via SerpApi.
 * Docs: https://serpapi.com/search-api
 */
export async function serpGoogleSearch(
  apiKey: string | undefined,
  opts: SerpGoogleOptions
): Promise<OrganicResult[]> {
  if (!apiKey || !opts.q?.trim()) return [];
  const params = new URLSearchParams({
    engine: 'google',
    q: opts.q.trim(),
    api_key: apiKey,
    num: String(Math.min(Math.max(opts.num ?? 8, 1), 20)),
  });
  if (opts.tbs) params.set('tbs', opts.tbs);
  if (opts.gl) params.set('gl', opts.gl);
  if (opts.hl) params.set('hl', opts.hl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[serp] google search failed', res.status, errText.slice(0, 200));
      return [];
    }
    const data = (await res.json()) as any;
    if (data?.error) {
      console.warn('[serp] google search error', String(data.error).slice(0, 200));
      return [];
    }
    return (data.organic_results || [])
      .filter((r: any) => r?.link)
      .map((r: any) => ({
        title: String(r.title || ''),
        link: String(r.link),
        snippet: String(r.snippet || ''),
        date: typeof r.date === 'string' ? r.date : undefined,
        displayed_link: typeof r.displayed_link === 'string' ? r.displayed_link : undefined,
      }));
  } catch (e) {
    console.warn('[serp] google search exception', (e as Error)?.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Ads Transparency Center creatives for a domain/brand query.
 * Docs: https://serpapi.com/google-ads-transparency-center-api
 */
export async function serpAdsTransparency(
  apiKey: string | undefined,
  text: string,
  opts: { num?: number; timeoutMs?: number } = {}
): Promise<
  Array<{
    advertiser: string;
    advertiser_id: string;
    ad_creative_id: string;
    format: string | null;
    link: string | null;
    first_shown: number | null;
    last_shown: number | null;
    details_link: string | null;
  }>
> {
  if (!apiKey || !text?.trim()) return [];
  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    text: text.trim().slice(0, 200),
    api_key: apiKey,
    num: String(Math.min(opts.num ?? 8, 40)),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    if (data?.error) {
      console.warn('[serp] ads transparency error', String(data.error).slice(0, 200));
      return [];
    }
    return (data.ad_creatives || []).slice(0, opts.num ?? 8).map((ad: any) => ({
      advertiser: String(ad.advertiser || ''),
      advertiser_id: String(ad.advertiser_id || ''),
      ad_creative_id: String(ad.ad_creative_id || ''),
      format: ad.format ? String(ad.format) : null,
      link: ad.link ? String(ad.link) : null,
      first_shown: typeof ad.first_shown === 'number' ? ad.first_shown : null,
      last_shown: typeof ad.last_shown === 'number' ? ad.last_shown : null,
      details_link: ad.details_link ? String(ad.details_link) : null,
    }));
  } catch (e) {
    console.warn('[serp] ads transparency exception', (e as Error)?.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
