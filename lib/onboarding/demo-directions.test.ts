/**
 * Creative direction selector tests (aligned with current demo-directions API).
 * Run: npx tsx lib/onboarding/demo-directions.test.ts
 */

import assert from 'node:assert/strict';
import type { BrandSnapshot } from '@/app/web/src/components/creative-studio/types';
import {
  ONBOARDING_DEMO_VARIATION_COUNT,
  getDemoDirectionById,
  selectDemoDirections,
} from './demo-directions';

function brand(partial: Partial<BrandSnapshot> & { name: string }): BrandSnapshot {
  return {
    description: '',
    audience: '',
    offering: '',
    tone: 'professional',
    ...partial,
  };
}

async function main() {
  console.log('=== onboarding demo-directions tests ===');

  const food = brand({
    name: 'Yoga Bar',
    offering: 'Nutrition bars',
    productCategory: 'Food',
    brand_aesthetic: ['bold', 'playful'],
  });
  const dirs = selectDemoDirections(food, ONBOARDING_DEMO_VARIATION_COUNT);
  assert.equal(dirs.length, ONBOARDING_DEMO_VARIATION_COUNT);
  assert.equal(new Set(dirs.map((d) => d.id)).size, dirs.length);
  assert.equal(dirs[0].id, 'product_hero');

  const tech = brand({
    name: 'Orbit',
    offering: 'Wireless earbuds',
    productCategory: 'Electronics',
    industry: 'tech',
    brand_aesthetic: ['bold', 'modern'],
    tone: 'energetic',
  });
  const techDirs = selectDemoDirections(tech);
  assert.equal(techDirs.length, ONBOARDING_DEMO_VARIATION_COUNT);
  assert.equal(techDirs[0].id, 'product_hero');

  assert.equal(getDemoDirectionById('product_hero')?.id, 'product_hero');
  assert.equal(getDemoDirectionById('editorial')?.id, 'editorial');
  assert.equal(getDemoDirectionById('missing'), undefined);

  console.log('✓ onboarding demo-directions tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
