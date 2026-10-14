/**
 * Free marketing audit pipeline. Each stage writes its output into the work
 * state; persisted stages are skipped on retry so interrupted runs resume.
 * Research only — never triggers paid creative generation.
 */

import { JSDOM } from 'jsdom';
import {
  AMBIGUOUS_BRAND_WORDS,
  fetchMetaAdLibraryAds,
  extractPageIdFromFacebookUrl,
  searchFacebookPages,
  searchWithContextualQueries,
  type BrandContext,
} from '@/lib/research/competitor-research';
import { getSerpApiKey, serpAdsTransparency, serpGoogleSearch } from '@/lib/research/serp-search';
import { geminiJson, untrusted, type AuditJsonModel } from './ai';
import {
  collectObservedNumbers,
  parseEngagementFromSnippet,
  parsePublishedDate,
  sanitizeAnalysis,
} from './evidence';
import { safeFetchText } from './url-safety';
import {
  extractBrandNamesFromText,
  namesOverlap,
  rankClassified,
  scoreCompetitorCandidate,
  type ClassifiedCompetitor,
} from './competitor-quality';
import {
  AUDIT_STAGES,
  type AuditBrand,
  type AuditCompetitor,
  type AuditInsights,
  type AuditLimitation,
  type AuditStage,
  type AuditStageName,
  type CompetitorPost,
  type ContentIdea,
  type SiteSnapshot,
  type SourceRef,
} from './types';

export type SearchResult = { domain: string; title: string; snippet: string; url: string; date?: string };

export type TransparencyAd = {
  advertiser: string;
  text: string;
  url: string;
  publishedAt: string | null;
  format: string | null;
};

export type AuditDeps = {
  fetchHtml: (url: string) => Promise<{ url: string; body: string; truncated?: boolean }>;
  ai: AuditJsonModel;
  searchCompetitors: (ctx: BrandContext) => Promise<SearchResult[]>;
  /** Resolve a brand name to its official website from Google results. */
  resolveBrandDomain: (brandName: string) => Promise<SearchResult | null>;
  findFacebookPageId: (name: string) => Promise<string | null>;
  fetchAds: (pageId: string) => Promise<any[]>;
  /** Google Ads Transparency Center — SerpApi, no Meta page id needed. */
  fetchTransparencyAds: (comp: { name: string; domain: string }) => Promise<TransparencyAd[]>;
  searchSocialPosts: (competitorName: string) => Promise<SearchResult[]>;
  now: () => Date;
  hasSearchProvider: boolean;
};

export type AuditWorkState = {
  websiteUrl: string;
  normalizedHost: string;
  stage: AuditStage;
  site: SiteSnapshot | null;
  brand: AuditBrand | null;
  competitors: AuditCompetitor[];
  competitorPosts: CompetitorPost[];
  insights: AuditInsights | null;
  ideas: ContentIdea[];
  sources: SourceRef[];
  limitations: AuditLimitation[];
};

export class AuditStageError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuditStageError';
  }
}

const MARKETPLACE_OR_MEDIA = /(^|\.)(amazon|flipkart|myntra|meesho|ebay|etsy|walmart|aliexpress|alibaba|indiamart|justdial|wikipedia|youtube|reddit|quora|medium|linkedin|facebook|instagram|pinterest|twitter|x|tiktok|threads|glassdoor|indeed|crunchbase|g2|capterra|trustpilot|yelp|tripadvisor|forbes|nytimes|bloomberg|economictimes|livemint|ndtv|hindustantimes|businessinsider|techcrunch|google|apple|play|similarsitesearch|similarsites|similarweb|alternativeto|producthunt|shopify|wordpress|blogspot|substack|depop|poshmark|shopee|lazada|tokopedia|sierra|shop\.app)\.[a-z.]+$/i;
const LISTICLE_TITLE = /\b(alternatives?|similar to|shoes? like|brands? like|best \d+|top \d+|\d+ (best|picks|brands)|vs\.?|compared|roundup|you should (try|know)|add to your pantry|brands to (try|know|buy))\b/i;
const EDITORIAL_PATH = /\/(blogs?|news|articles?|stories|list|roundup|guides?|resources?)(\/|$)/i;

function sourceId(prefix: string, n: number) {
  return `${prefix}${n}`;
}

function addSource(state: AuditWorkState, src: SourceRef) {
  if (!state.sources.some((s) => s.id === src.id)) state.sources.push(src);
}

function addLimitation(state: AuditWorkState, code: string, message: string) {
  if (!state.limitations.some((l) => l.code === code)) state.limitations.push({ code, message });
}

