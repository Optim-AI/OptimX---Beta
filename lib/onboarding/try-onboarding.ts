/**
 * Try Now onboarding state stored in profiles.ui_preferences.onboarding.
 * No new tables — merges into existing JSONB.
 */

import type { Product } from '@/app/web/src/components/creative-studio/types';

export type TryOnboardingStatus =
  | 'brand_started'
  | 'analyzing'
  | 'brand_analyzed'
  | 'demo_ready'
  | 'demo_pending' // generating / waiting
  | 'demo_complete'
  | 'pricing_seen'
  | 'skipped'
  | 'subscribed'
  | 'complete';
export type TryOnboardingSource = 'website' | 'image';

export type OnboardingDemoStatus =
  | 'not_started'
  | 'generating'
  | 'completed'
  | 'failed';

export type OnboardingDemoProgressStage =
  | 'planning'
  | 'direction_ready'
  | 'building'
  | 'exploring'
  | 'preparing'
  | 'complete';

export type OnboardingDemoCreative = {
  imageUrl: string;
  generationId?: string | null;
  sessionId?: string | null;
  direction: string;
  directionLabel: string;
  theme?: string | null;
  shortDescription?: string | null;
  completedAt?: string | null;
};

export type OnboardingDemoState = {
  status: OnboardingDemoStatus;
  /** Legacy single poster or multi-creative set */
  type: 'poster' | 'poster_set';
  /** Primary / legacy single image (also first creative for sets) */
  imageUrl?: string | null;
  generationId?: string | null;
  sessionId?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  /** Multi-creative set (Phase 12) */
  creatives?: OnboardingDemoCreative[];
  progressStage?: OnboardingDemoProgressStage | null;
};

function parseDemoCreative(raw: unknown): OnboardingDemoCreative | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.imageUrl !== 'string' || !c.imageUrl) return null;
  if (typeof c.direction !== 'string') return null;
  return {
    imageUrl: c.imageUrl,
    generationId: typeof c.generationId === 'string' ? c.generationId : null,
    sessionId: typeof c.sessionId === 'string' ? c.sessionId : null,
    direction: c.direction,
    directionLabel:
      typeof c.directionLabel === 'string' ? c.directionLabel : c.direction,
    theme: typeof c.theme === 'string' ? c.theme : null,
    shortDescription:
      typeof c.shortDescription === 'string' ? c.shortDescription : null,
    completedAt: typeof c.completedAt === 'string' ? c.completedAt : null,
  };
}

export function parseOnboardingDemo(
  raw: unknown
): OnboardingDemoState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  if (
    d.status !== 'not_started' &&
    d.status !== 'generating' &&
    d.status !== 'completed' &&
    d.status !== 'failed'
  ) {
    return undefined;
  }

  const creativesRaw = Array.isArray(d.creatives) ? d.creatives : [];
  const creatives = creativesRaw
    .map(parseDemoCreative)
    .filter((c): c is OnboardingDemoCreative => c != null);

  const type: OnboardingDemoState['type'] =
    d.type === 'poster_set' || creatives.length > 1 ? 'poster_set' : 'poster';

  const primaryUrl =
    (typeof d.imageUrl === 'string' && d.imageUrl) ||
    creatives[0]?.imageUrl ||
    null;

  return {
    status: d.status,
    type,
    imageUrl: primaryUrl,
    generationId: typeof d.generationId === 'string' ? d.generationId : null,
    sessionId: typeof d.sessionId === 'string' ? d.sessionId : null,
    completedAt: typeof d.completedAt === 'string' ? d.completedAt : null,
    errorMessage: typeof d.errorMessage === 'string' ? d.errorMessage : null,
    creatives: creatives.length > 0 ? creatives : undefined,
    progressStage:
      typeof d.progressStage === 'string'
        ? (d.progressStage as OnboardingDemoProgressStage)
        : null,
  };
}

/** True when the one-shot demo has a renderable creative set or single image. */
export function isOnboardingDemoComplete(
  demo: OnboardingDemoState | null | undefined
): boolean {
  if (!demo || demo.status !== 'completed') return false;
  if (demo.creatives && demo.creatives.length > 0) {
    return demo.creatives.some((c) => Boolean(c.imageUrl));
  }
  return Boolean(demo.imageUrl);
}

/** Creatives to render — prefers set, falls back to legacy single image. */
export function getOnboardingDemoCreatives(
  demo: OnboardingDemoState | null | undefined
): OnboardingDemoCreative[] {
  if (!demo) return [];
  if (demo.creatives && demo.creatives.length > 0) return demo.creatives;
  if (demo.imageUrl) {
    return [
      {
        imageUrl: demo.imageUrl,
        generationId: demo.generationId,
        sessionId: demo.sessionId,
        direction: 'product_hero',
        directionLabel: 'Product Hero',
        shortDescription: 'Personalized creative for your brand',
        completedAt: demo.completedAt,
      },
    ];
  }
  return [];
}

