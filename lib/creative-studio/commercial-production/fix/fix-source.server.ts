/**
 * Resolve the video a fix starts from — always from our own records, never from a
 * bare client-supplied URL.
 *
 * - sourceKey: a finished generation or an earlier fix (stored on its generation lock)
 * - sessionId + videoId: a video made before fixing existed; it must be listed in the
 *   user's own session and stored in our campaign-assets bucket
 */

import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { GenerationLocksDAO } from "@/database/models/GenerationLocks.dao";
import { downloadVideoToBuffer, probeMediaBuffer } from "../audio/mux-voiceover";
import type { StoredEndCard } from "../campaign-executor/types";
import { detectShotCuts } from "./shots";

export interface FixSource {
  /** Key a fixed version is stored under the parent of (lock key or legacy video key). */
  sourceKey: string;
  /** The original video every fix of it counts against. */
  rootKey: string;
  /** Picture + sound without overlays — what the fix edits. */
  masterVideoUrl: string;
  finishing?: { endCard?: StoredEndCard };
  /** The stored finished commercial, copied onto the fixed version. */
  finalCommercial: Record<string, unknown> & { videoUrl: string; generationVersion?: string };
}

export type FixSourceResult =
  | { ok: true; source: FixSource }
  | { ok: false; status: number; code: string; error: string };

export type FixSourceRef = { sourceKey?: string; sessionId?: string; videoId?: string };

const NOT_FOUND: FixSourceResult = {
  ok: false,
  status: 404,
  code: "SOURCE_NOT_FOUND",
  error: "This video could not be found",
};

/** Public URL prefix of our video bucket; only these may be fetched for a legacy fix. */
function campaignAssetsPrefix(): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/campaign-assets/` : null;
}

async function resolveLegacyVideo(userId: string, sessionId: string, videoId: string): Promise<FixSourceResult> {
  const session = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);
  const videos = (session?.generatedVideos as Array<{ id?: string; url?: string; generationVersion?: string }>) || [];
  const video = videos.find((v) => v?.id === videoId);
  const prefix = campaignAssetsPrefix();
  if (!video?.url || !prefix || !video.url.startsWith(prefix)) return NOT_FOUND;
  return {
    ok: true,
    source: {
      sourceKey: `video:${sessionId}:${videoId}`,
      rootKey: `video:${sessionId}:${videoId}`,
      masterVideoUrl: video.url,
      finalCommercial: { videoUrl: video.url, generationVersion: video.generationVersion },
    },
  };
}

export async function resolveFixSource(userId: string, ref: FixSourceRef): Promise<FixSourceResult> {
  const sourceKey = ref.sourceKey || "";
  if (!/^(commercial|fix):/.test(sourceKey)) {
    if (ref.sessionId && ref.videoId) return resolveLegacyVideo(userId, ref.sessionId, ref.videoId);
    return { ok: false, status: 400, code: "INVALID_SOURCE", error: "Unknown video" };
  }
  const lock = await GenerationLocksDAO.getByKey(sourceKey);
  if (!lock || lock.userId !== userId || lock.status !== "completed") return NOT_FOUND;
  const summary = (lock.resultSummary || {}) as {
    rootKey?: string;
    finalCommercial?: FixSource["finalCommercial"] & {
      masterVideoUrl?: string;
      finishing?: FixSource["finishing"];
    };
  };
  const final = summary.finalCommercial;
  if (!final?.videoUrl) {
    if (ref.sessionId && ref.videoId) return resolveLegacyVideo(userId, ref.sessionId, ref.videoId);
    return NOT_FOUND;
  }
  return {
    ok: true,
    source: {
      sourceKey,
      rootKey: summary.rootKey || sourceKey,
      masterVideoUrl: final.masterVideoUrl || final.videoUrl,
      finishing: final.finishing,
      finalCommercial: final,
    },
  };
}

/** Shared parsing of the source fields every fix route accepts. */
export function fixSourceRefFromBody(body: Record<string, unknown>): FixSourceRef {
  const str = (v: unknown) => (typeof v === "string" && v.length < 300 ? v : undefined);
  return { sourceKey: str(body.sourceKey), sessionId: str(body.sessionId), videoId: str(body.videoId) };
}

/** Download the source once and read what every fix step needs. */
export async function loadSourceMedia(source: FixSource): Promise<{
  master: Buffer;
  durationSeconds: number;
  width?: number;
  height?: number;
  cuts: number[];
}> {
  const master = await downloadVideoToBuffer(source.masterVideoUrl);
  const probe = await probeMediaBuffer(master, "mp4");
  if (!probe.durationSeconds) throw new Error("Could not read the video length");
  const cuts = await detectShotCuts(master, probe.durationSeconds);
  return { master, durationSeconds: probe.durationSeconds, width: probe.width, height: probe.height, cuts };
}
