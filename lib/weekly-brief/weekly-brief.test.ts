/**
 * Monday brief: week maths, due-time check, content, email escaping.
 * Run: npx tsx lib/weekly-brief/weekly-brief.test.ts
 */
import assert from 'node:assert/strict';
import { lastFullWeek, isBriefDue } from './week';
import { buildBriefContent, oneLineSummary } from './content';
import { renderBriefEmail, esc } from './email';
import type { DashboardPayload, LeaderboardAd } from '@/lib/meta-intel/summary';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

run('lastFullWeek: Monday–Sunday before the current week', () => {
  assert.deepEqual(lastFullWeek('2026-11-09'), { start: '2026-11-02', end: '2026-11-08' }); // Monday
  assert.deepEqual(lastFullWeek('2026-11-08'), { start: '2026-10-26', end: '2026-11-01' }); // Sunday
  assert.deepEqual(lastFullWeek('2026-11-12'), { start: '2026-11-02', end: '2026-11-08' }); // Thursday
  assert.deepEqual(lastFullWeek('2027-01-04'), { start: '2026-12-28', end: '2027-01-03' });
});

run('isBriefDue: 9:00–9:29 Monday local, incl. IST (+5:30)', () => {
  assert.equal(isBriefDue('Asia/Kolkata', new Date('2026-11-09T03:30:00Z')), true);  // Mon 09:00 IST
  assert.equal(isBriefDue('Asia/Kolkata', new Date('2026-11-09T04:00:00Z')), false); // Mon 09:30 IST
  assert.equal(isBriefDue('Asia/Kolkata', new Date('2026-11-09T03:00:00Z')), false); // Mon 08:30 IST
  assert.equal(isBriefDue('Asia/Kolkata', new Date('2026-11-10T03:30:00Z')), false); // Tue
  assert.equal(isBriefDue('America/New_York', new Date('2026-11-09T14:00:00Z')), true); // Mon 09:00 EST
});

const score = (o: Partial<LeaderboardAd['score']>) => ({ status: 'steady', fatiguing: false, reasons: [], cpa: null, roas: null, ctr: null, cpaVsAvgPct: null, roasVsAvgPct: null, ctrLast7: null, ctrPrev7: null, ctrChangePct: null, frequencyLast7: null, frequencyPrev7: null, ...o }) as LeaderboardAd['score'];
const ad = (o: Partial<LeaderboardAd>): LeaderboardAd => ({ adId: 'x', name: 'Ad', campaignName: null, status: 'ACTIVE', madeBySkalx: false, skxReason: null, headline: null, primaryText: null, thumbnailUrl: null, spend: 1000, impressions: 10000, clicks: 100, ctr: 1, purchases: 3, revenue: 3000, roas: 3, cpa: 333.33, frequency: 1.2, score: score({}), ...o });
const dash = (o: Partial<DashboardPayload>): DashboardPayload => ({
  state: 'ready', range: 7, period: { since: '2026-11-02', until: '2026-11-08' }, previousPeriod: { since: '2026-10-26', until: '2026-11-01' },
  currency: 'INR', timezone: 'Asia/Kolkata', mixedCurrency: false, excludedAccounts: [], hasAdAccounts: true, hasOrganicAccounts: true,
  dataState: 'ok', minSpend: 1500, lastSyncAt: null, syncing: false, needsReconnect: false,
  kpis: { spend: 28503, revenue: 73000, roas: 2.56, cpa: 385.18, purchases: 74, ctr: 1.52 },
  previousKpis: { spend: 25000, revenue: 60000, roas: 2.4, cpa: 400, purchases: 62, ctr: 1.4 },
  averages: { cpa: 385.18, roas: 2.56, ctr: 1.52 }, scoringMinSpend: 1155.54,
  deltas: { spend: 14, revenue: 21.7, roas: 6.7, cpa: -3.7, purchases: 19.4, ctr: 8.6 },
  trend: [], ads: [], comparison: { ready: false, skalx: null, others: null }, organic: [], ...o,
});

