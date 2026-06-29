/**
 * Central Veo prompt resolver — legacy compact prompt + Film Engine v2.
 * Applies brand context, labeled references, and optional style override.
 */

import type { BrandPromptContext } from "./brand-context";
import { brandContextFromBody } from "./brand-context";
import { buildEnvatoCommercialDirective } from "./envato-prompt";
import {
  runFilmEngine,
  runFilmEngineVariants,
  type FilmEngineInput,
  type FilmEngineVariant,
} from "./film-engine";
import type { ReferenceImageSlots } from "./reference-labels";
import { referenceSlotsFromRequest } from "./reference-labels";
import {
  buildVeoVideoPrompt,
  enforceVeoPromptBudget,
  estimateVeoPromptTokens,
  type StoryboardScene,
  type VeoPromptInput,
  VEO_PROMPT_MAX_TOKENS,
} from "./video-prompt-utils";

export interface ResolveVeoPromptRequest {
  veoInput: VeoPromptInput;
  filmInput?: Partial<FilmEngineInput>;
  brandContext?: BrandPromptContext;
  referenceSlots?: ReferenceImageSlots;
  segmentIndex?: number;
  useFilmEngine?: boolean;
  filmStyleId?: string;
  /** Skip film engine when user supplied a final treatment (manual override). */
  respectFinalVideoPrompt?: boolean;
}

export interface ResolvedVeoPrompt {
  prompt: string;
  source: "film-engine" | "legacy";
  estimatedTokens: number;
  filmSummary?: string;
}

/** Prepend Envato formula only — brand/refs are already inside buildVeoVideoPrompt / Film Engine. */
function finalizeVeoPrompt(base: string, envatoBlock?: string): string {
  const trimmed = base.trim();
  if (!envatoBlock?.trim()) return enforceVeoPromptBudget(trimmed);
  return enforceVeoPromptBudget(`${envatoBlock.trim()}\n${trimmed}`);
}

/**
 * Resolve the final Veo prompt for one clip/segment.
 * Film Engine is used when enabled and no manual final_video_prompt override.
 */
export function resolveVeoPrompt(req: ResolveVeoPromptRequest): ResolvedVeoPrompt {
  const {
    veoInput,
    filmInput,
    brandContext,
    segmentIndex,
    useFilmEngine,
    filmStyleId,
    respectFinalVideoPrompt = true,
  } = req;

  const envatoBlock = buildEnvatoCommercialDirective({
    tone: veoInput.adTone,
    hookType: veoInput.hookType,
    creativeFormat: veoInput.creativeFormat || veoInput.style,
    keyMessage: veoInput.keyMessage,
  });

  const legacyPrompt = finalizeVeoPrompt(buildVeoVideoPrompt(veoInput), envatoBlock);

  const shouldUseFilm =
    useFilmEngine === true &&
    !(respectFinalVideoPrompt && veoInput.finalVideoPrompt?.trim());

  if (!shouldUseFilm) {
    return {
      prompt: legacyPrompt,
      source: "legacy",
      estimatedTokens: estimateVeoPromptTokens(legacyPrompt),
    };
  }

  try {
    const film = runFilmEngine({
      storyboard: filmInput?.storyboard ?? veoInput.storyboard,
      brandContext,
      filmStyleId,
      brandName: veoInput.brandName,
      productName: veoInput.productName,
      category: veoInput.category,
      userDescription: veoInput.userDescription,
      creativeFormat: veoInput.creativeFormat || veoInput.style,
      style: veoInput.style,
      hookType: veoInput.hookType,
      campaignGoal: veoInput.campaignGoal,
      cta: veoInput.cta,
      keyMessage: veoInput.keyMessage,
      creativeStrategy: veoInput.creativeStrategy,
      totalDurationSeconds: veoInput.totalDurationSeconds ?? veoInput.clipDurationSeconds,
      clipDurationSeconds: veoInput.clipDurationSeconds,
      aspectRatio: veoInput.aspectRatio,
      voiceoverScript: veoInput.voiceoverScript,
      hasReferenceImages: veoInput.hasReferenceImages,
      headline: veoInput.headline,
      subtext: veoInput.subtext,
    });

    const segIdx = segmentIndex ?? 0;
    const segment = film.segments[segIdx] ?? film.segments[0];
    const filmPrompt = segment?.prompt?.trim();

    if (filmPrompt) {
      const prompt = finalizeVeoPrompt(filmPrompt, envatoBlock);
      return {
        prompt,
        source: "film-engine",
        estimatedTokens: estimateVeoPromptTokens(prompt),
        filmSummary: film.summary,
      };
    }
  } catch (e) {
    console.warn("Film Engine prompt resolution failed, using legacy:", e);
  }

  return {
    prompt: legacyPrompt,
    source: "legacy",
    estimatedTokens: estimateVeoPromptTokens(legacyPrompt),
  };
}

