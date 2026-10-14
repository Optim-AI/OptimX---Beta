/**
 * Deterministic brand profile from homepage content when Gemini is unavailable
 * or returns unusable output. Clearly marked — never pretends to be AI analysis.
 */

import type { AuditBrand, SiteSnapshot } from './types';

const PRODUCT_PATTERNS: Array<{ re: RegExp; label: string; category: string }> = [
  { re: /\b(face\s*wash|cleanser|serum|moisturizer|moisturiser|sunscreen|toner|face\s*oil|body\s*butter|lip\s*balm|cream|lotion)\b/gi, label: 'skincare products', category: 'skincare' },
  { re: /\b(hair\s*oil|shampoo|conditioner|hair\s*mask|haircare|hair\s*care)\b/gi, label: 'haircare products', category: 'haircare' },
  { re: /\b(soap|body\s*wash|bath|scrub)\b/gi, label: 'bath & body', category: 'personal care' },
  { re: /\b(ayurvedic|ayurveda)\b/gi, label: 'ayurvedic care', category: 'ayurvedic personal care' },
  { re: /\b(organic|natural|herbal|botanical|cruelty[\s-]?free|vegan)\b/gi, label: 'natural/clean beauty', category: 'natural personal care' },
  { re: /\b(protein|supplement|vitamin|nutraceutical)\b/gi, label: 'supplements', category: 'supplements' },
  { re: /\b(apparel|clothing|fashion|footwear|sneakers)\b/gi, label: 'apparel', category: 'apparel' },
  { re: /\b(saas|software|platform|api)\b/gi, label: 'software', category: 'software' },
];

function metadataBrandName(site: SiteSnapshot, host: string): string {
  const fromTitle = site.title.split(/\s[|\-–—:·]\s/)[0]?.trim();
  if (fromTitle && fromTitle.length >= 2 && fromTitle.length <= 40) return fromTitle;
  const label = host.split('.')[0] || host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function inferCountry(site: SiteSnapshot, host: string): string {
  const blob = `${site.title} ${site.description} ${site.headings.join(' ')} ${site.excerpt}`.toLowerCase();
  if (/\.in$/i.test(host) || /\b(india|indian|bharat|₹|inr)\b/i.test(blob)) return 'India';
  if (/\.uk$/i.test(host) || /\b(united kingdom|britain|uk)\b/i.test(blob)) return 'United Kingdom';
  if (/\.au$/i.test(host) || /\baustralia\b/i.test(blob)) return 'Australia';
  if (/\.ca$/i.test(host) || /\bcanada\b/i.test(blob)) return 'Canada';
  if (/\b(united states|usa|u\.s\.a)\b/i.test(blob)) return 'United States';
  return '';
}

function uniq(items: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = item.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 80));
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Build a usable brand profile from title/description/headings/excerpt only.
 * Basis is always deterministic_fallback so callers never confuse this with AI.
 */
export function deterministicBrandFromSite(site: SiteSnapshot, host: string): AuditBrand {
  const blob = `${site.title}\n${site.description}\n${site.headings.join('\n')}\n${site.excerpt}`;
  const products: string[] = [];
  const categories: string[] = [];
  const keywords: string[] = [];

  for (const p of PRODUCT_PATTERNS) {
    const matches = blob.match(p.re);
    if (!matches?.length) continue;
    categories.push(p.category);
    keywords.push(p.category, p.label);
    for (const m of matches.slice(0, 4)) {
      products.push(m.replace(/\s+/g, ' ').trim().toLowerCase());
    }
  }

  // Pull short product-like phrases from headings.
  for (const h of site.headings) {
    if (/\b(shop|buy|bestseller|collection|about|blog|cart|account)\b/i.test(h)) continue;
    if (h.length >= 4 && h.length <= 48) products.push(h);
  }

  const productCategory = uniq(categories, 1)[0] || '';
  const industry =
    /skincare|haircare|beauty|personal care|ayurvedic/i.test(categories.join(' '))
      ? 'personal care'
      : productCategory || '';
  const nicheParts = uniq(
    [
      site.description.split(/[.!?]/)[0] || '',
      productCategory,
      products.slice(0, 2).join(' & '),
    ],
    3
  );
  const country = inferCountry(site, host);
  const audience = country
    ? `${country} shoppers interested in ${productCategory || 'these products'}`
    : productCategory
      ? `Shoppers interested in ${productCategory}`
      : '';

  const facts: AuditBrand['facts'] = [];
  if (site.title) facts.push({ label: 'Page title', value: site.title, sourceId: site.sourceId });
  if (site.description) {
    facts.push({ label: 'Meta description', value: site.description, sourceId: site.sourceId });
  }
  if (site.headings[0]) {
    facts.push({ label: 'Main headline', value: site.headings[0], sourceId: site.sourceId });
  }

  const hasSignal = Boolean(productCategory || products.length || site.description);
  return {
    name: metadataBrandName(site, host),
    facts,
    interpretation: {
      products: uniq(products, 6),
      niche: nicheParts.join(' — ').slice(0, 160),
      industry,
      productCategory,
      positioning: site.description.slice(0, 300),
      audience: audience.slice(0, 240),
      tone: '',
      country,
      searchKeywords: uniq(
        [...keywords, ...products, productCategory, industry].filter(Boolean),
        8
      ),
    },
    confidence: hasSignal ? 'medium' : 'low',
    basis: 'deterministic_fallback',
  };
}
