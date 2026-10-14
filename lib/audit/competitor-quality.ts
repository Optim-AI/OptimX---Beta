/**
 * Deterministic competitor quality: scoring, rejection, and name mining.
 * Used after SerpApi collection and before / after Gemini classification.
 */

import type { AuditBrand } from './types';

export type CompetitorCandidate = {
  domain: string;
  title: string;
  snippet: string;
  url: string;
  date?: string;
};

export type CompetitorScore = {
  score: number;
  reasons: string[];
  rejected: boolean;
  rejectReason?: string;
};

const DIRECTORY_OR_AGGREGATOR =
  /(^|\.)(wikipedia|wikidata|yelp|justdial|indiamart|sulekha|yellowpages|crunchbase|zoominfo|linkedin|glassdoor|indeed|ambitionbox|clutch|g2|capterra|trustpilot|bbb\.org|sites\.google|medium\.com|blogspot|wordpress\.com|shopify\.com|myshopify|amazon|flipkart|myntra|nykaa|purplle|firstcry|healthkart|1mg|pharmeasy)\./i;

/** Tokens too generic to establish competitive fit on their own. */
const WEAK_GENERIC =
  /\b(organic|natural|herbal|ayurvedic|skincare|haircare|beauty|wellness|brand|store|shop|official|home|company|india|indian)\b/i;

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'your', 'our', 'all', 'are', 'was', 'were',
  'been', 'into', 'over', 'also', 'than', 'then', 'them', 'they', 'their', 'about', 'have', 'has',
  'had', 'not', 'but', 'can', 'may', 'via', 'per', 'any', 'own', 'new', 'made', 'using', 'based',
  'more', 'most', 'other', 'such', 'only', 'just', 'like', 'very', 'who', 'what', 'when', 'where',
  'which', 'while', 'will', 'would', 'could', 'should', 'seeking', 'looking', 'consumers', 'customers',
]);

export function normalizeBrandToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function namesOverlap(a: string, b: string): boolean {
  const x = normalizeBrandToken(a);
  const y = normalizeBrandToken(b);
  if (!x || !y || x.length < 3 || y.length < 3) return false;
  return x.includes(y) || y.includes(x);
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !WEAK_GENERIC.test(t))
  );
}

/** Category / niche tokens from the audited brand. */
export function brandCategoryTokens(brand: AuditBrand): Set<string> {
  const i = brand.interpretation;
  const bag = [
    i.niche,
    i.industry,
    i.productCategory,
    ...i.products,
    ...i.searchKeywords,
    i.audience,
    i.positioning,
  ]
    .filter(Boolean)
    .join(' ');
  return tokenSet(bag);
}

/**
 * Score a search hit as a possible competitor homepage.
 * Rejects marketplaces/directories; rewards category/geo overlap.
 */
