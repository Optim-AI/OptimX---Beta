/**
 * Test pack pure logic: SKX naming, test plan, test-first choice, ZIP writer.
 * Run: npx tsx lib/test-packs/test-packs.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { slugPart, adNameFor, adNamesForPack, extensionFor } from './naming';
import { buildTestPlan, testFirstAngleIndex } from './plan';
import { buildZip, crc32 } from './zip';
import { SKX_PREFIX } from '@/lib/meta-sync/skx';

let failures = 0;
function run(name: string, fn: () => void) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}`); console.error(e); }
}

run('slugPart: PascalCase, strips symbols and accents, trims on word boundary', () => {
  assert.equal(slugPart('Mango Pickle (500g)'), 'MangoPickle500g');
  assert.equal(slugPart('crème brûlée'), 'CremeBrulee');
  assert.equal(slugPart('Grandma’s heritage recipe, sun-dried', 20), 'GrandmasHeritage');
  assert.equal(slugPart('!!!'), 'Item');
  assert.equal(slugPart('Supercalifragilisticexpialidocious', 10), 'Supercalif');
});

run('adNameFor: SKX-{product}-{angle}-{format} and recognised by sync', () => {
  const n = adNameFor('Mango Pickle', 'Heritage recipe', 'feed');
  assert.equal(n, 'SKX-MangoPickle-HeritageRecipe-Feed');
  assert.equal(adNameFor('Mango Pickle', 'Gifting', 'story'), 'SKX-MangoPickle-Gifting-Story');
  assert.ok(SKX_PREFIX.test(n));
});

run('adNamesForPack: unique names when angles collide', () => {
  const names = adNamesForPack('Mango Pickle', ['Heritage', 'Heritage', 'Gifting'], ['feed', 'story']);
  const flat = names.flat();
  assert.equal(new Set(flat).size, 6);
  assert.equal(names[1][0], 'SKX-MangoPickle-Heritage2-Feed');
});

run('extensionFor', () => {
  assert.equal(extensionFor('image/png'), 'png');
  assert.equal(extensionFor('image/jpeg'), 'jpg');
  assert.equal(extensionFor(null), 'jpg');
});

run('test plan: equal split, min spend from scoring, rounded budgets', () => {
  const p = buildTestPlan({ variants: 6, currency: 'INR', avgCpa: null, adNames: ['SKX-A-B-Feed'] });
  assert.equal(p.minSpendPerVariant, 1500);
  assert.equal(p.dailyBudgetPerVariant, 300);
  assert.equal(p.totalDailyBudget, 1800);
  assert.equal(p.smallerStart.totalDailyBudget, 600);
  assert.match(p.steps[2], /SKX-A-B-Feed/);
  const cheap = buildTestPlan({ variants: 6, currency: 'INR', avgCpa: 220, adNames: [] });
  assert.equal(cheap.minSpendPerVariant, 660);  // 3 × 220
  assert.equal(cheap.dailyBudgetPerVariant, 150); // 132 → rounded up to 150
});

run('test first: past winner, else customer voice, else first', () => {
  assert.equal(testFirstAngleIndex(['competitor', 'past_winner', 'customer_voice']), 1);
  assert.equal(testFirstAngleIndex(['competitor', 'customer_voice', 'competitor']), 1);
  assert.equal(testFirstAngleIndex(['competitor', 'competitor', 'competitor']), 0);
});

run('zip: crc32 known value', () => {
  assert.equal(crc32(Buffer.from('The quick brown fox jumps over the lazy dog')).toString(16), '414fa339');
});

run('zip: valid archive that unzip can test and extract', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skx-zip-'));
  try {
    const img = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);
    const zip = buildZip([
      { name: 'SKX-MangoPickle-Heritage-Feed.png', data: img },
      { name: 'SKX-MangoPickle-Heritage-Feed.txt', data: Buffer.from('Headline: Sun-dried, like grandma’s\n', 'utf8') },
      { name: 'Test plan.txt', data: Buffer.from('Run 7 days') },
    ]);
    const file = join(dir, 'pack.zip');
    writeFileSync(file, zip);
    const out = execFileSync('unzip', ['-t', file]).toString();
    assert.match(out, /No errors detected/);
    execFileSync('unzip', ['-q', file, '-d', join(dir, 'x')]);
    assert.deepEqual(readFileSync(join(dir, 'x', 'SKX-MangoPickle-Heritage-Feed.png')), img);
    assert.match(readFileSync(join(dir, 'x', 'SKX-MangoPickle-Heritage-Feed.txt'), 'utf8'), /grandma’s/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll test pack tests passed');
