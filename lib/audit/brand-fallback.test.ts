/**
 * Run: npx tsx lib/audit/brand-fallback.test.ts
 */
import assert from 'node:assert/strict';
import { deterministicBrandFromSite } from './brand-fallback';
import type { SiteSnapshot } from './types';

function site(partial: Partial<SiteSnapshot>): SiteSnapshot {
  return {
    requestedUrl: 'https://deyga.in/',
    finalUrl: 'https://deyga.in/',
    title: 'Deyga Organics | Natural Skincare',
    description: 'Organic face wash, hair oil and body butter made in India.',
    headings: ['Clean botanical formulas', 'Face wash', 'Hair oil'],
    excerpt:
      'Deyga Organics makes natural organic skincare and haircare. Shop face wash, hair oil, body butter. Cruelty-free botanical care for Indian skin.',
    socialLinks: { facebook: null, instagram: null },
    retrievedAt: '2026-10-14T12:00:00Z',
    sourceId: 'w1',
    ...partial,
  };
}

console.log('=== brand fallback ===');

{
  const brand = deterministicBrandFromSite(site({}), 'deyga.in');
  assert.equal(brand.basis, 'deterministic_fallback');
  assert.match(brand.name, /deyga/i);
  assert.equal(brand.interpretation.country, 'India');
  assert.ok(
    /skincare|haircare|personal care|natural/i.test(brand.interpretation.productCategory) ||
      brand.interpretation.products.length > 0
  );
  assert.ok(brand.interpretation.searchKeywords.length >= 1);
  assert.ok(brand.confidence === 'medium' || brand.confidence === 'low');
}

{
  const thin = deterministicBrandFromSite(
    site({
      title: 'Welcome',
      description: '',
      headings: [],
      excerpt: 'Hello world.',
    }),
    'example.com'
  );
  assert.equal(thin.basis, 'deterministic_fallback');
  assert.equal(thin.confidence, 'low');
}

console.log('brand fallback checks passed');
