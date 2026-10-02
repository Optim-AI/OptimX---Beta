import assert from 'node:assert/strict';
import { classifyHeroInput } from './entry-input';

assert.deepEqual(classifyHeroInput(''), { ok: true, entry: { kind: 'empty' } });
assert.deepEqual(classifyHeroInput('  Nike  '), { ok: true, entry: { kind: 'brand', name: 'Nike' } });

const site = classifyHeroInput('example.com');
assert.equal(site.ok && site.entry.kind === 'website' && site.entry.url.startsWith('https://example.com'), true);

const explicit = classifyHeroInput('http://brand.example/path');
assert.equal(explicit.ok && explicit.entry.kind === 'website', true);

const blocked = classifyHeroInput('javascript:alert(1)');
assert.equal(blocked.ok, false);

const ftp = classifyHeroInput('ftp://files.example.com');
assert.equal(ftp.ok, false);

console.log('entry-input checks passed');
