/**
 * Run: npx tsx lib/audit/sample-ad-prompt.test.ts
 */
import assert from 'node:assert/strict';
import { buildSampleAdPrompt } from './sample-ad-prompt';
import type { AuditBrand, ContentIdea } from './types';

const idea = {
  title: 'Proof on oily skin',
  hook: 'Oily skin? "Never" greasy.',
  brief: '',
  format: 'static_post',
  audience: '',
  rationale: '',
  cta: 'Shop now',
  evidenceIds: [],
  studio: 'poster',
} as unknown as ContentIdea;

const brand = {
  name: 'Dewdrop Skin',
  interpretation: { products: ['Gel moisturiser'], positioning: 'For humid summers', tone: 'friendly' },
} as unknown as AuditBrand;

const p = buildSampleAdPrompt(brand, 'dewdropskin.in', idea);
assert.match(p, /Dewdrop Skin/);
assert.match(p, /Gel moisturiser/);
assert.match(p, /Oily skin\? Never greasy\./, 'quotes are stripped from the headline');
assert.match(p, /Shop now/);
assert.match(p, /no third-party logos/);

const bare = buildSampleAdPrompt(null, 'example.com', idea);
assert.match(bare, /"example\.com"/);
assert.match(bare, /the product/);

console.log('sample-ad-prompt: all assertions passed');
