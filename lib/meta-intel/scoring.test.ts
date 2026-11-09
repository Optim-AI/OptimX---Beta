/**
 * Ad scoring rules.
 * Run: npx tsx lib/meta-intel/scoring.test.ts
 */
import assert from 'node:assert/strict';
import { scoreAd, accountAverages, minSpendThreshold, scoreAds, SCORING, type AdStats, type AccountAverages } from './scoring';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

const win = (impressions: number, clicks: number, frequency: number | null) => ({ impressions, clicks, frequency });
const steadyWeeks = { last7: win(5000, 75, 1.5), prev7: win(5000, 75, 1.4) };
const ad = (o: Partial<AdStats>): AdStats => ({ adId: 'x', spend: 5000, impressions: 20000, clicks: 300, purchases: 10, revenue: 15000, ...steadyWeeks, ...o });
const AVG: AccountAverages = { cpa: 400, roas: 3, ctr: 1.5 };

run('min spend: lower of ₹1,500 and 3× avg CPA', () => {
  assert.equal(minSpendThreshold('INR', 400), 1200);
  assert.equal(minSpendThreshold('INR', 900), 1500);
  assert.equal(minSpendThreshold('INR', null), 1500);
  assert.equal(minSpendThreshold('USD', 5), 15);
});

run('not enough data: low spend or low impressions', () => {
  assert.equal(scoreAd(ad({ spend: 1000, purchases: 5 }), AVG, 'INR').status, 'not_enough_data');
  assert.equal(scoreAd(ad({ impressions: 900 }), AVG, 'INR').status, 'not_enough_data');
  // exactly at the threshold counts
  assert.notEqual(scoreAd(ad({ spend: 1200, purchases: 3, revenue: 3600, impressions: 1000 }), AVG, 'INR').status, 'not_enough_data');
});

run('winner by CPA (≥20% better) at the boundary', () => {
  // CPA 320 = exactly 20% better than 400
  const s = scoreAd(ad({ spend: 3200, purchases: 10, revenue: 9600 }), AVG, 'INR');
  assert.equal(s.status, 'winner');
  assert.equal(s.cpaVsAvgPct, -20);
  // CPA 321 is not
  assert.equal(scoreAd(ad({ spend: 3210, purchases: 10, revenue: 9630 }), AVG, 'INR').status, 'steady');
});

run('winner by ROAS (≥20% higher) even with average CPA', () => {
  const s = scoreAd(ad({ spend: 4000, purchases: 10, revenue: 14400 }), AVG, 'INR'); // ROAS 3.6 = +20%
  assert.equal(s.status, 'winner');
  assert.equal(s.roasVsAvgPct, 20);
});

run('winner beats losing when ROAS is high but CPA is high (big baskets)', () => {
  const s = scoreAd(ad({ spend: 6000, purchases: 10, revenue: 30000 }), AVG, 'INR'); // CPA 600 (+50%), ROAS 5
  assert.equal(s.status, 'winner');
});

run('losing by CPA (≥30% worse) at the boundary', () => {
  assert.equal(scoreAd(ad({ spend: 5200, purchases: 10, revenue: 10400 }), AVG, 'INR').status, 'losing'); // 520 = +30%
  assert.equal(scoreAd(ad({ spend: 5190, purchases: 10, revenue: 10380 }), AVG, 'INR').status, 'steady');
});

run('losing: no purchases after spending 1.3× average CPA', () => {
  const s = scoreAd(ad({ spend: 1300, purchases: 0, revenue: 0 }), AVG, 'INR');
  assert.equal(s.status, 'losing');
  assert.match(s.reasons[0], /No purchases/);
  // High-ticket account (avg CPA 2,000): enough data at ₹1,500 but under 1.3 × 2,000 = 2,600 → too early to call
  const pricey = { cpa: 2000, roas: 3, ctr: 1.5 };
  assert.equal(scoreAd(ad({ spend: 2000, purchases: 0, revenue: 0 }), pricey, 'INR').status, 'steady');
  assert.equal(scoreAd(ad({ spend: 2600, purchases: 0, revenue: 0 }), pricey, 'INR').status, 'losing');
});

run('no purchase tracking → never winner/losing', () => {
  const avg = { cpa: null, roas: null, ctr: 1.5 };
  const s = scoreAd(ad({ purchases: null, revenue: null }), avg, 'INR');
  assert.equal(s.status, 'steady');
  assert.match(s.reasons[0], /not being tracked/);
});

run('fatigue: CTR down ≥25% with frequency >3 and rising', () => {
  const s = scoreAd(ad({ last7: win(4000, 40, 3.4), prev7: win(4000, 60, 2.9) }), AVG, 'INR'); // 1.5% → 1.0% (-33%)
  assert.equal(s.fatiguing, true);
  assert.equal(s.ctrChangePct, -33.3);
  // frequency not above 3
  assert.equal(scoreAd(ad({ last7: win(4000, 40, 2.9), prev7: win(4000, 60, 2.5) }), AVG, 'INR').fatiguing, false);
  // frequency above 3 but falling
  assert.equal(scoreAd(ad({ last7: win(4000, 40, 3.2), prev7: win(4000, 60, 3.5) }), AVG, 'INR').fatiguing, false);
  // CTR only down 20%
  assert.equal(scoreAd(ad({ last7: win(4000, 48, 3.4), prev7: win(4000, 60, 2.9) }), AVG, 'INR').fatiguing, false);
  // too few impressions in a week
  assert.equal(scoreAd(ad({ last7: win(400, 2, 3.4), prev7: win(4000, 60, 2.9) }), AVG, 'INR').fatiguing, false);
  // missing frequency
  assert.equal(scoreAd(ad({ last7: win(4000, 40, null), prev7: win(4000, 60, 2.9) }), AVG, 'INR').fatiguing, false);
});

run('fatigue can sit alongside winner', () => {
  const s = scoreAd(ad({ spend: 3000, purchases: 10, revenue: 12000, last7: win(4000, 40, 3.6), prev7: win(4000, 70, 3.0) }), AVG, 'INR');
  assert.equal(s.status, 'winner');
  assert.equal(s.fatiguing, true);
  assert.ok(s.reasons.some((r) => /Click rate fell/.test(r)));
});

run('account averages and scoreAds', () => {
  const ads = [ad({ adId: 'a', spend: 4000, purchases: 10, revenue: 12000 }), ad({ adId: 'b', spend: 2000, purchases: 0, revenue: 0 }), ad({ adId: 'c', spend: 1000, purchases: null, revenue: null })];
  const avg = accountAverages(ads);
  assert.equal(avg.cpa, 700);   // 7000 / 10
  assert.equal(avg.roas, 2);    // 12000 / 6000 (only spend with revenue tracking)
  const { scores, minSpend } = scoreAds(ads, 'INR');
  assert.equal(minSpend, 1500);
  assert.equal(scores.get('a')!.status, 'winner');
  assert.equal(scores.get('b')!.status, 'losing');
  assert.equal(scores.get('c')!.status, 'not_enough_data');
  assert.equal(SCORING.FATIGUE_MIN_FREQUENCY, 3);
});

if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll scoring tests passed');
