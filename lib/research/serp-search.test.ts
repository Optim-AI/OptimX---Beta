/**
 * Run: npx tsx lib/research/serp-search.test.ts
 */
import assert from 'node:assert/strict';
import { serpGoogleSearchDetailed } from './serp-search';

async function main() {
  console.log('=== serp search outcomes ===');

  const missing = await serpGoogleSearchDetailed(undefined, { q: 'organic skincare brands' });
  assert.equal(missing.outcome, 'missing_key');
  assert.equal(missing.results.length, 0);

  const emptyQ = await serpGoogleSearchDetailed('fake-key', { q: '   ' });
  assert.equal(emptyQ.outcome, 'empty');

  console.log('serp search outcome checks passed');
}

void main();
