/**
 * Ad Studio poster flow: options, limits, why, preview.
 * Run: npx tsx lib/ad-studio/ad-studio.test.ts
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { AD_FORMATS, AD_GOALS, isAdFormat, isAdGoal } from './options';
import { draftsLeftToday, nextRoundSize, FREE_DRAFTS_PER_PRODUCT_PER_DAY } from './limits';
import { draftWhy, toDraftAngle } from './why';
import { makePreview, PREVIEW_MAX_SIDE } from './preview';
import { POSTER_ASPECT_RATIOS, POSTER_AD_GOALS } from '@/lib/creative-studio/poster-generation/types';
import { skxAdName, fallbackCopy, HEADLINE_MAX, PRIMARY_MAX } from './kept';
import { SKX_PREFIX } from '@/lib/meta-sync/skx';
import { roundNeedsResume, ROUND_STALE_MS, withTimeout } from './round-state';

let failures = 0;
async function run(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

(async () => {
  await run('every format/goal maps to something the poster engine supports', () => {
    for (const f of Object.values(AD_FORMATS)) assert.ok((POSTER_ASPECT_RATIOS as readonly string[]).includes(f.aspect), f.aspect);
    for (const g of Object.values(AD_GOALS)) assert.ok((POSTER_AD_GOALS as readonly string[]).includes(g.engineGoal), g.engineGoal);
    assert.equal(isAdFormat('story_9x16'), true);
    assert.equal(isAdFormat('3:2'), false);
    assert.equal(isAdGoal('offer'), true);
    assert.equal(AD_GOALS.offer.needsOffer, true);
    assert.equal(AD_GOALS.reviews.needsReviews, true);
  });

  await run('daily draft cap: 3 rounds of 8', () => {
    assert.equal(FREE_DRAFTS_PER_PRODUCT_PER_DAY, 24);
    assert.equal(nextRoundSize(0), 8);
    assert.equal(nextRoundSize(16), 8);
    assert.equal(nextRoundSize(20), 4);
    assert.equal(nextRoundSize(24), 0);
    assert.equal(draftsLeftToday(30), 0);
  });

  await run('why: maps research fields, labels the source', () => {
    const w = draftWhy({ audience: 'Bachelors', why_it_wins: 'No fish smell at home', test: 'Does convenience beat taste?', basis: 'web', evidence: 'Reddit threads' });
    assert.deepEqual(w, { forWho: 'Bachelors', whyItMightWork: 'No fish smell at home', whatItTests: 'Does convenience beat taste?', source: 'From research on the web', evidence: 'Reddit threads' });
    assert.equal(draftWhy({ angle: 'Crunch', basis: 'site' }).whatItTests, 'Whether "Crunch" gets people to buy');
    assert.equal(draftWhy({}).source, 'SkalX’s reasoning');
    assert.equal(toDraftAngle({ title: 'x'.repeat(500), basis: 42 }).title.length, 120);
    assert.equal(toDraftAngle({}).basis, 'inferred');
  });

  await run('preview: smaller, JPEG, visibly marked', async () => {
    const full = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: '#c2410c' } }).png().toBuffer();
    const prev = await makePreview(full);
    const meta = await sharp(prev).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(Math.max(meta.width!, meta.height!), PREVIEW_MAX_SIDE);
    assert.equal(meta.width, 512);
    // The watermark changes pixels vs a plain resize of the same image
    const plain = await sharp(full).resize(512, 640).jpeg({ quality: 72 }).raw().toBuffer();
    const marked = await sharp(prev).raw().toBuffer();
    let diff = 0;
    for (let i = 0; i < Math.min(plain.length, marked.length); i += 3) if (Math.abs(plain[i] - marked[i]) > 20) diff++;
    assert.ok(diff > 500, `watermark pixels changed: ${diff}`);
  });

  await run('SKX names: format suffix, unique within a project, recognised by sync', () => {
    const taken = new Set<string>();
    const a = skxAdName('Oorgaa Spicy Chilli Fried Anchovies', 'Audible crunch', 'feed_4x5', taken);
    assert.equal(a, 'SKX-OorgaaSpicyChilliFried-AudibleCrunch-Feed');
    taken.add(a.toLowerCase());
    assert.equal(skxAdName('Oorgaa Spicy Chilli Fried Anchovies', 'Audible crunch', 'feed_4x5', taken), 'SKX-OorgaaSpicyChilliFried-AudibleCrunch2-Feed');
    assert.equal(skxAdName('Nethili', 'Crunch', 'story_9x16', taken), 'SKX-Nethili-Crunch-Story');
    assert.equal(skxAdName('Nethili', 'Crunch', 'wide_191x1', taken), 'SKX-Nethili-Crunch-Wide');
    assert.ok(SKX_PREFIX.test(a));
  });

  await run('fallback copy: from the poster’s own hook and message, trimmed, never blank', () => {
    const c = fallbackCopy({ angle: 'Crunch', title: 'The fiery nethili fry crunch you can hear in every single bite', message: 'm'.repeat(400), insight: '', evidence: '', basis: 'web', audience: '', funnel: '', proof: '', why_it_wins: '', test: '' });
    assert.ok(c.headline.length <= HEADLINE_MAX && c.headline.endsWith('…'));
    assert.ok(c.primaryText.length <= PRIMARY_MAX);
    assert.equal(c.source, 'fallback');
    const empty = fallbackCopy({ angle: 'Crunch', title: '', message: '', insight: '', evidence: '', basis: 'web', audience: '', funnel: '', proof: '', why_it_wins: '', test: '' });
    assert.equal(empty.headline, 'Crunch');
  });

  await run('stuck round: resume after 6 minutes of no progress, not while drawing is fresh', () => {
    const now = Date.parse('2026-11-09T21:37:00Z');
    const stale = new Date(now - ROUND_STALE_MS - 1000).toISOString();
    const fresh = new Date(now - 30_000).toISOString();
    assert.equal(roundNeedsResume({ status: 'drawing', updatedAt: stale }, [
      { status: 'drawing', updatedAt: stale },
      { status: 'pending', updatedAt: stale },
    ], now), true);
    assert.equal(roundNeedsResume({ status: 'drawing', updatedAt: fresh }, [
      { status: 'drawing', updatedAt: fresh },
      { status: 'pending', updatedAt: stale },
    ], now), false);
    assert.equal(roundNeedsResume({ status: 'ready', updatedAt: stale }, [
      { status: 'ready', updatedAt: stale },
    ], now), false);
    assert.equal(roundNeedsResume({ status: 'researching', updatedAt: stale }, [], now), true);
  });

  await run('withTimeout: rejects hung work so one poster cannot block the round', async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 20, 'This poster took too long to draw.'),
      /took too long/,
    );
    assert.equal(await withTimeout(Promise.resolve(7), 50, 'nope'), 7);
  });

  if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log('\nAll Ad Studio tests passed');
})();
