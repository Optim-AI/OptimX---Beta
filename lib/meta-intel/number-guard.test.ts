/**
 * Number guard for AI insights.
 * Run: npx tsx lib/meta-intel/number-guard.test.ts
 */
import assert from 'node:assert/strict';
import { collectNumbers, extractNumbers, isSupported, guardInsights, needsRetry } from './number-guard';
import type { Insights } from './insights-types';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

const input = {
  period: { since: '2026-10-10', until: '2026-11-08' },
  account: { spend: 130380, roas: 2.37, cpa: 385.74, ctr: 1.52 },
  top_ads: [{ ad_id: '120210001', name: 'SKX-MangoPickle-Heritage-feed', roas: 3.62, cpa_vs_account_pct: -34.4, ctr_change_pct: -33.3 }],
};
const pool = collectNumbers(input);

run('extract: Indian grouping, decimals, negatives', () => {
  const t = extractNumbers('Spent ₹1,30,380 at 2.37× ROAS, CTR -33.3%');
  assert.deepEqual(t.map((x) => x.value), [130380, 2.37, -33.3]);
  assert.equal(t[1].decimals, 2);
});

run('supported: exact, rounded, abs value, small counts, dates', () => {
  const ok = (s: string) => extractNumbers(s).every((t) => isSupported(t, pool));
  assert.ok(ok('₹1,30,380'));
  assert.ok(ok('2.37×'));
  assert.ok(ok('2.4×'));        // rounded to 1 dp
  assert.ok(ok('34% cheaper'));  // -34.4 → 34
  assert.ok(ok('down 33%'));
  assert.ok(ok('3 ads over 7 days'));
  assert.ok(ok('since 10 Oct 2026'));
  assert.ok(ok('₹385.74'));
  assert.ok(ok('₹386'));
});

run('unsupported: invented or wrongly rounded numbers', () => {
  const ok = (s: string) => extractNumbers(s).every((t) => isSupported(t, pool));
  assert.equal(ok('ROAS of 2.9×'), false);
  assert.equal(ok('₹1.3 lakh'), false);
  assert.equal(ok('50% more sales'), false);
  assert.equal(ok('2.5×'), false); // 2.37 rounds to 2.4, not 2.5
  assert.equal(ok('₹1,40,000'), false);
});

const base: Insights = {
  headline: 'You spent ₹1,30,380 and made 2.37× back.',
  working: [{ point: 'Heritage feed ad is your best', evidence: 'ROAS 3.62×, 34% cheaper per purchase', ad_ids: ['120210001', 'made-up'] }],
  not_working: [{ point: 'Diwali sale ad is costly', evidence: 'ROAS 1.1×', ad_ids: [] }],
  patterns: [{ point: 'Close-up product shots win', evidence: 'CTR 1.52%' }],
  next_actions: [
    { action: 'Make more like the heritage ad', why: 'ROAS 3.62×', cta: 'make_more_like_this', ad_id: '120210001' },
    { action: 'Make more like an unknown ad', why: '2 winners', cta: 'make_more_like_this', ad_id: '999' },
  ],
  angles_to_test: [{ angle: 'Heritage', hook: 'Since grandma’s kitchen', source: 'past_winner', source_detail: 'SKX-MangoPickle-Heritage-feed', why: 'ROAS 3.62×' }],
};

run('guard: drops bullets with invented numbers, strips unknown ids, fixes CTA', () => {
  const g = guardInsights(base, input, new Set(['120210001']));
  assert.equal(g.headlineOk, true);
  assert.equal(g.clean.not_working.length, 0); // 1.1× invented
  assert.equal(g.dropped.length, 1);
  assert.deepEqual(g.clean.working[0].ad_ids, ['120210001']);
  assert.equal(g.clean.next_actions[1].ad_id, null);
  assert.equal(g.clean.next_actions[1].cta, 'test_new_angle');
  assert.equal(needsRetry(g), false); // 1 of 6 dropped
});

run('guard: bad headline or many drops → retry', () => {
  const g1 = guardInsights({ ...base, headline: 'Sales grew 80%.' }, input, new Set());
  assert.equal(g1.headlineOk, false);
  assert.equal(needsRetry(g1), true);
  const g2 = guardInsights({ ...base, working: [{ point: 'x', evidence: 'ROAS 9.9×', ad_ids: [] }], patterns: [{ point: 'y', evidence: '77%' }] }, input, new Set());
  assert.equal(needsRetry(g2), true);
});

run('guard: caps list sizes', () => {
  const many = Array.from({ length: 6 }, () => ({ point: 'ok', evidence: 'ROAS 3.62×', ad_ids: [] }));
  assert.equal(guardInsights({ ...base, working: many }, input, new Set()).clean.working.length, 3);
});

if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll number guard tests passed');