export function scoreCompetitorCandidate(
  candidate: CompetitorCandidate,
  brand: AuditBrand,
  ownHost: string
): CompetitorScore {
  const reasons: string[] = [];
  const domain = candidate.domain.toLowerCase().replace(/^www\./, '');
  const own = ownHost.toLowerCase().replace(/^www\./, '');
  if (!domain || domain === own || domain.endsWith('.' + own)) {
    return { score: 0, reasons: [], rejected: true, rejectReason: 'own_domain' };
  }
  if (DIRECTORY_OR_AGGREGATOR.test(domain)) {
    return { score: 0, reasons: [], rejected: true, rejectReason: 'directory_or_marketplace' };
  }
  if (namesOverlap(candidate.title, brand.name) || namesOverlap(domain, brand.name)) {
    return { score: 0, reasons: [], rejected: true, rejectReason: 'same_brand' };
  }

  const hay = `${candidate.title} ${candidate.snippet} ${domain}`.toLowerCase();
  const cats = brandCategoryTokens(brand);
  let score = 0;
  let overlap = 0;
  for (const t of cats) {
    if (hay.includes(t)) {
      overlap++;
      score += 2;
    }
  }
  if (overlap >= 2) reasons.push(`category_overlap:${overlap}`);
  else if (overlap === 1) reasons.push('weak_category_overlap');

  // Sharing only “organic/natural/skincare” language is not competitive evidence.
  if (overlap === 0) {
    if (/\b(organic|natural|herbal|ayurvedic)\b/i.test(hay)) {
      reasons.push('generic_organic_only');
    }
    return {
      score: 0,
      reasons,
      rejected: true,
      rejectReason: 'insufficient_category_fit',
    };
  }

  const country = brand.interpretation.country?.toLowerCase() || '';
  if (country) {
    const geoHints = [country];
    if (/india|in\b/.test(country)) geoHints.push('india', 'indian', 'bharat');
    if (geoHints.some((g) => hay.includes(g)) || domain.endsWith('.in')) {
      score += 3;
      reasons.push('geo_match');
    }
  }

  // Official-looking shop / product language (beyond buzzwords alone)
  if (/\b(shop|buy|products?|serum|soap|oil|cream|butter|wash|bar|bars)\b/i.test(hay)) {
    score += 1;
    reasons.push('commerce_language');
  }

  // Prefer short brand-like domains
  const label = domain.split('.')[0] || '';
  if (label.length >= 4 && label.length <= 22 && !/shop|store|online|best|top/.test(label)) {
    score += 1;
  }

  // Require meaningful category overlap; geo/commerce alone cannot pass.
  const rejected = score < 3 || overlap < 1;
  return {
    score,
    reasons,
    rejected,
    rejectReason: rejected ? 'insufficient_category_fit' : undefined,
  };
}

/**
 * Pull likely brand names from listicle titles/snippets (Title Case phrases).
 * Copy-only — never invents names not present in text.
 */
export function extractBrandNamesFromText(
  texts: string[],
  exclude: string[],
  limit = 8
): string[] {
  const excludeN = exclude.map(normalizeBrandToken).filter(Boolean);
  const found: string[] = [];
  const seen = new Set<string>();
  const re =
    /\b([A-Z][A-Za-z0-9'&.]*(?:\s+(?:&|and|of|the|Co\.?|Labs?|Organics?|Chemistry|Essentials?|Ayurveda|Naturals?))?(?:\s+[A-Z][A-Za-z0-9'&.]*){0,3})\b/g;

  for (const raw of texts) {
    if (!raw) continue;
    let m: RegExpExecArray | null;
    const copy = raw;
    while ((m = re.exec(copy)) !== null) {
      const name = m[1].replace(/\s+/g, ' ').trim();
      if (name.length < 3 || name.length > 40) continue;
      if (/^(The|Best|Top|India|Indian|Organic|Natural|Shop|Buy|Free|New)$/i.test(name)) continue;
      if (/\b(Best|Top|\d+|Alternatives?|Brands?|Products?)\b/i.test(name) && name.split(/\s+/).length <= 2) {
        continue;
      }
      const n = normalizeBrandToken(name);
      if (!n || seen.has(n)) continue;
      if (excludeN.some((e) => n.includes(e) || e.includes(n))) continue;
      seen.add(n);
      found.push(name);
      if (found.length >= limit) return found;
    }
  }
  return found;
}

export type ClassifiedCompetitor = {
  name: string;
  domain?: string;
  url?: string;
  snippet?: string;
  title?: string;
  classification: 'direct' | 'adjacent';
  overlapReason: string;
  confidence: 'high' | 'medium' | 'low';
  selectedBy: 'ai_from_search_results' | 'search_heuristic';
};

/** Prefer direct over adjacent, then higher confidence/score. */
export function rankClassified(
  items: Array<ClassifiedCompetitor & { score?: number }>
): ClassifiedCompetitor[] {
  const rankConf = { high: 3, medium: 2, low: 1 };
  return [...items].sort((a, b) => {
    const cd = (a.classification === 'direct' ? 2 : 1) - (b.classification === 'direct' ? 2 : 1);
    if (cd) return -cd;
    const cc = rankConf[a.confidence] - rankConf[b.confidence];
    if (cc) return -cc;
    return (b.score || 0) - (a.score || 0);
  });
}
