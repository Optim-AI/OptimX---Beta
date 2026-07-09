/**
 * OptimX Film Engine — public entry point.
 *
 * Orchestrates the model-agnostic reasoning pipeline:
 *
 *   brief ─▶ CreativeDirector ─▶ SceneGraph ─▶ Physics ─▶ Editor ─▶ Renderer
 *
 * Only the renderer at the end is model-specific. Everything before it is
 * reusable across Veo / Runway / Kling / Sora.
 */

import { buildCreativeDirection, summarizeCreativeDirection } from "./creative-director";
import { validateEdit } from "./editor-engine";
import { getFilmStyleById } from "./film-styles";
import { enrichWithPhysics, validatePhysics } from "./physics-engine";
import { buildSceneGraph, type RawStoryboardScene } from "./scene-graph";
import { veoRenderer } from "./veo-renderer";
import type { BrandPromptContext } from "../brand-context";
import { buildBrandContextBlock } from "../brand-context";
import type {
  CompressedShotPlan,
  CreativeDirection,
  CreativeDirectorInput,
  SceneGraph,
  ValidationIssue,
  VideoRenderer,
} from "./types";

export * from "./types";
export { buildCreativeDirection, summarizeCreativeDirection } from "./creative-director";
export { buildSceneGraph } from "./scene-graph";
export { getFilmStyle, getFilmStyleById, FILM_STYLES } from "./film-styles";
export { resolveApplicationSite, applicationSiteDirective } from "./application-site";
export { anatomyLockDirective } from "./prompt-compressor";
export { veoRenderer, VeoRenderer, VEO_MAX_PROMPT_TOKENS } from "./veo-renderer";

export interface FilmEngineInput extends CreativeDirectorInput {
  storyboard?: RawStoryboardScene[];
  voiceoverScript?: string;
  aspectRatio: string;
  clipDurationSeconds: number;
  hasReferenceImages?: boolean;
  headline?: string;
  subtext?: string;
  brandContext?: BrandPromptContext;
}

export interface FilmEngineResult {
  direction: CreativeDirection;
  sceneGraph: SceneGraph;
  issues: ValidationIssue[];
  summary: string;
  /** One compressed prompt per segment (clip). */
  segments: CompressedShotPlan[];
}

export interface FilmEngineVariant {
  filmStyleId: string;
  label: string;
  summary: string;
  prompt: string;
  estimatedTokens: number;
  segmentPrompts?: string[];
}

/** Pairs each primary style with a contrasting alternate for A/B preview. */
const STYLE_ALTERNATES: Record<string, string> = {
  apple_premium: "ugc_authentic",
  luxury_cinematic: "commercial_default",
  ugc_authentic: "apple_premium",
  nike_energetic: "commercial_default",
  redbull_punchy: "ugc_authentic",
  dove_warm: "apple_premium",
  commercial_default: "ugc_authentic",
};

function variantStyleIds(primaryId: string, count: number): string[] {
  const ids = [primaryId];
  const alt = STYLE_ALTERNATES[primaryId] ?? "commercial_default";
  if (!ids.includes(alt)) ids.push(alt);
  if (count >= 3 && !ids.includes("luxury_cinematic")) ids.push("luxury_cinematic");
  return ids.slice(0, count);
}

/**
 * Preview multiple film-style prompt variants (InVideo: generate multiple options).
 * Does not call Veo — returns prompts only.
 */
export function runFilmEngineVariants(
  input: FilmEngineInput,
  count = 2,
  renderer: VideoRenderer = veoRenderer
): FilmEngineVariant[] {
  const primary = buildCreativeDirection(input);
  const styleIds = input.filmStyleId
    ? variantStyleIds(input.filmStyleId, count)
    : variantStyleIds(primary.filmStyle.id, count);

  return styleIds.map((filmStyleId) => {
    const result = runFilmEngine({ ...input, filmStyleId }, renderer);
    const style = getFilmStyleById(filmStyleId);
    let prompt = result.segments[0]?.prompt ?? "";
    const brandBlock = buildBrandContextBlock(input.brandContext, input.brandName, {
      videoGeneration: true,
    });
    if (brandBlock) prompt = `${brandBlock}\n${prompt}`;
    return {
      filmStyleId,
      label: style.label,
      summary: result.summary,
      prompt,
      estimatedTokens: result.segments[0]?.estimatedTokens ?? 0,
      segmentPrompts: result.segments.map((s) => s.prompt),
    };
  });
}

/**
 * Run the full pipeline and produce render-ready prompts for every clip.
 * Pure and deterministic — safe to call from any API route.
 */
export function runFilmEngine(
  input: FilmEngineInput,
  renderer: VideoRenderer = veoRenderer
): FilmEngineResult {
  const direction = buildCreativeDirection(input);

  const graph = enrichWithPhysics(
    buildSceneGraph(input.storyboard, direction),
    direction
  );

  const issues: ValidationIssue[] = [
    ...validatePhysics(graph, direction).issues,
    ...validateEdit(graph, direction).issues,
  ];

  const totalDurationSeconds = direction.totalDurationSeconds;
  const clip = Math.max(1, input.clipDurationSeconds);
  const segmentCount = Math.max(1, Math.round(totalDurationSeconds / clip));

  const request = {
    direction,
    sceneGraph: graph,
    voiceoverScript: input.voiceoverScript,
    aspectRatio: input.aspectRatio,
    clipDurationSeconds: clip,
    totalDurationSeconds,
    hasReferenceImages: input.hasReferenceImages ?? false,
    headline: input.headline,
    subtext: input.subtext,
  };

  const segments: CompressedShotPlan[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(renderer.buildPrompt(request, segmentCount > 1 ? i : undefined));
  }

  return {
    direction,
    sceneGraph: graph,
    issues,
    summary: summarizeCreativeDirection(direction),
    segments,
  };
}

/** Convenience: build just the prompt string for a single clip (8s default path). */
export function buildFilmPrompt(input: FilmEngineInput, segmentIndex?: number): string {
  const result = runFilmEngine(input);
  if (segmentIndex != null && result.segments[segmentIndex]) {
    return result.segments[segmentIndex].prompt;
  }
  return result.segments[0]?.prompt ?? "";
}