run('one line: revenue, purchases-only, no tracking, empty', () => {
  assert.equal(oneLineSummary(dash({})), 'You spent ₹28,503 and made ₹73,000 in sales (2.56× back), return up 6.7% on the week before.');
  assert.equal(oneLineSummary(dash({ kpis: { spend: 28503, revenue: null, roas: null, cpa: 385.18, purchases: 74, ctr: 1.5 } })), 'You spent ₹28,503 and got 74 purchases at ₹385.18 each, cost per purchase down 3.7% on the week before.');
  assert.match(oneLineSummary(dash({ kpis: { spend: 5000, revenue: null, roas: null, cpa: null, purchases: null, ctr: 1.2 } })), /isn’t reporting purchases.*1\.20% /);
  assert.equal(oneLineSummary(dash({ dataState: 'empty', kpis: { spend: 0, revenue: null, roas: null, cpa: null, purchases: null, ctr: null } })), 'No ads ran last week.');
});

run('content: top 2 winners by ROAS, stop = live losing then tiring, top post', () => {
  const d = dash({
    ads: [
      ad({ adId: 'w1', name: 'Heritage', roas: 3.6, score: score({ status: 'winner' }) }),
      ad({ adId: 'w2', name: 'Retargeting', roas: 4.1, score: score({ status: 'winner' }) }),
      ad({ adId: 'w3', name: 'Third', roas: 3.0, score: score({ status: 'winner' }) }),
      ad({ adId: 'l1', name: 'Carousel', spend: 5000, cpa: 603, status: 'ACTIVE', score: score({ status: 'losing' }) }),
      ad({ adId: 'l2', name: 'Old paused', spend: 9000, cpa: 900, status: 'PAUSED', score: score({ status: 'losing' }) }),
      ad({ adId: 't1', name: 'Tired video', score: score({ status: 'steady', fatiguing: true, ctrPrev7: 1.5, ctrLast7: 1, frequencyLast7: 3.4 }) }),
    ],
    organic: [{ postId: 'p', platform: 'instagram', mediaType: 'REEL', caption: 'How we pack every jar', permalink: 'https://instagram.com/p', thumbnailUrl: null, postedAt: null, views: 31000, reach: null, likes: 1290, comments: 140, saves: 210, shares: 97, engagement: 1737 }],
  });
  const c = buildBriefContent(d, { start: '2026-11-02', end: '2026-11-08' });
  assert.deepEqual(c.winners.map((w) => w.adId), ['w2', 'w1']);
  assert.deepEqual(c.stop.map((s) => [s.adId, s.reason]), [['l1', 'losing'], ['t1', 'tiring']]);
  assert.match(c.stop[0].line, /₹603 per purchase vs your average ₹385\.18/);
  assert.match(c.topPost!.line, /1,737 likes.*31,000 views/);
});

run('email: escapes user text, includes pack link and opt-out', () => {
  const c = buildBriefContent(dash({ ads: [ad({ adId: 'w', name: '<script>alert(1)</script>', score: score({ status: 'winner' }) })] }), { start: '2026-11-02', end: '2026-11-08' });
  c.pack = { id: 'p1', ads: 5 };
  const e = renderBriefEmail(c, { dashboard: 'https://skalxai.app/meta-intelligence', pack: 'https://skalxai.app/content-studio/test-pack/p1', settings: 'https://skalxai.app/settings?tab=integrations' }, 'Oorgaa');
  assert.ok(!e.html.includes('<script>'));
  assert.ok(e.html.includes('&lt;script&gt;'));
  assert.match(e.html, /See 5 new ads to test/);
  assert.match(e.html, /Turn off the Monday email/);
  assert.match(e.subject, /^Oorgaa: your Monday ad brief \(2 Nov – 8 Nov\)$/);
  assert.match(e.text, /5 new ads to test: https:\/\/skalxai\.app\/content-studio\/test-pack\/p1/);
  assert.equal(esc(`"a'&`), '&quot;a&#39;&amp;');
});

if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll Monday brief tests passed');