function stageDone(state: AuditWorkState, stage: AuditStageName): boolean {
  if (state.stage === 'queued') return false;
  return AUDIT_STAGES.indexOf(state.stage) >= AUDIT_STAGES.indexOf(stage);
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function strList(v: unknown, max: number, itemMax = 80): string[] {
  return Array.isArray(v) ? v.map((x) => text(x, itemMax)).filter(Boolean).slice(0, max) : [];
}

// ---------- stage: site ----------

export function parseSiteHtml(html: string, finalUrl: string, requestedUrl: string, retrievedAt: string): SiteSnapshot {
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || '';
  doc.querySelectorAll('script,style,noscript,svg,iframe,template').forEach((n) => n.remove());
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3'))
    .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((h) => h.length > 2 && h.length < 160);
  const links = Array.from(doc.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href);
  const pick = (re: RegExp) => links.find((l) => re.test(l)) || null;
  const site: SiteSnapshot = {
    requestedUrl,
    finalUrl,
    title: text(doc.title || meta('meta[property="og:title"]'), 200),
    description: text(meta('meta[name="description"]') || meta('meta[property="og:description"]'), 500),
    headings: Array.from(new Set(headings)).slice(0, 20),
    excerpt: text(doc.body?.textContent || '', 6000),
    socialLinks: {
      facebook: pick(/^https?:\/\/(www\.|m\.)?facebook\.com\/(?!sharer|share|dialog|plugins)[^?#]+/i),
      instagram: pick(/^https?:\/\/(www\.)?instagram\.com\/(?!p\/|reel\/|share)[^?#/]+/i),
    },
    retrievedAt,
    sourceId: 'w1',
  };
  dom.window.close();
  return site;
}

async function runSite(state: AuditWorkState, deps: AuditDeps) {
  let fetched: { url: string; body: string; truncated?: boolean };
  try {
    fetched = await deps.fetchHtml(state.websiteUrl);
  } catch (e) {
    const code = (e as { code?: string })?.code || 'network';
    throw new AuditStageError(
      `site_${code}`,
      code === 'content_type'
        ? "That address didn't return a web page we can read."
        : code === 'timeout'
          ? 'The website took too long to respond.'
          : "We couldn't reach that website. Check the address and try again."
    );
  }
  const retrievedAt = deps.now().toISOString();
  const site = parseSiteHtml(fetched.body, fetched.url, state.websiteUrl, retrievedAt);
  if (!site.title && !site.description && site.excerpt.length < 80) {
    throw new AuditStageError('site_empty', "We couldn't find readable content on that page.");
  }
  state.site = site;
  addSource(state, {
    id: site.sourceId,
    kind: 'website',
    url: site.finalUrl,
    title: site.title || state.normalizedHost,
    provider: 'website',
    publishedAt: null,
    retrievedAt,
  });
  if (fetched.truncated) {
    state.limitations.push({
      code: 'site_truncated',
      message:
        'The homepage HTML was very large, so we analyzed the beginning of the page only.',
    });
  }
}

// ---------- stage: brand ----------

function metadataBrandName(site: SiteSnapshot, host: string): string {
  const fromTitle = site.title.split(/\s[|\-–—:·]\s/)[0]?.trim();
  if (fromTitle && fromTitle.length <= 40) return fromTitle;
  const label = host.split('.')[0] || host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function siteFacts(site: SiteSnapshot): AuditBrand['facts'] {
  const facts: AuditBrand['facts'] = [];
  if (site.title) facts.push({ label: 'Page title', value: site.title, sourceId: site.sourceId });
  if (site.description) facts.push({ label: 'Meta description', value: site.description, sourceId: site.sourceId });
  if (site.headings[0]) facts.push({ label: 'Main headline', value: site.headings[0], sourceId: site.sourceId });
  return facts;
}

async function runBrand(state: AuditWorkState, deps: AuditDeps) {
  const site = state.site!;
  const facts = siteFacts(site);
  let raw: any = null;
  try {
    raw = await deps.ai(
      [
        'You are auditing a business from its own homepage. Identify what it sells and to whom, using only the page content.',
        'Return JSON: {"name":string,"products":string[],"niche":string,"industry":string,"product_category":string,"positioning":string,"audience":string,"tone":string,"country":string,"search_keywords":string[],"supporting_quotes":string[],"confidence":"high"|"medium"|"low"}.',
        'Rules: "country" only if the page states or clearly implies it, else "". "supporting_quotes" must be exact short phrases copied from the page. If the page is too thin to tell, set confidence "low" and leave unknown fields "".',
        untrusted('homepage', {
          url: site.finalUrl,
          title: site.title,
          description: site.description,
          headings: site.headings,
          text: site.excerpt.slice(0, 4500),
        }),
      ].join('\n\n')
    );
  } catch (e) {
    console.warn('[audit] brand AI failed', (e as Error)?.message);
  }

  const pageText = `${site.title} ${site.description} ${site.headings.join(' ')} ${site.excerpt}`.toLowerCase();
  const quotes = strList(raw?.supporting_quotes, 4, 200).filter((q) => pageText.includes(q.toLowerCase()));
  for (const q of quotes) facts.push({ label: 'Quoted from site', value: q, sourceId: site.sourceId });

  const name = text(raw?.name, 60) || metadataBrandName(site, state.normalizedHost);
  const confidence = raw?.confidence === 'high' || raw?.confidence === 'medium' ? raw.confidence : 'low';
  state.brand = {
    name,
    facts,
    interpretation: {
      products: strList(raw?.products, 6),
      niche: text(raw?.niche, 160),
      industry: text(raw?.industry, 80),
      productCategory: text(raw?.product_category, 80),
      positioning: text(raw?.positioning, 300),
      audience: text(raw?.audience, 240),
      tone: text(raw?.tone, 80),
      country: text(raw?.country, 60),
      searchKeywords: strList(raw?.search_keywords, 6),
    },
    confidence: raw ? confidence : 'low',
    basis: raw ? 'ai' : 'metadata_only',
  };
  if (!raw) {
    addLimitation(
      state,
      'brand_ai_unavailable',
      "AI brand analysis wasn't available, so the brand profile is based only on your page title and description."
    );
  }
}

// ---------- stage: competitors ----------

function competitorNameFromTitle(title: string, domain: string): string {
  const first = title.split(/\s[|\-–—:·]\s/)[0]?.trim();
  if (first && first.length <= 40 && !/\b(best|top|\d+)\b/i.test(first)) return first;
  const label = domain.split('.')[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x.includes(y) || y.includes(x)));
}

/** Prefer official domains whose label loosely matches the brand name. */
function domainLooksLikeBrand(domain: string, name: string): boolean {
  const label = domain.split('.')[0]?.toLowerCase().replace(/[-_]/g, '') || '';
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!label || !n || n.length < 3) return false;
  const stem = n.slice(0, Math.min(5, n.length));
  return label.includes(stem) || n.includes(label.slice(0, Math.min(5, label.length)));
}

/** Brand shop homepage vs listicle/blog article hosted on a brand (or media) site. */
function isLikelyBrandHomepage(url: string, title = '', snippet = ''): boolean {
  if (LISTICLE_TITLE.test(`${title} ${snippet}`)) return false;
  try {
    const u = new URL(url);
    if (EDITORIAL_PATH.test(u.pathname)) return false;
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    // Deep article paths are rarely the brand homepage.
    if (parts.length >= 3) return false;
  } catch {
    return false;
  }
  return true;
}

async function runCompetitors(state: AuditWorkState, deps: AuditDeps) {
  const brand = state.brand!;
  if (!deps.hasSearchProvider) {
    addLimitation(state, 'competitor_search_unavailable', 'Competitor search is not configured, so this audit covers your website only.');
    return;
  }
  const ctx: BrandContext = {
    brand_name: brand.name,
    domain_name: state.normalizedHost,
    industry_category: brand.interpretation.industry,
    product_category: brand.interpretation.productCategory || brand.interpretation.niche,
    primary_keywords: [
      ...brand.interpretation.searchKeywords,
      ...brand.interpretation.products.slice(0, 3),
    ].filter(Boolean),
    country: brand.interpretation.country,
    is_ambiguous_brand: AMBIGUOUS_BRAND_WORDS.has(brand.name.toLowerCase()),
  };
  let results: SearchResult[] = [];
  try {
    results = await deps.searchCompetitors(ctx);
  } catch (e) {
    console.warn('[audit] competitor search failed', (e as Error)?.message);
  }
  if (!results.length) {
    addLimitation(
      state,
      'no_competitors_found',
      'Competitor search returned no results (the search provider may be temporarily unavailable), so this audit is based on your website only.'
    );
    return;
  }

  const eligible = results.filter(
    (r) => r?.url && r.domain && !MARKETPLACE_OR_MEDIA.test(r.domain) && r.domain !== state.normalizedHost
  );
  const listicles = eligible.filter((r) => !isLikelyBrandHomepage(r.url, r.title, r.snippet));
  const homepageHits = eligible.filter((r) => isLikelyBrandHomepage(r.url, r.title, r.snippet));

  // Stage C precursor: score homepage hits; keep only those with category/geo fit.
  const scoredHomepages = homepageHits
    .map((r) => ({ r, scored: scoreCompetitorCandidate(r, brand, state.normalizedHost) }))
    .filter((x) => !x.scored.rejected)
    .sort((a, b) => b.scored.score - a.scored.score);
  const candidates = scoredHomepages.map((x) => x.r);

  const heuristicNames = extractBrandNamesFromText(
    listicles.flatMap((l) => [l.title, l.snippet]),
    [brand.name, state.normalizedHost],
    10
  );

  let aiPicks: Array<{
    index?: number;
    name: string;
    classification: 'direct' | 'adjacent';
    overlap_reason: string;
    confidence: 'high' | 'medium' | 'low';
  }> = [];
  let namedBrands: string[] = [...heuristicNames];
  let usedAi = false;

  try {
    const raw: any = await deps.ai(
      [
        `Audited business: ${brand.name} (${state.normalizedHost}).`,
        `Niche: ${brand.interpretation.niche || 'unknown'}. Category: ${brand.interpretation.productCategory || brand.interpretation.industry || 'unknown'}.`,
        `Products: ${brand.interpretation.products.join(', ') || 'unknown'}. Audience: ${brand.interpretation.audience || 'unknown'}. Country: ${brand.interpretation.country || 'unknown'}.`,
        'Task: identify REAL competitor brands using ONLY the evidence below. Do not invent brands.',
        'Return JSON: {"competitors":[{"index":number|null,"name":string,"classification":"direct"|"adjacent","overlap_reason":string,"confidence":"high"|"medium"|"low"}],"named_brands":[string]}.',
        'Rules:',
        '- A brand is a competitor only if evidence shows it sells similar products to a similar audience (not merely sharing words like organic/natural/skincare).',
        '- "direct" = same core category + overlapping audience/geo. "adjacent" = related category or broader beauty/personal care peer.',
        '- "competitors": prefer indices from scored_homepages. Set index null when recommending a name from listicles that is not yet a homepage hit.',
        '- "overlap_reason": one short sentence grounded in the evidence (products/audience). Never claim features you cannot see.',
        '- "named_brands": 4–8 brand names copied from listicle text (or empty). Exclude ' + brand.name + '.',
        '- Prefer 3–5 total strong competitors. Omit weak matches rather than padding.',
        '- Never pick blogs, news, directories, marketplaces, or the audited brand itself.',
        untrusted(
          'scored_homepages',
          scoredHomepages.slice(0, 12).map((x, i) => ({
            index: i,
            domain: x.r.domain,
            title: x.r.title,
            snippet: x.r.snippet,
            score: x.scored.score,
            score_reasons: x.scored.reasons,
          }))
        ),
        untrusted(
          'listicle_or_blog_results',
          listicles.slice(0, 12).map((c, i) => ({ index: i, domain: c.domain, title: c.title, snippet: c.snippet }))
        ),
        untrusted('heuristic_named_brands', heuristicNames),
      ].join('\n\n')
    );
    usedAi = Boolean(raw);
    if (raw && Array.isArray(raw.competitors)) {
      aiPicks = raw.competitors
        .map((c: any) => ({
          index: Number.isInteger(c?.index) ? c.index : undefined,
          name: text(c?.name, 60),
          classification: c?.classification === 'adjacent' ? ('adjacent' as const) : ('direct' as const),
          overlap_reason: text(c?.overlap_reason, 220),
          confidence:
            c?.confidence === 'high' || c?.confidence === 'medium' || c?.confidence === 'low'
              ? c.confidence
              : ('medium' as const),
        }))
        .filter((c: { name: string }) => c.name.length > 2 && !namesMatch(c.name, brand.name));
    }
    if (raw && Array.isArray(raw.named_brands)) {
      for (const n of raw.named_brands.map((x: unknown) => text(x, 60))) {
        if (n && n.length > 2 && !namesMatch(n, brand.name) && !namedBrands.some((b) => namesMatch(b, n))) {
          namedBrands.push(n);
        }
      }
    }
  } catch (e) {
    console.warn('[audit] competitor AI failed', (e as Error)?.message);
  }

  const classified: Array<ClassifiedCompetitor & { score?: number; title?: string }> = [];
  const seenDomains = new Set<string>([state.normalizedHost]);
  const seenNames = new Set<string>();

  const remember = (item: ClassifiedCompetitor & { score?: number; title?: string }) => {
    const d = item.domain?.toLowerCase();
    if (!d || seenDomains.has(d) || MARKETPLACE_OR_MEDIA.test(d)) return;
    if ([...seenNames].some((n) => namesOverlap(n, item.name))) return;
    seenDomains.add(d);
    seenNames.add(item.name.toLowerCase());
    classified.push(item);
  };

  // Apply AI picks that reference scored homepages (re-validate score).
  for (const pick of aiPicks) {
    if (typeof pick.index === 'number' && pick.index >= 0 && pick.index < candidates.length) {
      const c = candidates[pick.index];
      const scored = scoreCompetitorCandidate(c, brand, state.normalizedHost);
      if (scored.rejected) continue;
      remember({
        name: pick.name || competitorNameFromTitle(c.title || '', c.domain),
        domain: c.domain,
        url: c.url,
        snippet: text(c.snippet, 300),
        classification: pick.classification,
        overlapReason: pick.overlap_reason || scored.reasons.join(', ') || 'Category overlap in search evidence',
        confidence: pick.confidence === 'low' && scored.score >= 5 ? 'medium' : pick.confidence,
        selectedBy: usedAi ? 'ai_from_search_results' : 'search_heuristic',
        score: scored.score,
        title: c.title,
      });
    }
  }

  // Resolve named brands → official domains (bounded).
  const resolveBudget = Math.max(0, 6 - classified.length);
  for (const name of namedBrands.slice(0, resolveBudget + 2)) {
    if (classified.length >= 5) break;
    if ([...seenNames].some((n) => namesOverlap(n, name))) continue;
    try {
      const resolved = await deps.resolveBrandDomain(name);
      if (!resolved?.domain || seenDomains.has(resolved.domain) || MARKETPLACE_OR_MEDIA.test(resolved.domain)) {
        continue;
      }
      if (!isLikelyBrandHomepage(resolved.url, resolved.title, resolved.snippet)) continue;
      if (!domainLooksLikeBrand(resolved.domain, name)) continue;
      const scored = scoreCompetitorCandidate(resolved, brand, state.normalizedHost);
      if (scored.rejected) continue;
      const aiMeta = aiPicks.find((p) => namesMatch(p.name, name));
      remember({
        name,
        domain: resolved.domain,
        url: resolved.url,
        snippet: text(resolved.snippet, 300),
        classification: aiMeta?.classification || (scored.score >= 5 ? 'direct' : 'adjacent'),
        overlapReason:
          aiMeta?.overlap_reason ||
          (scored.reasons.includes('geo_match')
            ? 'Appears in category search with geographic overlap'
            : 'Appears in category/competitor search evidence'),
        confidence: aiMeta?.confidence || (scored.score >= 6 ? 'high' : scored.score >= 3 ? 'medium' : 'low'),
        selectedBy: usedAi ? 'ai_from_search_results' : 'search_heuristic',
        score: scored.score,
        title: resolved.title,
      });
    } catch (e) {
      console.warn('[audit] resolve brand failed', name, (e as Error)?.message);
    }
  }

  // Heuristic fill only from high-scoring homepages if AI returned nothing usable.
  if (!classified.length) {
    for (const { r, scored } of scoredHomepages.slice(0, 4)) {
      if (scored.score < 4) continue;
      remember({
        name: competitorNameFromTitle(r.title || '', r.domain),
        domain: r.domain,
        url: r.url,
        snippet: text(r.snippet, 300),
        classification: scored.score >= 6 ? 'direct' : 'adjacent',
        overlapReason: 'Matched category signals in public search results',
        confidence: scored.score >= 6 ? 'medium' : 'low',
        selectedBy: 'search_heuristic',
        score: scored.score,
        title: r.title,
      });
    }
  }

  const ranked = rankClassified(classified).slice(0, 5);
  const retrievedAt = deps.now().toISOString();
  for (const comp of ranked) {
    if (!comp.domain || !comp.url) continue;
    const id = sourceId('c', state.competitors.length + 1);
    state.competitors.push({
      id,
      name: comp.name,
      domain: comp.domain,
      url: comp.url,
      snippet: text(comp.snippet, 300),
      sourceId: id,
      selectedBy: comp.selectedBy,
      classification: comp.classification,
      overlapReason: comp.overlapReason,
      confidence: comp.confidence,
    });
    addSource(state, {
      id,
      kind: 'search_result',
      url: comp.url,
      title: text(comp.title, 200) || comp.domain,
      provider: 'serpapi',
      publishedAt: null,
      retrievedAt,
    });
  }

  if (!state.competitors.length) {
    addLimitation(state, 'no_competitors_found', "Search results didn't include brands that clearly compete with you.");
  } else if (state.competitors.length === 1) {
    addLimitation(
      state,
      'limited_competitors',
      'Only one competitor brand could be verified from public search. Activity below may look repetitive until more brands are confirmed.'
    );
  } else if (state.competitors.every((c) => c.confidence === 'low')) {
    addLimitation(
      state,
      'low_confidence_competitors',
      'Competitor matches have limited evidence overlap; treat rankings as provisional.'
    );
  }
}

// ---------- stage: posts ----------

const SOCIAL_POST_URL = /^https:\/\/(www\.)?(instagram\.com\/(p|reel)\/|facebook\.com\/[^/]+\/(posts|videos)\/)/i;
/** Organic posts: ~4 months. Ads: keep up to ~18 months (still drop multi-year repeats). */
const ORGANIC_RECENT_DAYS = 120;
const AD_RECENT_DAYS = 540;
const MAX_ADS_PER_COMPETITOR = 1;
const MAX_ORGANIC_PER_COMPETITOR = 1;
const MAX_ACTIVITY_ITEMS = 8;

async function runPosts(state: AuditWorkState, deps: AuditDeps) {
  if (!state.competitors.length || !deps.hasSearchProvider) {
    if (state.competitors.length === 0 && deps.hasSearchProvider) {
      addLimitation(state, 'no_competitor_posts', 'Without identified competitors, we could not collect competitor posts.');
    }
    return;
  }
  const now = deps.now();
  const retrievedAt = now.toISOString();
  const organicCutoff = now.getTime() - ORGANIC_RECENT_DAYS * 86_400_000;
  const adCutoff = now.getTime() - AD_RECENT_DAYS * 86_400_000;
  const targets = state.competitors.slice(0, 4);
  const perCompetitor: CompetitorPost[][] = await Promise.all(
    targets.map(async (comp) => {
      const posts: CompetitorPost[] = [];
      try {
        const pageId = await deps.findFacebookPageId(comp.name);
        if (pageId) {
          const ads = await deps.fetchAds(pageId);
          for (const ad of ads.slice(0, 4)) {
            if (posts.filter((p) => p.kind === 'ad').length >= MAX_ADS_PER_COMPETITOR) break;
            const raw = ad?.raw_data || {};
            const adId = String(raw.id || raw.ad_archive_id || '').replace(/\D/g, '');
            if (!adId || !ad.page_name || !namesMatch(ad.page_name, comp.name)) continue;
            const date = parsePublishedDate(raw.ad_delivery_start_time ?? raw.start_date ?? null, now);
            if (date && new Date(date.iso).getTime() < adCutoff) continue;
            posts.push({
              id: '',
              competitorId: comp.id,
              competitorName: comp.name,
              platform: 'meta_ads',
              kind: 'ad',
              url: `https://www.facebook.com/ads/library/?id=${adId}`,
              text: text(ad.body_text, 600),
            publishedAt: date?.iso ?? null,
            publishedLabel: date?.label ?? 'Date unavailable',
            engagement: null,
            engagementSource: null,
            sourceId: '',
          });
          }
        }
        if (!posts.some((p) => p.kind === 'ad')) {
          const googleAds = await deps.fetchTransparencyAds({ name: comp.name, domain: comp.domain });
          // Prefer newest ads; keep one per competitor so one brand cannot fill the feed.
          const ranked = [...googleAds].sort((a, b) => {
            const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return tb - ta;
          });
          for (const ad of ranked) {
            if (posts.filter((p) => p.kind === 'ad').length >= MAX_ADS_PER_COMPETITOR) break;
            const tiedToDomain =
              !comp.domain ||
              ad.url.toLowerCase().includes(comp.domain.toLowerCase()) ||
              namesMatch(ad.advertiser, comp.name) ||
              namesMatch(ad.advertiser, comp.domain);
            if (!tiedToDomain) continue;
            if (ad.publishedAt && new Date(ad.publishedAt).getTime() < adCutoff) continue;
            posts.push({
              id: '',
              competitorId: comp.id,
              competitorName: comp.name,
              platform: 'google_ads',
              kind: 'ad',
              url: ad.url,
              text: text(ad.text || `${ad.format || 'Ad'} for ${comp.name}${ad.advertiser ? ` (${ad.advertiser})` : ''}`, 600),
              publishedAt: ad.publishedAt,
              publishedLabel: ad.publishedAt ? ad.publishedAt.slice(0, 10) : 'Date unavailable',
              engagement: null,
              engagementSource: null,
              sourceId: '',
            });
          }
        }
      } catch (e) {
        console.warn('[audit] ad library failed', comp.name, (e as Error)?.message);
      }
      try {
        const results = await deps.searchSocialPosts(comp.name);
        for (const r of results.slice(0, 6)) {
          if (posts.filter((p) => p.kind === 'organic_post').length >= MAX_ORGANIC_PER_COMPETITOR) break;
          if (!r?.url || !SOCIAL_POST_URL.test(r.url)) continue;
          if (!namesMatch(`${r.title} ${r.snippet}`, comp.name) && !namesMatch(r.url, comp.name)) continue;
          const date = parsePublishedDate(r.date ?? null, now) ?? parsePublishedDate(r.snippet, now);
          if (date && new Date(date.iso).getTime() < organicCutoff) continue;
          const engagement = parseEngagementFromSnippet(`${r.title} ${r.snippet}`);
          posts.push({
            id: '',
            competitorId: comp.id,
            competitorName: comp.name,
            platform: /instagram\.com/i.test(r.url) ? 'instagram' : 'facebook',
            kind: 'organic_post',
            url: r.url,
            text: text(r.snippet || r.title, 600),
            publishedAt: date?.iso ?? null,
            publishedLabel: date?.label ?? 'Date unavailable',
            engagement,
            engagementSource: engagement ? 'search_snippet' : null,
            sourceId: '',
          });
        }
      } catch (e) {
        console.warn('[audit] social search failed', comp.name, (e as Error)?.message);
      }
      return posts;
    })
  );

  // Round-robin across competitors so one brand cannot dominate the activity list.
  const buckets = perCompetitor.map((list) => [...list]);
  const interleaved: CompetitorPost[] = [];
  let added = true;
  while (added && interleaved.length < MAX_ACTIVITY_ITEMS) {
    added = false;
    for (const bucket of buckets) {
      if (!bucket.length || interleaved.length >= MAX_ACTIVITY_ITEMS) continue;
      interleaved.push(bucket.shift()!);
      added = true;
    }
  }
  interleaved.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  let adCount = 0;
  let organicCount = 0;
  for (const p of interleaved) {
    const n = state.competitorPosts.length + 1;
    p.id = sourceId('p', n);
    p.sourceId = p.id;
    state.competitorPosts.push(p);
    if (p.kind === 'ad') adCount++;
    else organicCount++;
    const label =
      p.kind === 'ad'
        ? p.platform === 'google_ads' || /adstransparency\.google\.com/i.test(p.url)
          ? 'Google ad'
          : 'Meta ad'
        : p.platform === 'instagram'
          ? 'Instagram post'
          : 'Facebook post';
    addSource(state, {
      id: p.id,
      kind: p.kind === 'ad' ? 'ad_library' : 'social_post',
      url: p.url,
      title: `${p.competitorName} — ${label}`,
      provider:
        p.kind === 'ad'
          ? p.platform === 'google_ads' || /adstransparency\.google\.com/i.test(p.url)
            ? 'google_ads'
            : 'meta_ad_library'
          : 'serpapi',
      publishedAt: p.publishedAt,
      retrievedAt,
    });
  }

  if (!adCount && !organicCount) {
    addLimitation(
      state,
      'no_competitor_posts',
      "We couldn't find recent public posts or ads from these competitors. Insights below are based on your website and competitors' own positioning."
    );
  } else if (!organicCount) {
    addLimitation(
      state,
      'no_organic_posts',
      'No recent organic social posts were publicly indexed; competitor activity is based on publicly listed ads.'
    );
  }
  if (organicCount && !state.competitorPosts.some((p) => p.engagement)) {
    addLimitation(
      state,
      'no_engagement_data',
      'Engagement is not publicly available for these posts, so likes/comments are not shown.'
    );
  }
  if (state.competitorPosts.some((p) => !p.publishedAt)) {
    addLimitation(
      state,
      'dates_partially_unavailable',
      'Some activity items have no verifiable public date; those are labeled “Date unavailable”.'
    );
  }
  addLimitation(
    state,
    'organic_coverage',
    'Organic posts come from public search indexing, not direct platform login, so coverage is a sample rather than a complete feed.'
  );
}

// ---------- stage: analysis ----------

async function runAnalysis(state: AuditWorkState, deps: AuditDeps) {
  const brand = state.brand;
  const evidence = {
    website: state.site
      ? { id: state.site.sourceId, title: state.site.title, description: state.site.description, headings: state.site.headings.slice(0, 8) }
      : null,
    competitors: state.competitors.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      snippet: c.snippet,
      classification: c.classification || null,
      overlap_reason: c.overlapReason || null,
    })),
    posts: state.competitorPosts.map((p) => ({
      id: p.id,
      competitor: p.competitorName,
      type: p.kind,
      platform: p.platform,
      published: p.publishedLabel,
      text: p.text.slice(0, 400),
      visible_engagement: p.engagement,
    })),
  };
  const evidenceIds = new Set(state.sources.map((s) => s.id));
  const observedNumbers = collectObservedNumbers([
    state.site?.title,
    state.site?.description,
    state.site?.excerpt,
    ...state.competitors.map((c) => c.snippet),
    ...state.competitorPosts.map((p) => `${p.text} ${JSON.stringify(p.engagement ?? {})}`),
  ]);

  let raw: any = null;
  try {
    raw = await deps.ai(
      [
        `You are a senior marketing strategist writing a free audit for ${brand?.name || state.normalizedHost}.`,
        `Brand interpretation (AI, from their site): ${JSON.stringify(brand?.interpretation ?? {})}`,
        'Return JSON: {"summary":string,"themes":[{"title":string,"observation":string,"evidence_ids":string[]}],"opportunities":[{"title":string,"explanation":string,"evidence_ids":string[]}],"ideas":[{"title":string,"hook":string,"brief":string,"format":"Static post"|"Carousel"|"Reel / short video"|"Story","audience":string,"rationale":string,"cta":string,"evidence_ids":string[]}]}',
        [
          'Rules:',
          '- themes: 2-4 recurring patterns grounded in competitor snippets/posts. Each MUST cite evidence_ids that exist in evidence.',
          '- opportunities: 2-3 specific gaps vs the observed competitor set. Do NOT claim a competitor lacks a feature unless evidence supports it.',
          '- Avoid generic advice like "emphasize natural ingredients" unless evidence shows a concrete gap.',
          '- ideas: EXACTLY 3, specific to this business and its products, each a ready-to-produce creative brief.',
          '- Never invent competitors, posts, dates, numbers, engagement, or performance results. Do not promise outcomes.',
          '- Only cite ids that appear in the evidence. Only mention numbers that appear in the evidence.',
          '- If competitor evidence is empty or low-confidence, say so and base recommendations on the website.',
        ].join('\n'),
        untrusted('evidence', evidence),
      ].join('\n\n'),
      { timeoutMs: 60_000 }
    );
  } catch (e) {
    console.warn('[audit] analysis AI failed', (e as Error)?.message);
  }

  const { insights, ideas, usedFallbackIdeas } = sanitizeAnalysis(
    raw,
    { evidenceIds, observedNumbers },
    brand,
    state.competitorPosts
  );
  if (!insights.summary) {
    insights.summary = state.competitors.length
      ? `We reviewed ${brand?.name || 'your'} website and ${state.competitors.length} competitor${state.competitors.length === 1 ? '' : 's'} found in public search.`
      : `We reviewed ${brand?.name || 'your'} website. Competitor data was limited, so these recommendations focus on your own positioning.`;
  }
  state.insights = insights;
  state.ideas = ideas;
  if (!raw) {
    addLimitation(state, 'analysis_ai_unavailable', 'AI analysis was unavailable, so ideas are templates built from your website copy.');
  } else if (usedFallbackIdeas) {
    addLimitation(state, 'ideas_partially_templated', 'Some ideas were completed from templates based on your website copy.');
  }
}

// ---------- orchestration ----------

const STAGE_RUNNERS: Record<AuditStageName, (s: AuditWorkState, d: AuditDeps) => Promise<void>> = {
  site: runSite,
  brand: runBrand,
  competitors: runCompetitors,
  posts: runPosts,
  analysis: runAnalysis,
};

/** Limitation codes that downgrade the audit to "partial". */
const PARTIAL_CODES = new Set([
  'brand_ai_unavailable',
  'competitor_search_unavailable',
  'no_competitors_found',
  'no_competitor_posts',
  'analysis_ai_unavailable',
  'site_truncated',
]);

export function finalStatus(state: AuditWorkState): 'completed' | 'partial' {
  return state.limitations.some((l) => PARTIAL_CODES.has(l.code)) ? 'partial' : 'completed';
}

/**
 * Run remaining stages. `onStage` persists after each stage so a crash resumes
 * from the last completed stage. Throws AuditStageError on unrecoverable failure.
 */
export async function runAuditStages(
  state: AuditWorkState,
  deps: AuditDeps,
  onStage: (stage: AuditStageName, state: AuditWorkState) => Promise<void>
): Promise<AuditWorkState> {
  for (const stage of AUDIT_STAGES) {
    if (stageDone(state, stage)) continue;
    await STAGE_RUNNERS[stage](state, deps);
    state.stage = stage;
    await onStage(stage, state);
  }
  return state;
}

export function defaultAuditDeps(): AuditDeps {
  const searchApiKey = getSerpApiKey();
  return {
    fetchHtml: async (url) => {
      // Cap download size; truncate instead of failing (large Shopify/storefront pages).
      const r = await safeFetchText(url, { timeoutMs: 15_000, maxBytes: 1_500_000 });
      return { url: r.url, body: r.body, truncated: r.truncated };
    },
    ai: geminiJson,
    searchCompetitors: (ctx) => searchWithContextualQueries(ctx, searchApiKey),
    resolveBrandDomain: async (brandName) => {
      const organic = await serpGoogleSearch(searchApiKey, {
        q: `"${brandName.replace(/"/g, '')}" official website`,
        num: 6,
      });
      for (const r of organic) {
        try {
          const host = new URL(r.link).hostname.replace(/^www\./, '').toLowerCase();
          if (MARKETPLACE_OR_MEDIA.test(host)) continue;
          if (!isLikelyBrandHomepage(r.link, r.title, r.snippet)) continue;
          if (!domainLooksLikeBrand(host, brandName)) continue;
          return { domain: host, title: r.title, snippet: r.snippet, url: r.link, date: r.date };
        } catch {
          continue;
        }
      }
      return null;
    },
    findFacebookPageId: async (name) => {
      const fromUrl = extractPageIdFromFacebookUrl(name);
      return fromUrl || searchFacebookPages(name, searchApiKey);
    },
    // Meta Ad Library via Graph token only — SerpApi has no Meta Ad Library engine.
    fetchAds: (pageId) =>
      fetchMetaAdLibraryAds({ pageIds: [pageId], contextualKeywords: [], searchApiKey: undefined }),
    fetchTransparencyAds: async (comp) => {
      const ads = await serpAdsTransparency(searchApiKey, comp.domain || comp.name, { num: 6 });
      return ads
        .filter((ad) => ad.details_link || ad.ad_creative_id)
        .map((ad) => {
          const shown = ad.first_shown ?? ad.last_shown;
          return {
            advertiser: ad.advertiser,
            text: [ad.format, ad.advertiser].filter(Boolean).join(' · '),
            url:
              ad.details_link ||
              (ad.advertiser_id && ad.ad_creative_id
                ? `https://adstransparency.google.com/advertiser/${ad.advertiser_id}/creative/${ad.ad_creative_id}`
                : `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(comp.domain)}`),
            publishedAt: shown ? new Date(shown * 1000).toISOString() : null,
            format: ad.format,
          };
        });
    },
    searchSocialPosts: async (name) => {
      const safe = name.replace(/"/g, '').trim();
      if (!safe) return [];
      // One bounded SerpApi call: public IG/FB posts only (no platform login).
      const organic = await serpGoogleSearch(searchApiKey, {
        q: `("${safe}") (site:instagram.com/p OR site:instagram.com/reel OR site:facebook.com)`,
        num: 10,
        tbs: 'qdr:y',
      });
      const seen = new Set<string>();
      const out: SearchResult[] = [];
      for (const r of organic) {
        if (!SOCIAL_POST_URL.test(r.link) || seen.has(r.link)) continue;
        seen.add(r.link);
        let domain = 'instagram.com';
        try {
          domain = new URL(r.link).hostname.replace(/^www\./, '');
        } catch {
          /* keep default */
        }
        out.push({
          domain,
          title: r.title,
          snippet: r.snippet,
          url: r.link,
          date: r.date,
        });
      }
      return out;
    },
    now: () => new Date(),
    hasSearchProvider: Boolean(searchApiKey),
  };
}
