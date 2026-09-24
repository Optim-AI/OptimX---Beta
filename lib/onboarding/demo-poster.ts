/**
 * Isolated onboarding creative-set demo — reuses poster-generation internals
 * with a server-only no-op credits stub. Never touches CreditsDAO.
 *
 * Phase 12: one demo request → multiple distinct creative directions.
 */

import { db } from '@/database/client';
import { profiles } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { GenerationLocksDAO } from '@/database/models/GenerationLocks.dao';
import type { BrandSnapshot } from '@/app/web/src/components/creative-studio/types';
import {
  createPosterGenerationSessionService,
  generatePostersForSession,
  runCreativeConceptsForSession,
  runMarketingStrategyForSession,
  selectConceptForSession,
  type CreativeBrief,
  type PosterVisualDirection,
} from '@/lib/creative-studio/poster-generation';
import {
  formatSceneGuidanceForBrief,
  inferProductSceneProfile,
} from './product-scene-guidance';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import {
  ONBOARDING_DEMO_MIN_CREATIVES,
  ONBOARDING_DEMO_VARIATION_COUNT,
  selectDemoDirections,
  type DemoCreativeDirection,
} from './demo-directions';
import {
  isOnboardingDemoComplete,
  onboardingDemoLockKey,
  parseTryOnboarding,
  type OnboardingDemoCreative,
  type OnboardingDemoProgressStage,
  type OnboardingDemoState,
  type TryOnboardingState,
} from './try-onboarding';

export class OnboardingDemoError extends Error {
  constructor(
    public code:
      | 'UNAUTHORIZED'
      | 'INSUFFICIENT_CONTEXT'
      | 'IN_PROGRESS'
      | 'ALREADY_COMPLETED'
      | 'GENERATION_FAILED'
      | 'INTERNAL',
    message: string,
    public httpStatus: number = 400,
    public demo?: OnboardingDemoState
  ) {
    super(message);
    this.name = 'OnboardingDemoError';
  }
}

/** Credits stub: never reads or writes user_credits / credit_history. */
export const ONBOARDING_DEMO_CREDITS = {
  getBalance: async (_userId: string) => 1,
  deduct: async (_userId: string, _amount: number) => true,
} as const;

export { ONBOARDING_DEMO_VARIATION_COUNT, ONBOARDING_DEMO_MIN_CREATIVES };

export function collectProductImageUrls(brand: BrandSnapshot | null): string[] {
  if (!brand) return [];
  const urls: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === 'string' && u.trim().length > 0) urls.push(u.trim());
  };
  if (Array.isArray(brand.productImages)) {
    for (const u of brand.productImages) push(u);
  }
  push(brand.logo);
  push(brand.logoUrl);
  return [...new Set(urls)].slice(0, 4);
}

/** Prefer user-selected catalog product images, then brand snapshot gallery. */
export function resolveDemoProductImages(
  brand: BrandSnapshot | null,
  selectedProduct?: Product | null
): string[] {
  const fromSelected = (selectedProduct?.product_images || []).filter(
    (u) => typeof u === 'string' && u.trim().length > 0
  );
  if (fromSelected.length) return [...new Set(fromSelected)].slice(0, 4);
  return collectProductImageUrls(brand);
}

export function hasSufficientDemoContext(input: {
  brandName?: string | null;
  brand: BrandSnapshot | null;
  onboarding: TryOnboardingState | null;
}): { ok: true; brandName: string; images: string[] } | { ok: false; reason: string } {
  const brandName =
    (input.brandName || input.brand?.name || input.onboarding?.brandName || '').trim();
  if (!brandName) {
    return { ok: false, reason: 'Brand name is required before generating a demo poster.' };
  }

  const images = resolveDemoProductImages(
    input.brand,
    input.onboarding?.selectedProduct
  );
  const hasWebsite =
    Boolean(input.onboarding?.websiteUrl) || Boolean(input.brand?.website_url);
  const hasImageSource = input.onboarding?.source === 'image' || images.length > 0;

  if (!images.length) {
    return {
      ok: false,
      reason:
        'A product or brand image is required for the poster demo. Upload a product image or use a website that includes product imagery.',
    };
  }

  if (!hasWebsite && !hasImageSource && !input.brand) {
    return {
      ok: false,
      reason: 'Complete brand onboarding (website or product image) before the demo.',
    };
  }

  return { ok: true, brandName, images };
}

