/**
 * Trends: block splitting, per-trend sources, category keys, idea checks, structuring (stubbed AI).
 * Run: npx tsx lib/trends/trends.test.ts
 */
import assert from 'node:assert/strict';
import { splitBlocks, attachSources, structureTrends, stageFor } from './find';
import { categoryKey, checkIdeas } from './fit';
import { collectNumbers } from '@/lib/meta-intel/number-guard';
import type { StructuredClient } from '@/lib/ai/structured';

let failures = 0;
async function run(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

const TEXT = `Here you go:
### 1. Diwali gifting boom
Diwali on 20 Oct drives gift hampers; brands post hamper reels on Instagram.
### 2. India vs Australia final
Cricket fans flood X with memes after Sunday's final.
### 3. Untraceable rumour
Nobody can find a source for this one.`;

(async () => {
  await run('splits ### blocks and ignores the intro', () => {
    const b = splitBlocks(TEXT);
    assert.deepEqual(b.map((x) => x.n), [1, 2, 3]);
    assert.ok(b[0].text.startsWith('### 1. Diwali'));
  });

  await run('each trend gets only the sources that back its own sentences', () => {
    const meta = {
      groundingChunks: [{ web: { uri: 'https://r/1', title: 'economictimes.com' } }, { web: { uri: 'https://r/2', title: 'espncricinfo.com' } }, { web: { uri: 'https://r/3', title: 'economictimes.com' } }],
      groundingSupports: [
        { segment: { text: 'Diwali on 20 Oct drives gift hampers' }, groundingChunkIndices: [0, 2] },
        { segment: { text: 'Cricket fans flood X with memes' }, groundingChunkIndices: [1] },
      ],
    };
    const b = attachSources(TEXT, meta);
    assert.deepEqual(b[0].sources.map((s) => s.title), ['economictimes.com']); // same site counted once
    assert.deepEqual(b[1].sources.map((s) => s.url), ['https://r/2']);
    assert.equal(b[2].sources.length, 0);
  });

  await run('structuring drops unsourced and brand-unsafe trends; links come from grounding, not the AI', async () => {
    const blocks = [
      { n: 1, text: '### 1. Diwali gifting', sources: [{ title: 'et.com', url: 'https://r/1' }] },
      { n: 2, text: '### 2. Something sad', sources: [{ title: 'news.com', url: 'https://r/2' }] },
      { n: 3, text: '### 3. No source', sources: [] },
    ];
    let sent = '';
    const client: StructuredClient = { generate: async (req: any) => {
      sent = req.messages[0].parts[0].text;
      return { stop: 'ok', text: '', model: 'stub', usage: { input_tokens: 1, output_tokens: 1 }, data: { trends: [
        { block: 1, title: 'Diwali gifting', what: 'w', why_now: 'y', kind: 'festival_event', stage: 'upcoming', when: '20 Oct', platforms: ['Instagram'], brand_safe: true },
        { block: 2, title: 'Sad news', what: 'w', why_now: 'y', kind: 'news', stage: 'peaking', when: null, platforms: [], brand_safe: false },
        { block: 3, title: 'Invented', what: 'w', why_now: 'y', kind: 'news', stage: 'rising', when: null, platforms: [], brand_safe: true },
      ] } } as any;
    } };
    const out = await structureTrends(blocks, '2026-11-09', client);
    assert.equal(out.trends.length, 1);
    assert.equal(out.trends[0].title, 'Diwali gifting');
    assert.deepEqual(out.trends[0].sources, [{ title: 'et.com', url: 'https://r/1' }]);
    assert.ok(!sent.includes('No source'), 'unsourced blocks are never sent');
  });

  await run('an event whose last day has passed is fading', () => {
    assert.equal(stageFor('peaking', '2026-11-08', '2026-11-09'), 'fading');
    assert.equal(stageFor('upcoming', '2026-11-13', '2026-11-09'), 'upcoming');
    assert.equal(stageFor('rising', null, '2026-11-09'), 'rising');
    assert.equal(stageFor('peaking', 'next week', '2026-11-09'), 'peaking');
  });

  await run('same category, same shared list', () => {
    assert.equal(categoryKey('Pickles & Condiments'), categoryKey('pickles and condiments'));
    assert.equal(categoryKey('  '), 'general');
  });

  await run('ideas with invented numbers are dropped', () => {
    const pool = collectNumbers({ brand: { offering: 'Pickles from ₹249' }, trends: [{ when: '20 Oct' }] });
    const ideas = checkIdeas([
      { format: 'poster', hook: 'Diwali hampers from ₹249', show: 'The jar', script: [] },
      { format: 'poster', hook: 'Flat 50% off this Diwali', show: 'The jar', script: [] },
      { format: 'reel', hook: 'Crunch time', show: 'Opening the jar', script: ['Open', 'Crunch'] },
    ], pool);
    assert.deepEqual(ideas.map((i) => i.hook), ['Diwali hampers from ₹249', 'Crunch time']);
  });

  if (failures) { console.error(`\n${failures} failed`); process.exit(1); }
  console.log('\nAll trends tests passed');
})();