export type TryOnboardingState = {
  status: TryOnboardingStatus;
  brandName?: string;
  websiteUrl?: string;
  source?: TryOnboardingSource;
  /** Prefer storing only small refs; large data URLs live on brand_snapshot.logo */
  productImagePreview?: string | null;
  demo?: OnboardingDemoState;
  /** Canonical plan id selected on pricing screen (no billing side effect) */
  selectedPlanId?: string | null;
  /** Products discovered via content-studio scan (or image fallbacks) */
  catalogProducts?: Product[];
  /** User-selected catalog product for the demo creative set */
  selectedProduct?: Product | null;
  updatedAt?: string;
};

function parseCatalogProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.product_name !== 'string' || !p.product_name.trim()) return null;
  const images = Array.isArray(p.product_images)
    ? p.product_images.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];
  return {
    product_name: p.product_name.trim(),
    price: typeof p.price === 'string' ? p.price : null,
    description: typeof p.description === 'string' ? p.description : '',
    key_benefits: Array.isArray(p.key_benefits)
      ? p.key_benefits.filter((b): b is string => typeof b === 'string')
      : [],
    product_images: images,
    target_audience: typeof p.target_audience === 'string' ? p.target_audience : '',
    emotional_angles: Array.isArray(p.emotional_angles)
      ? p.emotional_angles.filter((b): b is string => typeof b === 'string')
      : [],
    use_cases: Array.isArray(p.use_cases)
      ? p.use_cases.filter((b): b is string => typeof b === 'string')
      : [],
    short_benefit: typeof p.short_benefit === 'string' ? p.short_benefit : '',
    category: typeof p.category === 'string' ? p.category : undefined,
  };
}

export function parseTryOnboarding(
  preferences: Record<string, unknown> | null | undefined
): TryOnboardingState | null {
  const raw = preferences?.onboarding;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.status !== 'string') return null;

  const catalogRaw = Array.isArray(o.catalogProducts) ? o.catalogProducts : [];
  const catalogProducts = catalogRaw
    .map(parseCatalogProduct)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .slice(0, 24);

  return {
    status: o.status as TryOnboardingStatus,
    brandName: typeof o.brandName === 'string' ? o.brandName : undefined,
    websiteUrl: typeof o.websiteUrl === 'string' ? o.websiteUrl : undefined,
    source: o.source === 'website' || o.source === 'image' ? o.source : undefined,
    productImagePreview:
      typeof o.productImagePreview === 'string' ? o.productImagePreview : null,
    demo: parseOnboardingDemo(o.demo),
    selectedPlanId: typeof o.selectedPlanId === 'string' ? o.selectedPlanId : null,
    catalogProducts: catalogProducts.length > 0 ? catalogProducts : undefined,
    selectedProduct: parseCatalogProduct(o.selectedProduct),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
  };
}

export function buildTryOnboardingPatch(
  partial: Partial<TryOnboardingState> & { status: TryOnboardingStatus }
): TryOnboardingState {
  return {
    ...partial,
    status: partial.status,
    updatedAt: new Date().toISOString(),
  };
}

/** Entry destinations for authenticated users opening /try or post-auth. */
export type EntryDestination =
  | { kind: 'try'; step?: TryOnboardingStatus }
  | { kind: 'workspace' }
  | { kind: 'signin'; next: string };

export type EntryInputs = {
  authenticated: boolean;
  hasActiveSubscription: boolean;
  brandSnapshot: { name?: string } | null;
  onboarding: TryOnboardingState | null;
  /** Legacy signal from /welcome */
  businessName?: string | null;
};

/**
 * Central routing decision for Try Now / post-auth.
 * Does not scatter state across random components.
 */
export function resolveTryEntry(input: EntryInputs): EntryDestination {
  if (!input.authenticated) {
    return { kind: 'signin', next: '/try' };
  }

  if (input.hasActiveSubscription) {
    return { kind: 'workspace' };
  }

  const status = input.onboarding?.status;
  const hasBrand =
    Boolean(input.brandSnapshot?.name) ||
    status === 'brand_analyzed' ||
    status === 'demo_ready' ||
    status === 'demo_pending' ||
    status === 'demo_complete' ||
    status === 'pricing_seen' ||
    status === 'skipped' ||
    status === 'subscribed' ||
    status === 'complete';

  // Incomplete Try Now flow — resume on /try
  if (
    status === 'brand_started' ||
    status === 'analyzing' ||
    status === 'brand_analyzed' ||
    status === 'demo_ready' ||
    status === 'demo_pending'
  ) {
    return { kind: 'try', step: status };
  }

  // Payment confirmed / onboarding complete — still wait for active entitlement
  // before sending to workspace (hasActiveSubscription gate above).
  if (status === 'subscribed' || status === 'complete') {
    return { kind: 'try', step: status };
  }

  // Already finished brand understanding in Try Now but not subscribed
  if (
    status === 'demo_complete' ||
    status === 'pricing_seen' ||
    status === 'skipped'
  ) {
    return { kind: 'try', step: status };
  }

  // Legacy workspace users who never used Try Now
  if (input.businessName && !input.onboarding) {
    return { kind: 'workspace' };
  }

  if (hasBrand && !status) {
    return { kind: 'workspace' };
  }

  return { kind: 'try' };
}

export const WORKSPACE_PATH = '/content-studio';

/** Cross-instance lock key for the one-shot onboarding poster demo. */
export function onboardingDemoLockKey(userId: string): string {
  return `onboarding-poster-demo:${userId}`;
}
