/**
 * Dashboard KPI helpers.
 * Run: npx tsx lib/meta-intel/kpis.test.ts
 */
import assert from 'node:assert/strict';
import { periods, deriveKpis, pctChange, compareKpis, fillDaily, comparisonReady, dataState, emptySums, parseRange, minSpendFor } from './kpis';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

run('periods: current and previous of equal length', () => {
  assert.deepEqual(periods(7, '2026-11-08'), { current: { since: '2026-11-02', until: '2026-11-08' }, previous: { since: '2026-10-26', until: '2026-11-01' } });
  assert.deepEqual(periods(30, '2026-03-01').previous, { since: '2026-01-01', until: '2026-01-30' });
});

run('parseRange defaults to 30', () => {
  assert.equal(parseRange('14'), 14);
  assert.equal(parseRange('15'), 30);
  assert.equal(parseRange(undefined), 30);
});

run('deriveKpis: ratios and unknowns', () => {
  const k = deriveKpis({ spend: 10000, revenue: 35000, revenueRows: 10, purchases: 50, purchaseRows: 10, clicks: 900, impressions: 60000 });
  assert.deepEqual(k, { spend: 10000, revenue: 35000, roas: 3.5, cpa: 200, purchases: 50, ctr: 1.5 });
  const none = deriveKpis({ ...emptySums(), spend: 500, impressions: 1000, clicks: 10 });
  assert.equal(none.revenue, null);
  assert.equal(none.roas, null);
  assert.equal(none.purchases, null);
  assert.equal(none.cpa, null);
  assert.equal(none.ctr, 1);
  const zeroPurchases = deriveKpis({ ...emptySums(), spend: 500, purchaseRows: 3, purchases: 0 });
  assert.equal(zeroPurchases.purchases, 0);
  assert.equal(zeroPurchases.cpa, null);
  assert.equal(deriveKpis(emptySums()).ctr, null);
});

run('pctChange and compareKpis', () => {
  assert.equal(pctChange(120, 100), 20);
  assert.equal(pctChange(80, 100), -20);
  assert.equal(pctChange(5, 0), null);
  assert.equal(pctChange(null, 10), null);
  const d = compareKpis(deriveKpis({ ...emptySums(), spend: 200, purchases: 2, purchaseRows: 1 }), deriveKpis({ ...emptySums(), spend: 100, purchases: 2, purchaseRows: 1 }));
  assert.equal(d.spend, 100);
  assert.equal(d.cpa, 100);
  assert.equal(d.roas, null);
});

run('fillDaily fills gaps', () => {
  const pts = fillDaily([{ date: '2026-11-02', spend: 10, revenue: 30 }], { since: '2026-11-01', until: '2026-11-03' });
  assert.deepEqual(pts, [
    { date: '2026-11-01', spend: 0, revenue: null },
    { date: '2026-11-02', spend: 10, revenue: 30 },
    { date: '2026-11-03', spend: 0, revenue: null },
  ]);
});

run('gates: comparison and data state', () => {
  const big = { ...emptySums(), spend: 2000, impressions: 5000 };
  const small = { ...emptySums(), spend: 900, impressions: 5000 };
  assert.equal(comparisonReady(big, big, 'INR'), true);
  assert.equal(comparisonReady(big, small, 'INR'), false);
  assert.equal(comparisonReady(null, big, 'INR'), false);
  assert.equal(comparisonReady(small, small, 'USD'), true);
  assert.equal(dataState(emptySums(), 'INR'), 'empty');
  assert.equal(dataState(small, 'INR'), 'limited');
  assert.equal(dataState(big, 'INR'), 'ok');
  assert.equal(minSpendFor('inr'), 1500);
  assert.equal(minSpendFor('JPY'), 20);
});

if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll dashboard KPI tests passed');
