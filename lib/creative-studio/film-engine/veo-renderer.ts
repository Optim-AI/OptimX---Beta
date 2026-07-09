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
import { finalizeVoiceoverForClip } from "../video-prompt-utils";
import { VEO_STRICT_NO_TEXT_BLOCK } from "../veo-output-rules";
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

    const voiceover = voiceoverForSegment(
      request.voiceoverScript,
      segmentIndex,
      segmentCount,
      request.clipDurationSeconds
    );

    const sections = buildPromptSections({
      direction,
      graph: sceneGraph,
      voiceover,
      physicsDigest: physicsPromptDigest(sceneGraph, direction),
      editorDigest: editorPromptDigest(direction),
      aspectRatio,
      clipDurationSeconds: request.clipDurationSeconds,
      segmentIndex,
      segmentCount,
    });

    // Reserve headroom for audio/native-VO instruction overhead Veo adds.
    const budget = Math.floor(this.capabilities.maxPromptTokens * 0.92);
    const { prompt: compressed, estimatedTokens } = compressToBudget(sections, budget);
    const prompt = `${VEO_STRICT_NO_TEXT_BLOCK}\n\n${compressed}`.trim();

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

/** Distribute and hard-cap voiceover per clip so native audio never exceeds clip length. */
function voiceoverForSegment(
  script: string | undefined,
  segmentIndex?: number,
  segmentCount?: number,
  clipDurationSeconds = 8
): string | undefined {
  if (!script?.trim()) return undefined;

  const totalDuration =
    segmentCount && segmentCount > 1 ? clipDurationSeconds * segmentCount : clipDurationSeconds;

  return finalizeVoiceoverForClip(script, clipDurationSeconds, {
    totalDurationSeconds: totalDuration,
    segmentIndex,
    segmentCount,
  });
}

export const veoRenderer = new VeoRenderer();
