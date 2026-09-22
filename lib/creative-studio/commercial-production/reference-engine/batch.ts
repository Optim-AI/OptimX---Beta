/**
 * Batch keyframe generation with dependency order.
 * Sequential by shot.sequence so previous-shot refs resolve.
 * Independent shots could later be parallelized — Phase 4 keeps order safe.
 */

import { generateCommercialKeyframe } from "./generate";
import type { GenerateCommercialKeyframesInput, KeyframeResult, ReferenceEngineOptions } from "./types";

export async function generateCommercialKeyframes(
  input: GenerateCommercialKeyframesInput,
  options: ReferenceEngineOptions = {}
): Promise<KeyframeResult[]> {
  const shots = [...input.shots].sort((a, b) => a.sequence - b.sequence);
  const results: KeyframeResult[] = [];
  const sessionApproved: Record<string, KeyframeResult> = {
    ...(input.availableAssets?.approvedKeyframesByShotId || {}),
  };

  for (const shot of shots) {
    const result = await generateCommercialKeyframe(
      {
        blueprint: input.blueprint,
        shot,
        availableAssets: {
          ...input.availableAssets,
          approvedKeyframesByShotId: sessionApproved,
        },
        forceRegenerate: input.forceRegenerate,
        maxAttempts: input.maxAttempts,
        userId: input.userId,
        skipStorage: input.skipStorage,
      },
      options
    );
    results.push(result);
    if (result.status === "approved") {
      sessionApproved[shot.id] = result;
    }
  }

  return results;
}
