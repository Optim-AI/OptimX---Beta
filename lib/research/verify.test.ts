/**
 * Brand Research fact check, using the problems found in a real report.
 * Run: npx tsx lib/research/verify.test.ts
 */
import assert from 'node:assert/strict';
import { buildEvidence, cleanText, keepIfBacked, verifyResearch, tokens } from './verify';
import type { BrandResearch } from './brand-research';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}
const EV = buildEvidence([
  'Website: https://www.oorgaa.com/ Chicken Pickle ₹249 (300g). Prawn Pickle ₹299.',
  JSON.stringify({ competitors: [{ name: 'Tulasi Pickles', price: 'Rs. 400 for 250g' }], claims: ['100% homemade pickles everywhere'], reputation: '4.3 on Justdial from 3 ratings', market: 'The Indian pickle market is projected to grow at 8.5% a year until 2030.' }),
]);
const st = () => ({ removedStatements: 0, unverifiedSources: 0 });

run('units are read: price, percent, rating, plain', () => {
  assert.deepEqual(tokens('Rs. 249, ₹300, 12%, 4.3/5, 250g').map((t) => t.kind), ['money', 'money', 'percent', 'rating', 'plain']);
});

run('an invented percentage is removed even when the same % appears elsewhere', () => {
  const s = st();
  const out = cleanText('Sold Out pages hurt sales. They create 100% bounce rates and burn budget.', EV, s);
  assert.equal(out, 'Sold Out pages hurt sales.');
  assert.equal(s.removedStatements, 1);
});

run('a percentage backed by the same words is kept', () => {
  assert.equal(cleanText('The pickle market is growing 8.5% a year.', EV, st()), 'The pickle market is growing 8.5% a year.');
});

run('prices: found ones stay, made-up ranges go', () => {
  assert.equal(keepIfBacked('₹249 for 300g', EV, st()), '₹249 for 300g');
  assert.equal(keepIfBacked('Rs. 400 - Rs. 800 for 250g - 500g', EV, st()), undefined);
});

run('ratings must be real; small counts and years are fine', () => {
  assert.equal(keepIfBacked('4.3 on Justdial (3 ratings)', EV, st()), '4.3 on Justdial (3 ratings)');
  assert.equal(keepIfBacked('4.8 on Amazon (1,200 ratings)', EV, st()), undefined);
  assert.equal(cleanText('Launched in 2026 with 3 jars.', EV, st()), 'Launched in 2026 with 3 jars.');
});

run('a cited source that was not a real search result is dropped and the point becomes inferred', () => {
  const r = {
    version: 1, generatedAt: '', websiteUrl: 'https://www.oorgaa.com/', summary: '',
    snapshot: { category: '', business_model: '', market: '', price_point: '₹249 to ₹299', price_evidence: '' },
    positioning: { claimed: '', proof_points: [], gaps: [], verdict: '' }, audiences: [], competitors: [],
    customer_voice: {
      desires: [
        { insight: 'Buyers want boneless meat', evidence: 'Reddit threads', source: 'quora.com', basis: 'web' },
        { insight: 'Buyers compare with Tulasi', evidence: 'listing', source: 'https://www.tulasipickles.com/shop', basis: 'web' },
        { insight: 'From the site', evidence: 'home page', source: 'oorgaa.com', basis: 'site' },
      ], frustrations: [], objections: [], their_words: [],
    },
    market: { sophistication: { stage: 3, meaning: '' }, category_conventions: [], saturated_claims: [], whitespace: [] },
    reputation: { summary: '', ratings: [], basis: 'web' }, site_findings: [], opportunities: [],
    sources: [], evidence: { pages_read: 1, products_found: 0, web_sources: 1, web_research: 'ok', notes: [] },
  } as unknown as BrandResearch;
  const { research, stats } = verifyResearch(r, { evidenceTexts: ['₹249 ₹299'], sources: [{ title: 'tulasipickles.com', url: 'https://x' }] });
  const d = research.customer_voice.desires;
  assert.deepEqual(d.map((x) => [x.source ?? null, x.basis]), [[null, 'inferred'], ['https://www.tulasipickles.com/shop', 'web'], ['oorgaa.com', 'site']]);
  assert.equal(stats.unverifiedSources, 1);
  assert.equal(research.snapshot.price_point, '₹249 to ₹299');
  assert.ok(research.evidence.notes.some((n) => /couldn’t confirm/.test(n)));
});

if (failures) { console.error(`\n${failures} failed`); process.exit(1); }
console.log('\nAll research fact-check tests passed');
