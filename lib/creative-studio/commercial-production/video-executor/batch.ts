/**
 * Batch commercial shot video generation with bounded concurrency.
 */

import { generateCommercialShotVideo } from "./executor";
import type {
  GenerateCommercialShotVideosInput,
  ShotVideoResult,
  VideoExecutorOptions,
} from "./types";

function getMaxConcurrency(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }
  const fromEnv = Number(process.env.COMMERCIAL_VIDEO_MAX_CONCURRENCY || "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return 2;
}

/**
 * Dependency-aware batch:
 * - shots that list previousShotReferenceIds wait for those shot results first
 * - otherwise run with bounded concurrency
 */
export async function generateCommercialShotVideos(
  input: GenerateCommercialShotVideosInput,
  options: VideoExecutorOptions = {}
): Promise<ShotVideoResult[]> {
  const concurrency = getMaxConcurrency(input.concurrency);
  const prepared = [...input.preparedShots].sort(
    (a, b) => a.shot.sequence - b.shot.sequence
  );
  const resultsByShotId = new Map<string, ShotVideoResult>();
  const results: ShotVideoResult[] = [];

  const pending = new Set(prepared.map((p) => p.shot.id));
  const inFlight = new Map<string, Promise<void>>();

  async function runOne(prep: (typeof prepared)[number]): Promise<void> {
    const result = await generateCommercialShotVideo(
      {
        blueprint: input.blueprint,
        prepared: prep,
        generationVersion: input.generationVersion,
        forceRegenerate: input.forceRegenerate,
        skipDownload: input.skipDownload,
        skipStorage: input.skipStorage,
        userId: input.userId,
      },
      options
    );
    resultsByShotId.set(prep.shot.id, result);
    results.push(result);
    pending.delete(prep.shot.id);
  }

  function depsSatisfied(prep: (typeof prepared)[number]): boolean {
    const deps = prep.shot.referenceRequirements.previousShotReferenceIds || [];
    for (const depId of deps) {
      if (pending.has(depId) || inFlight.has(depId)) return false;
      const dep = resultsByShotId.get(depId);
      if (!dep) return false;
      if (dep.status !== "completed" && dep.status !== "deferred") return false;
    }
    // Also wait for continuity continuesFromShotIds when video continuity matters
    const cont = prep.shot.continuity.continuesFromShotIds || [];
    for (const depId of cont) {
      if (pending.has(depId) || inFlight.has(depId)) return false;
    }
    return true;
  }

  while (pending.size > 0 || inFlight.size > 0) {
    const ready = prepared.filter(
      (p) => pending.has(p.shot.id) && !inFlight.has(p.shot.id) && depsSatisfied(p)
    );

    while (ready.length && inFlight.size < concurrency) {
      const next = ready.shift()!;
      const promise = runOne(next).finally(() => {
        inFlight.delete(next.shot.id);
      });
      inFlight.set(next.shot.id, promise);
    }

    if (inFlight.size === 0 && pending.size > 0) {
      // Deadlock / unsatisfied deps — run remaining sequentially to surface errors
      const stuck = prepared.find((p) => pending.has(p.shot.id));
      if (!stuck) break;
      await runOne(stuck);
      continue;
    }

    if (inFlight.size > 0) {
      await Promise.race(inFlight.values());
    }
  }

  return results.sort((a, b) => {
    const sa = prepared.find((p) => p.shot.id === a.shotId)?.shot.sequence ?? 0;
    const sb = prepared.find((p) => p.shot.id === b.shotId)?.shot.sequence ?? 0;
    return sa - sb;
  });
}
