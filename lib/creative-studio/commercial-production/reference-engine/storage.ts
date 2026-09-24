/**
 * Keyframe storage + in-memory idempotency for Phase 4.
 * Reuses campaign-assets bucket (same as poster generation).
 * Supabase is loaded lazily so unit tests can run without env.
 */

import type { KeyframeResult } from "./types";

const APPROVED_CACHE = new Map<string, KeyframeResult>();

export function keyframeIdempotencyKey(input: {
  campaignId: string;
  shotId: string;
  generationVersion?: string;
  attempt?: number;
}): string {
  const version = input.generationVersion || "v1";
  const attempt = input.attempt ?? 0;
  return `${input.campaignId}:${input.shotId}:${version}:a${attempt}`;
}

export function getCachedApprovedKeyframe(
  campaignId: string,
  shotId: string
): KeyframeResult | undefined {
  return APPROVED_CACHE.get(`${campaignId}:${shotId}`);
}

export function cacheApprovedKeyframe(result: KeyframeResult): void {
  if (result.status === "approved") {
    APPROVED_CACHE.set(`${result.campaignId}:${result.shotId}`, result);
  }
}

export function clearKeyframeCache(campaignId?: string): void {
  if (!campaignId) {
    APPROVED_CACHE.clear();
    return;
  }
  for (const key of APPROVED_CACHE.keys()) {
    if (key.startsWith(`${campaignId}:`)) APPROVED_CACHE.delete(key);
  }
}

export async function storeKeyframeBuffer(input: {
  buffer: Buffer;
  campaignId: string;
  shotId: string;
  attempt: number;
  userId?: string;
}): Promise<{ url: string; storagePath: string; assetId: string } | null> {
  const uid = input.userId || "system";
  const storagePath = `generated/${uid}/keyframes/${input.campaignId}/${input.shotId}_a${input.attempt}_${Date.now()}.png`;
  try {
    const { supabaseAdmin } = await import("@/auth/supabase/admin");
    const { error } = await supabaseAdmin.storage
      .from("campaign-assets")
      .upload(storagePath, input.buffer, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(storagePath);
    const url = (data as { publicUrl?: string })?.publicUrl;
    if (!url) return null;
    return {
      url,
      storagePath,
      assetId: `kf_${input.campaignId}_${input.shotId}_a${input.attempt}`,
    };
  } catch (e) {
    console.warn("[reference-engine] keyframe storage failed:", e);
    return null;
  }
}
