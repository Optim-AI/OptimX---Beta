/**
 * Run: npx tsx lib/audit/competitor-quality.test.ts
 */
import assert from 'node:assert/strict';
import type { AuditBrand } from './types';
import {
  extractBrandNamesFromText,
  namesOverlap,
  rankClassified,
  scoreCompetitorCandidate,
} from './competitor-quality';

const brand: AuditBrand = {
  name: 'Deyga',
  facts: [],
  interpretation: {
    products: ['face wash', 'hair oil', 'body butter'],
    niche: 'natural organic skincare and haircare',
    industry: 'personal care',
    productCategory: 'organic skincare',
    positioning: 'clean botanical formulas',
    audience: 'Indian consumers seeking natural skincare',
    tone: 'warm',
    country: 'India',
    searchKeywords: ['organic skincare', 'natural haircare', 'botanical'],
  },
  confidence: 'high',
  basis: 'ai',
};

console.log('=== competitor quality ===');

{
  const nykaa = scoreCompetitorCandidate(
    {
      domain: 'nykaa.com',
      title: 'Nykaa - Beauty Shopping',
      snippet: 'Shop skincare online',
      url: 'https://www.nykaa.com/',
    },
    brand,
    'deyga.in'
  );
  assert.equal(nykaa.rejected, true);
  assert.equal(nykaa.rejectReason, 'directory_or_marketplace');
}

{
  const weak = scoreCompetitorCandidate(
    {
      domain: 'randomcorp.io',
      title: 'Random Corp',
      snippet: 'We love organic living and natural vibes',
      url: 'https://randomcorp.io/',
    },
    brand,
    'deyga.in'
  );
  assert.equal(weak.rejected, true, 'generic organic-only must not pass');
}

{
  const juicy = scoreCompetitorCandidate(
    {
      domain: 'juicychemistry.com',
      title: 'Juicy Chemistry | Organic Skincare',
      snippet: 'Cold-processed organic skincare and haircare made in India',
      url: 'https://juicychemistry.com/',
    },
    brand,
    'deyga.in'
  );
  assert.equal(juicy.rejected, false);
  assert.ok(juicy.score >= 4);
  assert.ok(juicy.reasons.some((r) => r.startsWith('category_overlap') || r === 'geo_match'));
}

{
  const names = extractBrandNamesFromText(
    [
      'Top Indian Organic Skincare Brands: Juicy Chemistry, Soulflower, Mamaearth and Forest Essentials',
      'Compared with Kama Ayurveda for botanical care',
    ],
    ['Deyga', 'deyga.in']
  );
  assert.ok(names.some((n) => /juicy chemistry/i.test(n)));
  assert.ok(names.some((n) => /mamaearth/i.test(n)) || names.some((n) => /soulflower/i.test(n)));
  assert.ok(!names.some((n) => namesOverlap(n, 'Deyga')));
}

{
  const ranked = rankClassified([
    {
      name: 'A',
      classification: 'adjacent',
      overlapReason: '',
      confidence: 'high',
      selectedBy: 'search_heuristic',
      score: 9,
    },
    {
      name: 'B',
      classification: 'direct',
      overlapReason: '',
      confidence: 'medium',
      selectedBy: 'ai_from_search_results',
      score: 4,
    },
  ]);
  assert.equal(ranked[0].name, 'B', 'direct outranks adjacent');
}

{
  const empty = scoreCompetitorCandidate(
    { domain: '', title: 'x', snippet: 'serum', url: 'not-a-url' },
    brand,
    'deyga.in'
  );
  assert.equal(empty.rejected, true);
  assert.equal(empty.rejectReason, 'own_domain');
}

{
  const same = scoreCompetitorCandidate(
    {
      domain: 'deyga.in',
      title: 'Deyga Organics',
      snippet: 'organic face wash hair oil',
      url: 'https://deyga.in/',
    },
    brand,
    'deyga.in'
  );
  assert.equal(same.rejected, true);
  assert.equal(same.rejectReason, 'own_domain');
}

console.log('PASS competitor quality');
