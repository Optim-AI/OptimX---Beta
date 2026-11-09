/**
 * Instagram watch: input cleaning, stats arithmetic, the engagement-rate floor, and the style-read number guard.
 * Run: npx tsx lib/meta-ig/meta-ig.test.ts
 */
import assert from 'node:assert/strict';
import { cleanHashtag, cleanUsername, toPost } from './api';
import { accountStats, formatMix, hashtagStats, postsPerWeek } from './stats';
import { readStyle } from './style';
import type { StructuredClient } from '@/lib/ai/structured';

let failures = 0;
async function run(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}
const post = (o: Partial<Parameters<typeof toPost>[0]> & { id: string }) => toPost({ media_type: 'IMAGE', ...o });

(async () => {
  await run('usernames and hashtags are cleaned; emoji and spaces refused', () => {
    assert.equal(cleanUsername('@Zomato'), 'zomato');
    assert.equal(cleanUsername('https://www.instagram.com/haldirams_nagpur/?hl=en'), 'haldirams_nagpur');
    assert.equal(cleanUsername('two words'), null);
    assert.equal(cleanHashtag('#Pickles'), 'pickles');
    assert.equal(cleanHashtag('#🔥food'), null);
    assert.equal(cleanHashtag('#chennai food'), null);
  });

  await run('videos use their thumbnail; albums have no image', () => {
    assert.equal(toPost({ id: '1', media_type: 'VIDEO', media_url: 'v.mp4', thumbnail_url: 't.jpg' }).imageUrl, 't.jpg');
    assert.equal(toPost({ id: '2', media_type: 'CAROUSEL_ALBUM' }).imageUrl, null);
  });

  await run('format mix and posts per week are plain arithmetic', () => {
    const ps = [
      post({ id: 'a', media_type: 'VIDEO', like_count: 100, comments_count: 10, timestamp: '2026-11-01T10:00:00Z' }),
      post({ id: 'b', media_type: 'VIDEO', like_count: 50, comments_count: 0, timestamp: '2026-11-08T10:00:00Z' }),
      post({ id: 'c', like_count: 10, comments_count: 2, timestamp: '2026-11-15T10:00:00Z' }),
      post({ id: 'd', media_type: 'CAROUSEL_ALBUM', like_count: 30, comments_count: 3, timestamp: '2026-11-15T12:00:00Z' }),
    ];
    assert.deepEqual(formatMix(ps).map((f) => [f.format, f.pct, f.avgEngagement]), [['Reels / video', 50, 80], ['Photo', 25, 12], ['Carousel', 25, 33]]);
    assert.equal(postsPerWeek(ps), 2); // 4 posts over 2 weeks
  });

  await run('engagement rate needs at least 100 followers', () => {
    const base = { username: 'x', name: null, biography: null, profilePictureUrl: null, website: null, totalPosts: 3, posts: [post({ id: 'a', like_count: 1, comments_count: 2 })] };
    assert.equal(accountStats({ ...base, followers: 1 }).engagementRatePct, null);
    assert.equal(accountStats({ ...base, followers: 300 }).engagementRatePct, 1);
  });

  await run('hashtag: last-24h count is marked when Meta’s page of 50 is full', () => {
    const recent = Array.from({ length: 50 }, (_, i) => post({ id: `r${i}` }));
    assert.equal(hashtagStats('pickles', [], recent).last24hCapped, true);
    assert.equal(hashtagStats('pickles', [], recent.slice(0, 49)).last24hCapped, false);
  });

  await run('style read: lines with invented numbers are dropped; unknown accounts ignored; big counts formatted', async () => {
    const acct = accountStats({ username: 'rival', name: null, biography: null, profilePictureUrl: null, website: null, followers: 5000, totalPosts: 10,
      posts: [post({ id: 'a', like_count: 66693, comments_count: 515, caption: 'pun', timestamp: '2026-11-01T00:00:00Z' })] });
    const client: StructuredClient = { generate: async () => ({ stop: 'ok', text: '', model: 'stub', usage: { input_tokens: 0, output_tokens: 0 }, data: {
      summary: 'Humour wins.',
      competitors: [
        { username: '@rival', style: 'Bold red text.', what_works: ['The pun post got 66693 likes.', 'They grow 40% a month.'], borrow: 'Use puns.' },
        { username: 'someone_else', style: 's', what_works: [], borrow: 'b' },
      ],
      ideas: [{ hook: 'Crunch', show: 'Jar', format: 'reel' }, { hook: '50% off today', show: 'Jar', format: 'post' }],
    } }) as any };
    const r = await readStyle({ brand: { name: 'B', category: null, offering: null, tone: null }, accounts: [acct], deps: { client, loadImage: async () => null } });
    assert.deepEqual(r.output.competitors.map((c) => c.username), ['rival']);
    assert.deepEqual(r.output.competitors[0].what_works, ['The pun post got 66,693 likes.']);
    assert.deepEqual(r.output.ideas.map((i) => i.hook), ['Crunch']);
    assert.equal(r.dropped.length, 2);
  });

  if (failures) { console.error(`\n${failures} failed`); process.exit(1); }
  console.log('\nAll Instagram watch tests passed');
})();
