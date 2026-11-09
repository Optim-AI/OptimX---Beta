/**
 * Run: npx tsx lib/audit/lead-input.test.ts
 */
import assert from 'node:assert/strict';
import { cleanLeadCategory, normalizeLeadEmail } from './lead-input';

assert.equal(normalizeLeadEmail('  Founder@Brand.IN '), 'founder@brand.in');
assert.equal(normalizeLeadEmail('not-an-email'), null);
assert.equal(normalizeLeadEmail(''), null);
assert.equal(normalizeLeadEmail(42), null);
assert.equal(normalizeLeadEmail(`${'a'.repeat(250)}@b.co`), null);

assert.equal(cleanLeadCategory('  Skincare & beauty '), 'Skincare & beauty');
assert.equal(cleanLeadCategory(''), null);
assert.equal(cleanLeadCategory(null), null);
assert.equal(cleanLeadCategory('x'.repeat(200))?.length, 80);

console.log('lead-input: all assertions passed');