/** Preview 2–3 prompt variants (different film styles) without calling Veo. */
export function previewPromptVariants(
  filmInput: FilmEngineInput,
  count = 2
): FilmEngineVariant[] {
  return runFilmEngineVariants(filmInput, Math.min(3, Math.max(2, count)));
}

export function filmEngineEnabled(body: Record<string, unknown>): boolean {
  if (body.use_film_engine === false) return false;
  return body.use_film_engine === true || process.env.FILM_ENGINE_V2 === "1";
}

/** Build a resolve request from generate-video API body fields. */
export function resolveRequestFromApiBody(
  body: Record<string, unknown>,
  opts: {
    clipDurationSeconds: number;
    totalDurationSeconds: number;
    aspectRatio: string;
    hasReferenceImages: boolean;
    voiceoverScript?: string;
    segmentIndex?: number;
    segmentCount?: number;
    referenceSlots?: ReferenceImageSlots;
  }
): ResolveVeoPromptRequest {
  const brandContext = brandContextFromBody(body);
  const referenceSlots =
    opts.referenceSlots ??
    referenceSlotsFromRequest({
      hero_image: body.hero_image as string | undefined,
      brand_logo: body.brand_logo as string | undefined,
      product_images: body.product_images as string[] | undefined,
      segment_has_continuity_frame: opts.segmentIndex === 1,
      product_name: body.product_name as string | undefined,
      brand_name: body.brand_name as string | undefined,
    });

  const veoInput: VeoPromptInput = {
    brandName: body.brand_name as string | undefined,
    productName: body.product_name as string | undefined,
    category: body.category as string | undefined,
    userDescription: body.user_description as string | undefined,
    creativeFormat: (body.creative_format || body.style) as string | undefined,
    hookType: body.hook_type as string | undefined,
    campaignGoal: body.campaign_goal as string | undefined,
    creativeStrategy: body.creative_strategy as VeoPromptInput["creativeStrategy"],
    style: (body.creative_format || body.style) as string | undefined,
    clipDurationSeconds: opts.clipDurationSeconds,
    totalDurationSeconds: opts.totalDurationSeconds,
    aspectRatio: opts.aspectRatio,
    segmentIndex: opts.segmentIndex,
    segmentCount: opts.segmentCount,
    finalVideoPrompt: body.final_video_prompt as string | undefined,
    fallbackPrompt: body.prompt as string | undefined,
    voiceoverScript: opts.voiceoverScript,
    storyboard: Array.isArray(body.storyboard) ? body.storyboard : undefined,
    hasReferenceImages: opts.hasReferenceImages,
    headline: body.headline as string | undefined,
    subtext: body.subtext as string | undefined,
    keyMessage: body.key_message as string | undefined,
    cta: body.cta as string | undefined,
    brandContext,
    referenceSlots,
    filmStyleId: body.film_style_id as string | undefined,
    adTone: (body.tone as string | undefined) || undefined,
  };

  return {
    veoInput,
    filmInput: { storyboard: veoInput.storyboard, brandContext },
    brandContext,
    referenceSlots,
    segmentIndex: opts.segmentIndex,
    useFilmEngine: filmEngineEnabled(body),
    filmStyleId: body.film_style_id as string | undefined,
    respectFinalVideoPrompt: true,
  };
}

/** Ensure prompt fits Veo budget (compresses if needed). */
export function assertPromptWithinBudget(prompt: string): string {
  return enforceVeoPromptBudget(prompt);
}

export type { StoryboardScene, VeoPromptInput };
