/**
 * Ad Studio posters through the Brand Studio poster engine.
 *
 *   brief (product + angle + campaign strategy, brand from the Brand Kit)
 *     → marketing strategist (also reads saved Brand Research)
 *     → 3 diverse creative concepts → one poster per concept (art-director
 *       prompts, product reference, QC) → normal credit charging.
 *
 * Replaces the old single-prompt /api/generate-campaign path, so Ad Studio and
 * Brand Studio share one strategy, one brand source and one poster quality bar.
 */

import { getUserBrand } from "@/lib/brand-kit/server";
import {
  createPosterGenerationSessionService,
  generatePostersForSession,
  runCreativeConceptsForSession,
  runMarketingStrategyForSession,
  selectConceptForSession,
  type CreativeBrief,
} from "@/lib/creative-studio/poster-generation";
import type { PosterAdGoal } from "@/lib/creative-studio/poster-generation/types";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";
import { formatSceneGuidanceForBrief, inferProductSceneProfile } from "@/lib/onboarding/product-scene-guidance";
import { withOnboardingArtDirection } from "@/lib/onboarding/demo-poster";
import {
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  createPosterCarouselService,
  serializeCarouselCampaign,
  type PublicCarouselCampaign,
} from "@/lib/creative-studio/poster-generation/carousel";

export type AdStudioAngle = {
  title: string;
  explanation?: string;
  angle?: string;
  insight?: string;
  message?: string;
  proof?: string;
  audience?: string;
  funnel?: string;
};

export type AdStudioCampaignContext = {
  bigIdea?: string;
  positioning?: string;
  avoid?: string[];
};

export type AdStudioPosterResult = {
  sessionId: string;
  images: string[];
  creditsCharged: number;
  failed: number;
};

export class AdStudioPosterError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "AdStudioPosterError";
  }
}

/**
 * Funnel stage → the poster engine's ad goal (decides the ad format). Never the
 * social-proof format: it is built around a rating badge, and without a real rating
 * the image model invents one.
 */
function adGoalFor(funnel?: string): PosterAdGoal {
  if (/awareness/i.test(funnel || "")) return "awareness";
  return "feature";
}

const clip = (s: string | undefined, n: number) => (s || "").replace(/\s+/g, " ").trim().slice(0, n);

export function buildAdStudioBrief(params: {
  brand: BrandSnapshot;
  product: Product;
  angle: AdStudioAngle | null;
  campaign?: AdStudioCampaignContext | null;
}): CreativeBrief {
  const { brand, product, angle, campaign } = params;
  const images = (product.product_images || []).filter((u) => /^https?:\/\//.test(u)).slice(0, 4).map((url) => ({ url }));
  const logoUrl = brand.logo || brand.logoUrl || null;

  const angleBlock = angle
    ? [
        `Ad angle${angle.angle ? ` — ${angle.angle}` : ""}: ${clip(angle.message || angle.explanation, 300)}`,
        angle.insight && `Insight it is built on: ${clip(angle.insight, 240)}`,
        angle.proof && `What the poster should show as proof: ${clip(angle.proof, 200)}`,
        `Hook from the ad strategy (tighten it to a poster headline; keep its idea): "${clip(angle.title, 120)}"`,
      ]
    : [];
  const campaignBlock = campaign
    ? [
        campaign.bigIdea && `Campaign idea every ad ladders up to: ${clip(campaign.bigIdea, 160)}`,
        campaign.positioning && `Positioning: ${clip(campaign.positioning, 400)}`,
        campaign.avoid?.length && `Avoid: ${campaign.avoid.slice(0, 4).map((a) => clip(a, 140)).join("; ")}`,
      ]
    : [];

  const userInstruction = [
    `Create a campaign poster for ${product.product_name} by ${brand.name}.`,
    ...angleBlock,
    ...campaignBlock,
    "Feature the real product from the product reference — packaging must match it exactly.",
    "Do not invent product claims, stats, discounts or ratings. No placeholder or labelled copy (never write 'CTA:' or 'Headline:').",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `brief_adstudio_${Date.now()}`,
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: brand,
      name: brand.name,
      logo: logoUrl ? { url: logoUrl } : null,
      primaryColors: brand.primaryColors || [],
      fonts: brand.primaryFont || brand.fontStyles || null,
      tone: Array.isArray(brand.brand_tone) && brand.brand_tone.length ? brand.brand_tone.join(", ") : brand.tone || null,
      voice: brand.brandVoice || null,
      industry: brand.industry || null,
      audience: brand.audience || product.target_audience || null,
      tagline: brand.tagline || null,
      coreValueProp: product.short_benefit || brand.coreValueProp || null,
      aestheticTags: brand.brand_aesthetic || [],
      values: brand.brand_values || [],
      guidelinesApplied: true,
    },
    product: {
      source: "catalog",
      name: product.product_name,
      description: product.description || null,
      shortBenefit: product.short_benefit || null,
      category: product.category || brand.productCategory || null,
      benefits: product.key_benefits || [],
      factualClaims: [],
      features: [],
      emotionalAngles: product.emotional_angles || [],
      useCases: product.use_cases || [],
      images,
      brandName: brand.name,
      targetAudience: product.target_audience || null,
      catalogProduct: product,
    },
    userInstruction,
    visualDirection: null,
    aspectRatio: "4:5",
    variantCount: 3,
    platformHint: "Instagram / Meta feed",
    adGoal: adGoalFor(angle?.funnel),
    audienceHint: angle?.audience ? clip(angle.audience, 160) : null,
    constraints: [
      "Do not invent factual product claims not present in the brief.",
      "Use the provided product reference image as the exact product SKU.",
      "Every line of copy must be finished ad copy — never a label like 'CTA:'.",
    ],
    productReferences: images.map((image, i) => ({ id: `adstudio_product_${i}`, role: "product_packshot" as const, image })),
    designReferences: [],
    supportingReferences: [],
  };
}

