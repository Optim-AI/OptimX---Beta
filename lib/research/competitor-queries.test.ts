/**
 * Run: npx tsx lib/research/competitor-queries.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildContextualQueries,
  buildFallbackQueries,
  type BrandContext,
} from './competitor-research';

const deyga: BrandContext = {
  brand_name: 'Deyga',
  domain_name: 'deyga.in',
  industry_category: 'personal care',
  product_category: 'organic skincare',
  primary_keywords: ['organic skincare', 'natural haircare', 'botanical'],
  country: 'India',
};

console.log('=== competitor queries ===');

{
  const q = buildContextualQueries(deyga);
  assert.ok(q.length >= 4);
  assert.ok(q.some((x) => /organic skincare/i.test(x)));
  assert.ok(q.some((x) => /India/i.test(x)));
  assert.ok(q.some((x) => /competitors|similar|like|alternatives/i.test(x)));
  assert.ok(!q.some((x) => /^top products brands/i.test(x)), 'must not emit generic “top products brands”');
}

{
  const fallback = buildFallbackQueries(deyga);
  assert.ok(fallback.length >= 2);
  assert.ok(fallback.some((x) => /Deyga/i.test(x) || /organic skincare/i.test(x)));
}

{
  const weak: BrandContext = {
    brand_name: 'Acme',
    domain_name: 'acme.test',
    industry_category: '',
    product_category: '',
    primary_keywords: [],
    country: '',
  };
  const q = buildContextualQueries(weak);
  assert.ok(q.length >= 1);
  assert.ok(!q.some((x) => /top products brands$/i.test(x)));
}

console.log('competitor query checks passed');