function mapVisualDirection(brand: BrandSnapshot): PosterVisualDirection {
  const tags = (brand.brand_aesthetic || []).map((t) => t.toLowerCase());
  const personality = (brand.personality || brand.brandVoice || '').toLowerCase();
  const hay = `${tags.join(' ')} ${personality}`;
  if (/minimal|clean|simple/.test(hay)) return 'minimal';
  if (/premium|luxury|elegant/.test(hay)) return 'premium';
  if (/bold|loud|strong/.test(hay)) return 'bold';
  if (/playful|fun|friendly/.test(hay)) return 'playful';
  if (/professional|corporate/.test(hay)) return 'professional';
  return 'commercial';
}

/**
 * Art-direction block for Creative Director / image generation only.
 * Must NOT be present during Marketing Strategist (triggers visual-leak QC).
 */
export function buildOnboardingArtDirectionBlock(params: {
  brand: BrandSnapshot;
  direction?: DemoCreativeDirection;
  selectedProduct?: Product | null;
}): string {
  const { brand, direction, selectedProduct } = params;
  const sceneProfile = inferProductSceneProfile(selectedProduct, [
    brand.productCategory || '',
    brand.offering || '',
    brand.industry || '',
    brand.description || '',
  ]);
  const sceneBlock = formatSceneGuidanceForBrief(sceneProfile);

  const directionBlock = direction
    ? [
        `CREATIVE DIRECTION: ${direction.label} (${direction.id})`,
        `PURPOSE: ${direction.purpose}`,
        `COMPOSITION: ${direction.composition}`,
        `PRODUCT PRESENTATION: ${direction.productPresentation}`,
        `MESSAGING: ${direction.messaging}`,
        `TYPOGRAPHY: ${direction.typography}`,
        `COLOR: ${direction.colorDirection}`,
        `COPY RULES: ${direction.copyRules}`,
      ].join('\n')
    : '';

  return [
    '=== ART DIRECTION (for Creative Director / image generation only) ===',
    'Product should be a clear visual hero (typically ~45–65% of frame for product-led directions). Avoid tiny product placement and excessive empty space.',
    sceneBlock,
    directionBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Append art direction while preserving brief.id so strategy.briefId still matches. */
export function withOnboardingArtDirection(
  brief: CreativeBrief,
  artDirection: string
): CreativeBrief {
  if (brief.userInstruction.includes('=== ART DIRECTION')) {
    return brief;
  }
  return {
    ...brief,
    userInstruction: `${brief.userInstruction}\n\n${artDirection}`,
  };
}

/**
 * Strategy-safe brief: marketing intent only.
 * Visual/scene language is appended after strategy via withOnboardingArtDirection.
 */
export function buildOnboardingDemoBrief(params: {
  brand: BrandSnapshot;
  brandName: string;
  productImageUrls: string[];
  direction?: DemoCreativeDirection;
  selectedProduct?: Product | null;
}): CreativeBrief {
  const { brand, brandName, productImageUrls, direction, selectedProduct } = params;
  const productName =
    selectedProduct?.product_name ||
    brand.productCategory ||
    (typeof brand.offering === 'string'
      ? brand.offering.split(',')[0]?.trim()
      : '') ||
    brandName;

  const images = productImageUrls.map((url) => ({ url }));
  const logoUrl = brand.logo || brand.logoUrl || null;
  const visualDirection = direction?.visualDirection || mapVisualDirection(brand);

  const productFacts = [
    selectedProduct?.short_benefit && `Benefit: ${selectedProduct.short_benefit}`,
    selectedProduct?.description && `Description: ${selectedProduct.description.slice(0, 280)}`,
    selectedProduct?.key_benefits?.length
      ? `Key benefits: ${selectedProduct.key_benefits.slice(0, 4).join('; ')}`
      : null,
    selectedProduct?.category && `Category: ${selectedProduct.category}`,
  ]
    .filter(Boolean)
    .join('\n');

  const directionIntent = direction
    ? [
        `Campaign angle: ${direction.label}.`,
        `Strategic purpose: ${direction.purpose}`,
        `Messaging guidance: ${direction.messaging}`,
        `Copy rules: ${direction.copyRules}`,
      ].join('\n')
    : '';

  const userInstruction = [
    `Create a polished marketing poster for ${brandName}.`,
    `Hero product: ${productName}${selectedProduct?.category ? ` (${selectedProduct.category})` : ''}.`,
    `Feature the real product from the provided product reference prominently — packaging must match the reference exactly.`,
    `Stay on-brand. Campaign-ready. Do not invent product claims, stats, discounts, or fake CTAs.`,
    `Prefer a short headline, optional one support line from brand/product context, and brand/product name. Skip generic filler like "Discover Your Favorite".`,
    productFacts,
    directionIntent,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: `brief_onboarding_${direction?.id || 'base'}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: brand,
      name: brand.name || brandName,
      logo: logoUrl ? { url: logoUrl } : null,
      primaryColors: brand.primaryColors || [],
      fonts: brand.primaryFont || brand.fontStyles || null,
      tone: Array.isArray(brand.brand_tone)
        ? brand.brand_tone.join(', ')
        : brand.tone || null,
      voice: brand.brandVoice || null,
      industry: brand.industry || null,
      audience: brand.audience || selectedProduct?.target_audience || null,
      tagline: brand.tagline || null,
      coreValueProp:
        selectedProduct?.short_benefit || brand.coreValueProp || null,
      aestheticTags: brand.brand_aesthetic || [],
      values: brand.brand_values || [],
      guidelinesApplied: true,
    },
    product: {
      source: selectedProduct ? 'catalog' : 'manual',
      name: productName,
      description:
        selectedProduct?.description ||
        brand.description ||
        brand.business_overview ||
        null,
      shortBenefit:
        selectedProduct?.short_benefit || brand.coreValueProp || null,
      category:
        selectedProduct?.category || brand.productCategory || null,
      benefits: selectedProduct?.key_benefits || [],
      factualClaims: [],
      features: [],
      emotionalAngles: selectedProduct?.emotional_angles || [],
      useCases: selectedProduct?.use_cases || [],
      images,
      brandName: brand.name || brandName,
      targetAudience:
        selectedProduct?.target_audience || brand.audience || null,
      catalogProduct: selectedProduct || undefined,
    },
    userInstruction,
    visualDirection,
    aspectRatio: '4:5',
    variantCount: 1,
    constraints: [
      'Do not invent factual product claims not present in the brief.',
      'Use the provided product reference image as the exact product SKU.',
      'Avoid generic CTA filler copy.',
      'Keep messaging grounded in the product category and brand context.',
    ],
    productReferences: images.slice(0, 4).map((img, i) => ({
      id: `onboarding_product_${i}`,
      role: 'product_packshot' as const,
      image: img,
    })),
    designReferences: [],
    supportingReferences: [],
  };
}

async function loadProfileContext(userId: string): Promise<{
  brand: BrandSnapshot | null;
  onboarding: TryOnboardingState | null;
  preferences: Record<string, unknown>;
}> {
  const [row] = await db
    .select({
      brandSnapshot: profiles.brandSnapshot,
      uiPreferences: profiles.uiPreferences,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const preferences = (row?.uiPreferences as Record<string, unknown>) || {};
  const onboarding = parseTryOnboarding(preferences);
  const brand = (row?.brandSnapshot as BrandSnapshot | null) || null;
  return { brand, onboarding, preferences };
}

async function saveOnboardingState(
  userId: string,
  preferences: Record<string, unknown>,
  onboarding: TryOnboardingState
): Promise<void> {
  const merged = {
    ...preferences,
    onboarding: {
      ...onboarding,
      updatedAt: new Date().toISOString(),
    },
  };
  await db
    .update(profiles)
    .set({
      uiPreferences: merged,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profiles.id, userId));
}

function demoFromLockSummary(
  summary: Record<string, unknown>,
  fallback?: OnboardingDemoState | null
): OnboardingDemoState {
  const creativesRaw = Array.isArray(summary.creatives) ? summary.creatives : [];
  const creatives = creativesRaw.filter(
    (c): c is OnboardingDemoCreative =>
      Boolean(c && typeof c === 'object' && typeof (c as any).imageUrl === 'string')
  ) as OnboardingDemoCreative[];

  return {
    status: 'completed',
    type: creatives.length > 1 ? 'poster_set' : 'poster',
    imageUrl:
      (typeof summary.imageUrl === 'string' && summary.imageUrl) ||
      creatives[0]?.imageUrl ||
      fallback?.imageUrl ||
      null,
    generationId:
      (typeof summary.generationId === 'string' && summary.generationId) ||
      creatives[0]?.generationId ||
      fallback?.generationId ||
      null,
    sessionId:
      (typeof summary.sessionId === 'string' && summary.sessionId) ||
      creatives[0]?.sessionId ||
      fallback?.sessionId ||
      null,
    completedAt:
      (typeof summary.completedAt === 'string' && summary.completedAt) ||
      fallback?.completedAt ||
      null,
    errorMessage: null,
    creatives: creatives.length > 0 ? creatives : fallback?.creatives,
    progressStage: 'complete',
  };
}

export type OnboardingDemoResult = {
  success: true;
  reused: boolean;
  demo: OnboardingDemoState;
  brandName: string;
};

export type RunOnboardingPosterDemoDeps = {
  generate?: typeof generatePostersForSession;
  runStrategy?: typeof runMarketingStrategyForSession;
  runConcepts?: typeof runCreativeConceptsForSession;
  selectConcept?: typeof selectConceptForSession;
  createSessionService?: typeof createPosterGenerationSessionService;
  locks?: {
    tryClaim: typeof GenerationLocksDAO.tryClaim;
    markCompleted: typeof GenerationLocksDAO.markCompleted;
    markFailed: typeof GenerationLocksDAO.markFailed;
    getByKey: typeof GenerationLocksDAO.getByKey;
  };
  variationCount?: number;
};

/**
 * One successful onboarding creative set per user.
 * Billing isolation: credits DI stub — CreditsDAO is never called.
 */
export async function runOnboardingPosterDemo(
  userId: string,
  deps: RunOnboardingPosterDemoDeps = {}
): Promise<OnboardingDemoResult> {
  if (!userId) {
    throw new OnboardingDemoError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const locks = deps.locks ?? {
    tryClaim: GenerationLocksDAO.tryClaim.bind(GenerationLocksDAO),
    markCompleted: GenerationLocksDAO.markCompleted.bind(GenerationLocksDAO),
    markFailed: GenerationLocksDAO.markFailed.bind(GenerationLocksDAO),
    getByKey: GenerationLocksDAO.getByKey.bind(GenerationLocksDAO),
  };
  const generate = deps.generate ?? generatePostersForSession;
  const runStrategy = deps.runStrategy ?? runMarketingStrategyForSession;
  const runConcepts = deps.runConcepts ?? runCreativeConceptsForSession;
  const selectConcept = deps.selectConcept ?? selectConceptForSession;
  const createSessionService =
    deps.createSessionService ?? createPosterGenerationSessionService;
  const variationCount = deps.variationCount ?? ONBOARDING_DEMO_VARIATION_COUNT;

  const { brand, onboarding, preferences } = await loadProfileContext(userId);

  if (isOnboardingDemoComplete(onboarding?.demo)) {
    return {
      success: true,
      reused: true,
      demo: onboarding!.demo!,
      brandName: onboarding?.brandName || brand?.name || 'your brand',
    };
  }

  const ctx = hasSufficientDemoContext({
    brandName: onboarding?.brandName,
    brand,
    onboarding,
  });
  if (!ctx.ok) {
    throw new OnboardingDemoError('INSUFFICIENT_CONTEXT', ctx.reason, 400);
  }
  if (!brand) {
    throw new OnboardingDemoError(
      'INSUFFICIENT_CONTEXT',
      'Brand profile is missing. Complete brand analysis first.',
      400
    );
  }

  const lockKey = onboardingDemoLockKey(userId);
  const claim = await locks.tryClaim({ lockKey, userId, force: false });

  if (!claim.claimed) {
    if (claim.reason === 'completed') {
      const summary = (claim.lock.resultSummary || {}) as Record<string, unknown>;
      const demo = demoFromLockSummary(summary, onboarding?.demo);
      if (isOnboardingDemoComplete(demo)) {
        return {
          success: true,
          reused: true,
          demo,
          brandName: ctx.brandName,
        };
      }
      throw new OnboardingDemoError(
        'ALREADY_COMPLETED',
        'Your onboarding creative demo was already completed.',
        409,
        demo
      );
    }
    if (claim.reason === 'in_progress') {
      throw new OnboardingDemoError(
        'IN_PROGRESS',
        'Your demo creatives are already being created. Please wait.',
        409,
        onboarding?.demo || {
          status: 'generating',
          type: 'poster_set',
          progressStage: 'building',
        }
      );
    }
    throw new OnboardingDemoError('INTERNAL', 'Could not claim demo lock', 500);
  }

  const directions = selectDemoDirections(brand, variationCount);

  let workingDemo: OnboardingDemoState = {
    status: 'generating',
    type: 'poster_set',
    imageUrl: null,
    generationId: null,
    sessionId: null,
    completedAt: null,
    errorMessage: null,
    creatives: [],
    progressStage: 'planning',
  };

  const nextOnboarding: TryOnboardingState = {
    ...(onboarding || { status: 'demo_pending' }),
    status: 'demo_pending',
    brandName: ctx.brandName,
    demo: workingDemo,
  };
  await saveOnboardingState(userId, preferences, nextOnboarding);

  const persistProgress = async (
    stage: OnboardingDemoProgressStage,
    creatives: OnboardingDemoCreative[]
  ) => {
    workingDemo = {
      ...workingDemo,
      progressStage: stage,
      creatives,
      imageUrl: creatives[0]?.imageUrl || null,
      generationId: creatives[0]?.generationId || null,
      sessionId: creatives[0]?.sessionId || workingDemo.sessionId,
    };
    const { preferences: fresh } = await loadProfileContext(userId);
    await saveOnboardingState(userId, fresh, {
      ...nextOnboarding,
      demo: workingDemo,
    });
  };

  try {
    const sessionService = createSessionService();
    const session = await sessionService.createSession({ userId });
    workingDemo.sessionId = session.id;

    const creatives: OnboardingDemoCreative[] = [];

    // Each direction: strategy-safe brief → strategy → art-direction brief (same id)
    // → concepts → generate. One direction failure must not abort the whole set.
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i];
      const stage: OnboardingDemoProgressStage =
        i === 0
          ? 'building'
          : i < directions.length - 1
            ? 'exploring'
            : 'preparing';

      try {
        const brief = buildOnboardingDemoBrief({
          brand,
          brandName: ctx.brandName,
          productImageUrls: ctx.images,
          direction,
          selectedProduct: onboarding?.selectedProduct || null,
        });
        await sessionService.updateBrief(session.id, userId, brief);

        await runStrategy({ sessionId: session.id, userId, sessionService });
        if (i === 0) {
          await persistProgress('direction_ready', creatives);
        }

        // Art direction after strategy so visual-leak QC never sees scene language.
        const artBrief = withOnboardingArtDirection(
          brief,
          buildOnboardingArtDirectionBlock({
            brand,
            direction,
            selectedProduct: onboarding?.selectedProduct || null,
          })
        );
        await sessionService.updateBrief(session.id, userId, artBrief);

        const conceptsResult = await runConcepts({
          sessionId: session.id,
          userId,
          conceptCount: 1,
          sessionService,
        });
        const conceptId = conceptsResult.concepts?.[0]?.id;
        if (!conceptId) {
          console.warn(
            `[onboarding-demo] skipping direction ${direction.id}: no concept`
          );
          await persistProgress(stage, creatives);
          continue;
        }

        await selectConcept({
          sessionId: session.id,
          userId,
          conceptIds: conceptId,
          sessionService,
        });

        if (i === 0) {
          await persistProgress('building', creatives);
        }

        const genResult = await generate({
          sessionId: session.id,
          userId,
          conceptId,
          variantCount: 1,
          sessionService,
          credits: ONBOARDING_DEMO_CREDITS,
        });

        const successOutcome = genResult.outcomes.find(
          (o) => o.success && o.asset?.imageUrl
        );
        if (!successOutcome?.asset?.imageUrl) {
          console.warn(
            `[onboarding-demo] direction ${direction.id} failed:`,
            genResult.outcomes[0]?.asset?.errorMessage
          );
          await persistProgress(stage, creatives);
          continue;
        }

        const completedAt = new Date().toISOString();
        creatives.push({
          imageUrl: successOutcome.asset.imageUrl,
          generationId:
            successOutcome.asset.generationId || successOutcome.generationId,
          sessionId: session.id,
          direction: direction.id,
          directionLabel: direction.label,
          theme: direction.visualDirection,
          shortDescription: direction.shortDescription,
          completedAt,
        });
        await persistProgress(stage, creatives);
      } catch (dirErr: any) {
        console.warn(
          `[onboarding-demo] direction ${direction.id} error:`,
          dirErr?.message || dirErr
        );
        await persistProgress(stage, creatives);
      }
    }

    if (creatives.length < ONBOARDING_DEMO_MIN_CREATIVES) {
      throw new Error(
        creatives.length === 0
          ? 'Creative generation failed without a result image.'
          : `Only ${creatives.length} creative(s) succeeded — need at least ${ONBOARDING_DEMO_MIN_CREATIVES}.`
      );
    }

    const completedAt = new Date().toISOString();
    const completedDemo: OnboardingDemoState = {
      status: 'completed',
      type: 'poster_set',
      imageUrl: creatives[0].imageUrl,
      generationId: creatives[0].generationId,
      sessionId: session.id,
      completedAt,
      errorMessage: null,
      creatives,
      progressStage: 'complete',
    };

    await locks.markCompleted(lockKey, {
      imageUrl: completedDemo.imageUrl,
      generationId: completedDemo.generationId,
      sessionId: session.id,
      completedAt,
      creditsCharged: 0,
      creatives,
      variationCount: creatives.length,
    });

    const { preferences: freshPrefs } = await loadProfileContext(userId);
    await saveOnboardingState(userId, freshPrefs, {
      ...nextOnboarding,
      status: 'demo_complete',
      demo: completedDemo,
    });

    return {
      success: true,
      reused: false,
      demo: completedDemo,
      brandName: ctx.brandName,
    };
  } catch (err: any) {
    const message = err?.message || 'Demo generation failed';
    const partial = workingDemo.creatives || [];
    const failedDemo: OnboardingDemoState = {
      status: 'failed',
      type: 'poster_set',
      imageUrl: partial[0]?.imageUrl || null,
      generationId: partial[0]?.generationId || null,
      sessionId: workingDemo.sessionId,
      completedAt: null,
      errorMessage: message,
      creatives: partial.length > 0 ? partial : undefined,
      progressStage: null,
    };
    try {
      await locks.markFailed(lockKey, { error: message });
      const { preferences: freshPrefs } = await loadProfileContext(userId);
      await saveOnboardingState(userId, freshPrefs, {
        ...nextOnboarding,
        status: 'demo_ready',
        demo: failedDemo,
      });
    } catch (persistErr) {
      console.error('[onboarding-demo] failed to persist failure state', persistErr);
    }
    throw new OnboardingDemoError('GENERATION_FAILED', message, 500, failedDemo);
  }
}