/**
 * Art direction for the concept and image stages. Added after the strategist runs
 * (visual language in the brief would trip the strategist's visual-leak check).
 * Without it, price- and value-led angles tend to come back as a bare packshot.
 */
export function buildAdStudioArtDirection(brand: BrandSnapshot, product: Product, angle: AdStudioAngle | null): string {
  const scene = formatSceneGuidanceForBrief(
    inferProductSceneProfile(product, [brand.productCategory || "", brand.offering || "", brand.industry || "", brand.description || ""])
  );
  return [
    "=== ART DIRECTION (for Creative Director / image generation only) ===",
    "Campaign-grade paid-social creative, not a catalogue packshot: each concept's own design language and storytelling device carry one strong visual idea that dramatises the angle.",
    angle?.proof ? `The proof the idea can show: ${clip(angle.proof, 200)}.` : "",
    "Never a plain product on an empty backdrop.",
    scene,
  ]
    .filter(Boolean)
    .join("\n");
}

async function applyArtDirection(
  sessionService: ReturnType<typeof createPosterGenerationSessionService>,
  sessionId: string,
  userId: string,
  brand: BrandSnapshot,
  product: Product,
  angle: AdStudioAngle | null
) {
  const session = await sessionService.getSession(sessionId, userId);
  if (!session.brief) return;
  await sessionService.updateBrief(
    sessionId,
    userId,
    withOnboardingArtDirection(session.brief, buildAdStudioArtDirection(brand, product, angle))
  );
}

async function loadBrand(userId: string, fallback?: Partial<BrandSnapshot> | null): Promise<BrandSnapshot> {
  // The Brand Kit is the brand's source of truth; Ad Studio's scan summary only fills gaps.
  const { snapshot } = await getUserBrand(userId);
  const brand = { ...(fallback || {}), ...(snapshot || {}), name: snapshot?.name || fallback?.name || "" } as BrandSnapshot;
  if (!brand.name) throw new AdStudioPosterError("Set up your brand first.", 400);
  return brand;
}

