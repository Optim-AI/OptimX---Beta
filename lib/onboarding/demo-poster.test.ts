/**
 * Onboarding demo unit tests (no DB / no provider).
 * Run: npx tsx lib/onboarding/demo-poster.test.ts
 */

import assert from 'node:assert/strict';
import {
  ONBOARDING_DEMO_CREDITS,
  ONBOARDING_DEMO_MIN_CREATIVES,
  ONBOARDING_DEMO_VARIATION_COUNT,
  buildOnboardingArtDirectionBlock,
  buildOnboardingDemoBrief,
  collectProductImageUrls,
  hasSufficientDemoContext,
  withOnboardingArtDirection,
} from './demo-poster';
import { selectDemoDirections } from './demo-directions';
import { buildBrandInsightCards } from './brand-insights';
import {
  getOnboardingDemoCreatives,
  isOnboardingDemoComplete,
  onboardingDemoLockKey,
  parseTryOnboarding,
} from './try-onboarding';
import type { BrandSnapshot } from '@/app/web/src/components/creative-studio/types';

async function main() {
  console.log('=== onboarding demo-poster tests (Phase 12) ===');

  assert.equal(ONBOARDING_DEMO_VARIATION_COUNT, 4);
  assert.equal(ONBOARDING_DEMO_MIN_CREATIVES, 2);

  // Credits stub never touches CreditsDAO
  assert.equal(await ONBOARDING_DEMO_CREDITS.getBalance('anyone'), 1);
  assert.equal(await ONBOARDING_DEMO_CREDITS.deduct('anyone', 99), true);

  // Product image collection + dedupe
  {
    const brand: BrandSnapshot = {
      name: 'Acme',
      description: '',
      audience: '',
      offering: 'Widgets',
      tone: 'bold',
      productImages: ['https://cdn.example.com/a.png', 'https://cdn.example.com/a.png'],
      logo: 'https://cdn.example.com/logo.png',
    };
    const urls = collectProductImageUrls(brand);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], 'https://cdn.example.com/a.png');
  }

  // Context validation
  {
    const missing = hasSufficientDemoContext({
      brandName: '',
      brand: null,
      onboarding: null,
    });
    assert.equal(missing.ok, false);

    const noImage = hasSufficientDemoContext({
      brandName: 'Acme',
      brand: {
        name: 'Acme',
        description: '',
        audience: '',
        offering: '',
        tone: 'professional',
      },
      onboarding: { status: 'brand_analyzed', brandName: 'Acme', source: 'website' },
    });
    assert.equal(noImage.ok, false);

    const ok = hasSufficientDemoContext({
      brandName: 'Acme',
      brand: {
        name: 'Acme',
        description: '',
        audience: '',
        offering: 'Soap',
        tone: 'professional',
        productImages: ['https://cdn.example.com/p.png'],
      },
      onboarding: {
        status: 'demo_ready',
        brandName: 'Acme',
        source: 'website',
        websiteUrl: 'https://acme.test',
      },
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.images.length, 1);
  }

  // Direction selection — distinct, includes product hero, correct count
  {
    const brand: BrandSnapshot = {
      name: 'Yoga Bar',
      description: 'Nutrition bars',
      audience: 'Health-conscious adults',
      offering: 'nutrition bars',
      tone: 'friendly',
      productCategory: 'Nutrition Bars',
      brand_aesthetic: ['minimalist', 'modern', 'natural'],
      brand_tone: ['warm', 'honest'],
      coreValueProp: 'Naturally nutritious',
      productImages: ['https://cdn.example.com/bar.png'],
    };
    const dirs = selectDemoDirections(brand);
    assert.equal(dirs.length, ONBOARDING_DEMO_VARIATION_COUNT);
    assert.equal(dirs[0].id, 'product_hero');
    const ids = new Set(dirs.map((d) => d.id));
    assert.equal(ids.size, dirs.length, 'directions must be unique');
  }

  // Brief builder with direction — product prominence + no filler CTA guidance
  {
    const brand: BrandSnapshot = {
      name: 'Plum',
      description: 'Clean beauty',
      audience: 'Gen Z',
      offering: 'Face wash',
      tone: 'friendly',
      primaryColors: ['#7C3AED'],
      productCategory: 'Skincare',
      coreValueProp: 'Gentle care',
      productImages: ['https://cdn.example.com/plum.png'],
      brand_aesthetic: ['minimal'],
    };
    const dirs = selectDemoDirections(brand, 1);
    const brief = buildOnboardingDemoBrief({
      brand,
      brandName: 'Plum',
      productImageUrls: ['https://cdn.example.com/plum.png'],
      direction: dirs[0],
      selectedProduct: {
        product_name: 'Glow Face Wash',
        price: null,
        description: 'Gentle daily cleanser',
        key_benefits: ['Hydrating'],
        product_images: ['https://cdn.example.com/plum.png'],
        target_audience: 'Gen Z',
        emotional_angles: [],
        use_cases: [],
        short_benefit: 'Gentle care',
        category: 'skincare',
      },
    });
    assert.equal(brief.variantCount, 1);
    assert.equal(brief.aspectRatio, '4:5');
    assert.equal(brief.product?.name, 'Glow Face Wash');
    assert.equal(brief.product?.source, 'catalog');
    assert.equal(brief.brand.primaryColors[0], '#7C3AED');
    assert.equal(brief.productReferences.length, 1);
    assert.ok(brief.userInstruction.includes('Plum'));
    assert.ok(brief.userInstruction.includes('Discover Your Favorite'));
    assert.ok(brief.userInstruction.includes('Campaign angle:'));
    assert.ok(brief.userInstruction.toLowerCase().includes('skincare'));
    // Strategy-safe: no visual-leak tokens in the marketing brief
    assert.equal(
      /\b(lighting|composition|typography|background|palette)\b/i.test(
        brief.userInstruction
      ),
      false
    );
    assert.equal(brief.userInstruction.includes('PRODUCT WORLD'), false);
    assert.equal(brief.visualDirection, dirs[0].visualDirection);

    const art = buildOnboardingArtDirectionBlock({
      brand,
      direction: dirs[0],
      selectedProduct: {
        product_name: 'Glow Face Wash',
        price: null,
        description: 'Gentle daily cleanser',
        key_benefits: ['Hydrating'],
        product_images: ['https://cdn.example.com/plum.png'],
        target_audience: 'Gen Z',
        emotional_angles: [],
        use_cases: [],
        short_benefit: 'Gentle care',
        category: 'skincare',
      },
    });
    assert.ok(art.includes('PRODUCT WORLD'));
    assert.ok(art.includes('45–65%'));
    assert.ok(art.includes('CREATIVE DIRECTION'));
    assert.ok(art.toLowerCase().includes('skincare'));

    const withArt = withOnboardingArtDirection(brief, art);
    assert.equal(withArt.id, brief.id);
    assert.ok(withArt.userInstruction.includes('=== ART DIRECTION'));
    assert.ok(withArt.userInstruction.includes('PRODUCT WORLD'));
  }

  assert.equal(
    onboardingDemoLockKey('user_abc'),
    'onboarding-poster-demo:user_abc'
  );

  // Legacy single poster still parses + completes
  {
    const parsed = parseTryOnboarding({
      onboarding: {
        status: 'demo_complete',
        brandName: 'Acme',
        demo: {
          status: 'completed',
          type: 'poster',
          imageUrl: 'https://cdn.example.com/out.png',
          generationId: 'gen_1',
          sessionId: 'sess_1',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    assert.equal(parsed?.demo?.status, 'completed');
    assert.equal(isOnboardingDemoComplete(parsed?.demo), true);
    assert.equal(getOnboardingDemoCreatives(parsed?.demo).length, 1);
  }

  // Multi-creative set persistence
  {
    const parsed = parseTryOnboarding({
      onboarding: {
        status: 'demo_complete',
        brandName: 'Yoga Bar',
        demo: {
          status: 'completed',
          type: 'poster_set',
          imageUrl: 'https://cdn.example.com/1.png',
          creatives: [
            {
              imageUrl: 'https://cdn.example.com/1.png',
              direction: 'product_hero',
              directionLabel: 'Product Hero',
              shortDescription: 'Clean product-led launch creative',
            },
            {
              imageUrl: 'https://cdn.example.com/2.png',
              direction: 'lifestyle',
              directionLabel: 'Lifestyle',
              shortDescription: 'Brand-in-context creative',
            },
            {
              imageUrl: 'https://cdn.example.com/3.png',
              direction: 'promotional',
              directionLabel: 'Promotional',
            },
            {
              imageUrl: 'https://cdn.example.com/4.png',
              direction: 'editorial',
              directionLabel: 'Editorial',
            },
          ],
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    assert.equal(parsed?.demo?.type, 'poster_set');
    assert.equal(isOnboardingDemoComplete(parsed?.demo), true);
    assert.equal(getOnboardingDemoCreatives(parsed?.demo).length, 4);
  }

  // Partial failure: incomplete without enough creatives still not "complete" if status failed
  {
    assert.equal(
      isOnboardingDemoComplete({
        status: 'failed',
        type: 'poster_set',
        creatives: [
          {
            imageUrl: 'https://cdn.example.com/1.png',
            direction: 'product_hero',
            directionLabel: 'Product Hero',
          },
        ],
      }),
      false
    );
  }

  // Brand insights — only real fields
  {
    const cards = buildBrandInsightCards({
      name: 'Yoga Bar',
      description: '',
      audience: 'Athletes',
      offering: 'nutrition bars',
      tone: 'warm',
      productCategory: 'Nutrition Bars',
      brand_aesthetic: ['minimalist', 'modern', 'natural'],
      brand_tone: ['honest'],
      coreValueProp: 'Naturally nutritious',
    });
    assert.ok(cards.some((c) => c.id === 'brand' && c.value === 'Yoga Bar'));
    assert.ok(cards.some((c) => c.id === 'product'));
    assert.ok(cards.some((c) => c.id === 'visual'));
    assert.ok(cards.some((c) => c.id === 'tone'));
    assert.ok(!cards.some((c) => c.value.toLowerCase().includes('fabricated')));
  }

  // Scene guidance differs by category
  {
    const { inferProductSceneProfile } = await import('./product-scene-guidance');
    const food = inferProductSceneProfile({
      product_name: 'Protein Bar',
      category: 'nutrition bars',
      description: 'snack bar',
      price: null,
      key_benefits: [],
      product_images: [],
      target_audience: '',
      emotional_angles: [],
      use_cases: [],
      short_benefit: '',
    });
    const skin = inferProductSceneProfile({
      product_name: 'Face Serum',
      category: 'skincare',
      description: 'serum',
      price: null,
      key_benefits: [],
      product_images: [],
      target_audience: '',
      emotional_angles: [],
      use_cases: [],
      short_benefit: '',
    });
    assert.ok(food.categoryLabel.includes('food'));
    assert.ok(skin.categoryLabel.includes('skincare'));
    assert.notEqual(food.environment, skin.environment);
  }

  // Concurrent claim simulation
  {
    const store = new Map<string, { status: string; userId: string }>();
    const lockKey = onboardingDemoLockKey('user_race');

    async function tryClaim(params: {
      lockKey: string;
      userId: string;
      force?: boolean;
    }) {
      const existing = store.get(params.lockKey);
      if (existing) {
        if (existing.status === 'in_progress') {
          return { claimed: false as const, reason: 'in_progress' as const };
        }
        if (existing.status === 'completed' && !params.force) {
          return { claimed: false as const, reason: 'completed' as const };
        }
      }
      store.set(params.lockKey, { status: 'in_progress', userId: params.userId });
      return { claimed: true as const };
    }

    const a = await tryClaim({ lockKey, userId: 'user_race' });
    const b = await tryClaim({ lockKey, userId: 'user_race' });
    assert.equal(a.claimed, true);
    assert.equal(b.claimed, false);
    assert.equal(b.reason, 'in_progress');

    store.set(lockKey, { status: 'completed', userId: 'user_race' });
    const c = await tryClaim({ lockKey, userId: 'user_race' });
    assert.equal(c.claimed, false);
    assert.equal(c.reason, 'completed');
  }

  console.log('✓ onboarding demo-poster tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
