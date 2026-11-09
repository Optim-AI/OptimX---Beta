/**
 * Meta sync pure logic: insight normalisation (purchases / revenue / ROAS / CPA),
 * SKX detection, date ranges, scheduling.
 * Run: npx tsx lib/meta-sync/meta-sync.test.ts
 */
import assert from 'node:assert/strict';
import { normalizeInsight, pickAction } from './metrics';
import { detectMadeBySkalx } from './skx';
import { syncRange, chunkRange, todayInTz, addDays } from './dates';
import { isDueForScheduledSync, dueLocalHour, delayMinutes } from './schedule';

let failures = 0;
function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(e);
  }
}

const base = { ad_id: '1', adset_id: '2', campaign_id: '3', date_start: '2026-11-01', account_currency: 'INR' };

run('metrics: uses Meta purchase_roas and omni_purchase without double counting', () => {
  const r = normalizeInsight({
    ...base, spend: '1000', impressions: '50000', clicks: '500', ctr: '1.0', cpc: '2', cpm: '20',
    actions: [{ action_type: 'purchase', value: '10' }, { action_type: 'omni_purchase', value: '10' }, { action_type: 'offsite_conversion.fb_pixel_purchase', value: '10' }],
    action_values: [{ action_type: 'omni_purchase', value: '4000' }, { action_type: 'purchase', value: '4000' }],
    purchase_roas: [{ action_type: 'omni_purchase', value: '4' }],
  })!;
  assert.equal(r.purchases, 10);
  assert.equal(r.revenue, 4000);
  assert.equal(r.roas, 4);
  assert.equal(r.roasSource, 'meta');
  assert.equal(r.cpa, 100);
  assert.equal(r.purchaseSource, 'omni_purchase');
});

run('metrics: derives ROAS when purchase_roas missing', () => {
  const r = normalizeInsight({ ...base, spend: '500', impressions: '1000', actions: [{ action_type: 'purchase', value: '2' }], action_values: [{ action_type: 'purchase', value: '1500' }] })!;
  assert.equal(r.roas, 3);
  assert.equal(r.roasSource, 'derived');
  assert.equal(r.cpa, 250);
});

run('metrics: pixel-only purchases fall back correctly', () => {
  const r = normalizeInsight({ ...base, spend: '300', impressions: '100', actions: [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' }] })!;
  assert.equal(r.purchases, 3);
  assert.equal(r.revenue, null);
  assert.equal(r.roas, null);
  assert.equal(r.cpa, 100);
});

run('metrics: no purchases → nulls, not zeros; derived ctr/cpc/cpm', () => {
  const r = normalizeInsight({ ...base, spend: '200', impressions: '10000', clicks: '100', actions: [{ action_type: 'link_click', value: '80' }] })!;
  assert.equal(r.purchases, null);
  assert.equal(r.cpa, null);
  assert.equal(r.roas, null);
  assert.equal(r.ctr, 1);
  assert.equal(r.cpc, 2);
  assert.equal(r.cpm, 20);
});

run('metrics: zero spend, zero impressions, missing fields', () => {
  const r = normalizeInsight({ ...base })!;
  assert.equal(r.spend, 0);
  assert.equal(r.impressions, 0);
  assert.equal(r.reach, null);
  assert.equal(r.cpm, null);
  assert.equal(normalizeInsight({ spend: '1' } as any), null);
});

run('metrics: revenue uses same action type as purchases when available', () => {
  const r = normalizeInsight({ ...base, spend: '100', actions: [{ action_type: 'purchase', value: '1' }], action_values: [{ action_type: 'omni_purchase', value: '999' }, { action_type: 'purchase', value: '500' }] })!;
  assert.equal(r.revenue, 500);
  assert.equal(pickAction([{ action_type: 'purchase', value: 'abc' }]), null);
});

run('skx: name prefix and image hash', () => {
  const set = new Set(['abc123']);
  assert.deepEqual(detectMadeBySkalx({ adName: 'SKX-Pickle-Heritage-feed' }, set), { made: true, reason: 'name_prefix' });
  assert.deepEqual(detectMadeBySkalx({ adName: '  skx-lower' }, set), { made: true, reason: 'name_prefix' });
  assert.deepEqual(detectMadeBySkalx({ adName: 'Summer sale', imageHash: 'ABC123' }, set), { made: true, reason: 'image_hash' });
  assert.deepEqual(detectMadeBySkalx({ adName: 'My SKX- ad', imageHash: 'zzz' }, set), { made: false, reason: null });
  assert.deepEqual(detectMadeBySkalx({ adName: null }, new Set()), { made: false, reason: null });
});

run('dates: full and incremental ranges in account timezone', () => {
  const now = new Date('2026-11-08T20:00:00Z'); // 01:30 on 9 Nov in Kolkata
  assert.equal(todayInTz('Asia/Kolkata', now), '2026-11-09');
  assert.equal(todayInTz('America/Los_Angeles', now), '2026-11-08');
  assert.deepEqual(syncRange('full', 'Asia/Kolkata', null, now), { since: '2026-08-12', until: '2026-11-09' });
  assert.deepEqual(syncRange('incremental', 'Asia/Kolkata', '2026-11-08', now), { since: '2026-11-02', until: '2026-11-09' });
  // gap of 20 days since last sync → extend back
  assert.deepEqual(syncRange('incremental', 'Asia/Kolkata', '2026-10-20', now), { since: '2026-10-14', until: '2026-11-09' });
  // never earlier than 90 days
  assert.equal(syncRange('incremental', 'Asia/Kolkata', '2025-01-01', now).since, '2026-08-12');
  assert.equal(todayInTz('Not/AZone', now), '2026-11-08');
});

run('dates: chunking', () => {
  const chunks = chunkRange('2026-11-01', '2026-11-20', 7);
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[2], { since: '2026-11-15', until: '2026-11-20' });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

run('schedule: stable slot in 2–5 AM local, 20h spacing', () => {
  const id = '6f1c2f9e-1111-4222-8333-944455556666';
  const hour = dueLocalHour(id);
  assert.ok(hour >= 2 && hour <= 5);
  assert.equal(dueLocalHour(id), hour);
  assert.ok(delayMinutes(id) >= 0 && delayMinutes(id) < 50);
  // Build a UTC time where Kolkata (UTC+5:30) local hour == due hour
  // Kolkata is UTC+5:30, so local HH:05 is UTC (HH*60 - 330 + 5) minutes after midnight.
  const now = new Date(Date.UTC(2026, 10, 9) + (hour * 60 - 330 + 5) * 60_000);
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  assert.equal(localHour, hour);
  assert.equal(isDueForScheduledSync({ connectionId: id, timeZone: 'Asia/Kolkata', lastAttemptAt: null, now }), true);
  assert.equal(isDueForScheduledSync({ connectionId: id, timeZone: 'Asia/Kolkata', lastAttemptAt: new Date(now.getTime() - 3_600_000).toISOString(), now }), false);
  assert.equal(isDueForScheduledSync({ connectionId: id, timeZone: 'Asia/Kolkata', lastAttemptAt: new Date(now.getTime() - 21 * 3_600_000).toISOString(), now }), true);
  assert.equal(isDueForScheduledSync({ connectionId: id, timeZone: 'Asia/Kolkata', lastAttemptAt: null, now: new Date(now.getTime() + 3_600_000) }), false);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Meta sync tests passed');