function assertProductImage(product: Product) {
  if (!product?.product_name) throw new AdStudioPosterError("Product is required", 400);
  if (!product.product_images?.some((u) => /^https?:\/\//.test(u))) {
    throw new AdStudioPosterError("This product has no image to build the poster around.", 400);
  }
}

/**
 * Carousel plan items: one story told across N slides, via the Brand Studio carousel
 * engine. Plans only (no credits); the browser then runs the existing carousel
 * generate/resume endpoints through <CarouselStudio>.
 */
export async function planAdStudioCarousel(params: {
  userId: string;
  product: Product;
  angle: AdStudioAngle | null;
  campaign?: AdStudioCampaignContext | null;
  fallbackBrand?: Partial<BrandSnapshot> | null;
  slideCount: number;
}): Promise<PublicCarouselCampaign> {
  const { userId, product, angle, campaign } = params;
  assertProductImage(product);
  const slideCount = Math.min(CAROUSEL_MAX_SLIDES, Math.max(CAROUSEL_MIN_SLIDES, Math.round(params.slideCount || 5)));
  const brand = await loadBrand(userId, params.fallbackBrand);

  const sessionService = createPosterGenerationSessionService();
  const session = await sessionService.createSession({ userId });
  const brief = buildAdStudioBrief({ brand, product, angle, campaign });
  brief.variantCount = 1;
  await sessionService.updateBrief(session.id, userId, brief);

  await runMarketingStrategyForSession({ sessionId: session.id, userId, sessionService });
  await applyArtDirection(sessionService, session.id, userId, brand, product, angle);
  const { concepts } = await runCreativeConceptsForSession({ sessionId: session.id, userId, conceptCount: 1, sessionService });
  if (!concepts.length) throw new AdStudioPosterError("Couldn't plan the carousel. Please try again.");
  await selectConceptForSession({ sessionId: session.id, userId, conceptIds: concepts[0].id, sessionService });

  const planned = await createPosterCarouselService().plan({
    sessionId: session.id,
    userId,
    slideCount,
    conceptId: concepts[0].id,
  });
  return serializeCarouselCampaign(planned.data);
}

export async function generateAdStudioPosters(params: {
  userId: string;
  product: Product;
  angle: AdStudioAngle | null;
  campaign?: AdStudioCampaignContext | null;
  fallbackBrand?: Partial<BrandSnapshot> | null;
}): Promise<AdStudioPosterResult> {
  const { userId, product, angle, campaign } = params;
  assertProductImage(product);
  const brand = await loadBrand(userId, params.fallbackBrand);

  const sessionService = createPosterGenerationSessionService();
  const session = await sessionService.createSession({ userId });
  await sessionService.updateBrief(session.id, userId, buildAdStudioBrief({ brand, product, angle, campaign }));

  await runMarketingStrategyForSession({ sessionId: session.id, userId, sessionService });
  await applyArtDirection(sessionService, session.id, userId, brand, product, angle);
  const { concepts } = await runCreativeConceptsForSession({ sessionId: session.id, userId, conceptCount: 3, sessionService });
  if (!concepts.length) throw new AdStudioPosterError("Couldn't plan the poster. Please try again.");
  await selectConceptForSession({ sessionId: session.id, userId, conceptIds: concepts.map((c) => c.id), sessionService });

  const result = await generatePostersForSession({
    sessionId: session.id,
    userId,
    variantCount: concepts.length,
    sessionService,
  });
  const images = result.outcomes
    .filter((o) => o.success && o.asset?.imageUrl)
    .map((o) => o.asset.imageUrl as string);
  return { sessionId: session.id, images, creditsCharged: result.creditsCharged, failed: result.failedVariants };
}

export type FormatPosterResult = { ok: true; imageUrl: string; sessionId: string } | { ok: false; error: string; sessionId: string | null };

export type PosterPairResult = { feed: FormatPosterResult; story: FormatPosterResult; creditsCharged: number };

/**
 * Test packs: one angle → one concept, rendered twice — feed (4:5) and story (9:16) —
 * from the same strategy and concept, so the two variants differ only by format.
 * 1 image credit per successful poster (charged by the normal pipeline).
 */
export async function generateAdStudioPosterPair(params: {
  userId: string;
  product: Product;
  angle: AdStudioAngle;
  campaign?: AdStudioCampaignContext | null;
  /** false = feed only (no story render, no story credit). Default true. */
  includeStory?: boolean;
}): Promise<PosterPairResult> {
  const { userId, product, angle, campaign } = params;
  assertProductImage(product);
  const brand = await loadBrand(userId, null);
  const sessionService = createPosterGenerationSessionService();
  let creditsCharged = 0;

  const errorText = (err: unknown) => {
    const pub = (err as { toPublicJSON?: () => { message?: string } })?.toPublicJSON?.();
    return pub?.message || (err as Error)?.message || "Poster generation failed";
  };

  // Feed: full pipeline with one concept.
  let feedSessionId: string | null = null;
  let feed: FormatPosterResult;
  try {
    const session = await sessionService.createSession({ userId });
    feedSessionId = session.id;
    const brief = buildAdStudioBrief({ brand, product, angle, campaign });
    brief.variantCount = 1;
    brief.aspectRatio = "4:5";
    await sessionService.updateBrief(session.id, userId, brief);
    await runMarketingStrategyForSession({ sessionId: session.id, userId, sessionService });
    await applyArtDirection(sessionService, session.id, userId, brand, product, angle);
    const { concepts } = await runCreativeConceptsForSession({ sessionId: session.id, userId, conceptCount: 1, sessionService });
    if (!concepts.length) throw new AdStudioPosterError("Couldn't plan the poster. Please try again.");
    await selectConceptForSession({ sessionId: session.id, userId, conceptIds: concepts[0].id, sessionService });
    const result = await generatePostersForSession({ sessionId: session.id, userId, variantCount: 1, sessionService });
    creditsCharged += result.creditsCharged;
    const url = result.outcomes.find((o) => o.success && o.asset?.imageUrl)?.asset.imageUrl as string | undefined;
    feed = url ? { ok: true, imageUrl: url, sessionId: session.id } : { ok: false, error: "The feed poster didn't come out right.", sessionId: session.id };
  } catch (err) {
    return {
      feed: { ok: false, error: errorText(err), sessionId: feedSessionId },
      story: { ok: false, error: "Skipped because the feed poster could not be planned.", sessionId: null },
      creditsCharged,
    };
  }

  if (params.includeStory === false) {
    return { feed, story: { ok: false, error: "Not requested", sessionId: null }, creditsCharged };
  }

  // Story: same brief (9:16), same strategy and concept → only the format changes.
  let story: FormatPosterResult;
  let storySessionId: string | null = null;
  try {
    const planned = await sessionService.getSession(feed.sessionId!, userId);
    if (!planned.brief || !planned.strategy || !planned.concepts.length) throw new Error("Feed plan is incomplete");
    const s = await sessionService.createSession({ userId });
    storySessionId = s.id;
    await sessionService.updateBrief(s.id, userId, { ...planned.brief, id: `${planned.brief.id}_story`, aspectRatio: "9:16", variantCount: 1 });
    await sessionService.updateStrategy(s.id, userId, planned.strategy);
    await sessionService.setConcepts(s.id, userId, planned.concepts, planned.dnaByConceptId);
    await selectConceptForSession({ sessionId: s.id, userId, conceptIds: planned.concepts[0].id, sessionService });
    const result = await generatePostersForSession({ sessionId: s.id, userId, variantCount: 1, sessionService });
    creditsCharged += result.creditsCharged;
    const url = result.outcomes.find((o) => o.success && o.asset?.imageUrl)?.asset.imageUrl as string | undefined;
    story = url ? { ok: true, imageUrl: url, sessionId: s.id } : { ok: false, error: "The story poster didn't come out right.", sessionId: s.id };
  } catch (err) {
    story = { ok: false, error: errorText(err), sessionId: storySessionId };
  }
  return { feed, story, creditsCharged };
}

export type DraftRenderResult = { ok: true; sessionId: string; storagePath: string } | { ok: false; sessionId: string | null; error: string };

/**
 * Ad Studio poster flow: one researched angle → one DRAFT poster in the chosen format.
 * Never charges (the owner pays only for drafts they keep) and stores through `storeImage`
 * (the private draft bucket). Everything else is the normal poster pipeline.
 */
export async function renderAdStudioDraft(params: {
  userId: string;
  product: Product;
  angle: AdStudioAngle;
  adGoal: PosterAdGoal;
  aspectRatio: "4:5" | "1:1" | "9:16" | "1.91:1";
  extraInstruction?: string | null;
  storeImage: NonNullable<Parameters<typeof generatePostersForSession>[0]["storeImage"]>;
}): Promise<DraftRenderResult> {
  const { userId, product, angle } = params;
  let sessionId: string | null = null;
  try {
    assertProductImage(product);
    const brand = await loadBrand(userId, null);
    const sessionService = createPosterGenerationSessionService();
    const session = await sessionService.createSession({ userId });
    sessionId = session.id;
    const brief = buildAdStudioBrief({ brand, product, angle });
    brief.variantCount = 1;
    brief.aspectRatio = params.aspectRatio;
    brief.adGoal = params.adGoal;
    if (params.extraInstruction) brief.userInstruction = `${brief.userInstruction}\n${clip(params.extraInstruction, 700)}`;
    await sessionService.updateBrief(session.id, userId, brief);
    await runMarketingStrategyForSession({ sessionId: session.id, userId, sessionService });
    await applyArtDirection(sessionService, session.id, userId, brand, product, angle);
    const { concepts } = await runCreativeConceptsForSession({ sessionId: session.id, userId, conceptCount: 1, sessionService });
    if (!concepts.length) throw new AdStudioPosterError("Couldn't plan this poster.");
    await selectConceptForSession({ sessionId: session.id, userId, conceptIds: concepts[0].id, sessionService });
    const result = await generatePostersForSession({
      sessionId: session.id,
      userId,
      variantCount: 1,
      sessionService,
      storeImage: params.storeImage,
      // Drafts are free: the charge happens when the owner keeps the poster.
      credits: { getBalance: async () => 1, deduct: async () => true },
    });
    const asset = result.outcomes.find((o) => o.success && o.asset?.storagePath)?.asset;
    return asset?.storagePath
      ? { ok: true, sessionId: session.id, storagePath: asset.storagePath as string }
      : { ok: false, sessionId: session.id, error: "This poster didn't come out right." };
  } catch (err) {
    const pub = (err as { toPublicJSON?: () => { message?: string } })?.toPublicJSON?.();
    return { ok: false, sessionId, error: pub?.message || (err as Error)?.message || "Poster generation failed" };
  }
}

/**
 * Re-draw a planned poster in another format: copies the brief (new aspect), strategy and
 * concept from an existing session into a new one, then renders once. Never charges here —
 * the caller decides (Ad Studio charges 1 credit when the owner asked for the extra size).
 */
export async function renderDraftInFormat(params: {
  userId: string;
  sourceSessionId: string;
  aspectRatio: "4:5" | "1:1" | "9:16" | "1.91:1";
  storeImage: NonNullable<Parameters<typeof generatePostersForSession>[0]["storeImage"]>;
}): Promise<DraftRenderResult> {
  const { userId } = params;
  const sessionService = createPosterGenerationSessionService();
  let sessionId: string | null = null;
  try {
    const planned = await sessionService.getSession(params.sourceSessionId, userId);
    if (!planned.brief || !planned.strategy || !planned.concepts.length) throw new Error("The original poster plan is incomplete");
    const s = await sessionService.createSession({ userId });
    sessionId = s.id;
    const briefId = `${planned.brief.id}_${params.aspectRatio.replace(/[:.]/g, "x")}`;
    await sessionService.updateBrief(s.id, userId, { ...planned.brief, id: briefId, aspectRatio: params.aspectRatio, variantCount: 1 });
    // The copied strategy and concepts must point at the new brief, or generation rejects them as stale.
    await sessionService.updateStrategy(s.id, userId, { ...planned.strategy, briefId });
    await sessionService.setConcepts(s.id, userId, planned.concepts.map((c) => ({ ...c, briefId })), planned.dnaByConceptId);
    const conceptId = planned.selectedConceptIds[0] ?? planned.concepts[0].id;
    await selectConceptForSession({ sessionId: s.id, userId, conceptIds: conceptId, sessionService });
    const result = await generatePostersForSession({
      sessionId: s.id, userId, variantCount: 1, sessionService, storeImage: params.storeImage,
      credits: { getBalance: async () => 1, deduct: async () => true },
    });
    const asset = result.outcomes.find((o) => o.success && o.asset?.storagePath)?.asset;
    return asset?.storagePath
      ? { ok: true, sessionId: s.id, storagePath: asset.storagePath as string }
      : { ok: false, sessionId: s.id, error: "This size didn't come out right." };
  } catch (err) {
    const pub = (err as { toPublicJSON?: () => { message?: string } })?.toPublicJSON?.();
    return { ok: false, sessionId, error: pub?.message || (err as Error)?.message || "Poster generation failed" };
  }
}
