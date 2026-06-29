/**
 * OptimX Film Engine — Veo renderer adapter.
 *
 * This is the ONLY model-specific file. It implements the model-agnostic
 * `VideoRenderer` contract for Google Veo 3.x. Swapping to Runway/Kling/Sora
 * means writing a sibling adapter — the reasoning pipeline is untouched.
 */

import { editorPromptDigest } from "./editor-engine";
import { physicsPromptDigest } from "./physics-engine";
import { buildPromptSections, compressToBudget } from "./prompt-compressor";
import type {
  CompressedShotPlan,
  RenderRequest,
  VideoRenderer,
  VideoRendererCapabilities,
} from "./types";

/** Veo 3.x hard-ish prompt budget. Kept conservative to avoid INVALID_ARGUMENT. */
export const VEO_MAX_PROMPT_TOKENS = 1024;

export class VeoRenderer implements VideoRenderer {
  readonly capabilities: VideoRendererCapabilities = {
    id: "veo-3",
    label: "Google Veo 3.x",
    maxPromptTokens: VEO_MAX_PROMPT_TOKENS,
    supportedDurations: [4, 6, 8],
    supportsReferenceImages: true,
    supportsNativeAudio: true,
    supportsNegativePrompt: true,
  };

  buildPrompt(request: RenderRequest, segmentIndex?: number): CompressedShotPlan {
    const { direction, sceneGraph, aspectRatio } = request;
    const segmentCount = resolveSegmentCount(request);

    const voiceover = voiceoverForSegment(request.voiceoverScript, segmentIndex, segmentCount);

    const sections = buildPromptSections({
      direction,
      graph: sceneGraph,
      voiceover,
      physicsDigest: physicsPromptDigest(sceneGraph, direction),
      editorDigest: editorPromptDigest(direction),
      aspectRatio,
      segmentIndex,
      segmentCount,
    });

    // Reserve headroom for audio/native-VO instruction overhead Veo adds.
    const budget = Math.floor(this.capabilities.maxPromptTokens * 0.92);
    const { prompt, estimatedTokens } = compressToBudget(sections, budget);

    return {
      prompt,
      voiceover,
      durationSeconds: request.clipDurationSeconds,
      aspectRatio,
      segmentIndex,
      segmentCount,
      estimatedTokens,
    };
  }
}

/** How many clips the full film is split into. */
function resolveSegmentCount(request: RenderRequest): number {
  const clip = Math.max(1, request.clipDurationSeconds);
  return Math.max(1, Math.round(request.totalDurationSeconds / clip));
}

/** Distribute the full voiceover script across segments (rough sentence split). */
function voiceoverForSegment(
  script: string | undefined,
  segmentIndex?: number,
  segmentCount?: number
): string | undefined {
  if (!script?.trim()) return undefined;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return script.trim();

  const sentences = script
    .trim()
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return script.trim();

  const per = Math.ceil(sentences.length / segmentCount);
  const start = segmentIndex * per;
  const slice = sentences.slice(start, start + per);
  return (slice.length ? slice : sentences).join(" ");
}

export const veoRenderer = new VeoRenderer();
