/**
 * Keep-to-pay for Photo Studio, the same way Ad Studio posters work:
 * photos are free to make; the full-quality file and its watermarked preview go to the
 * PRIVATE `ad-drafts` bucket; the browser only ever gets the preview until the photo is
 * kept (1 image credit), when the full file is copied to the public bucket.
 */

import { makePreview } from "@/lib/ad-studio/preview";
import { registerSkalxAssetHash } from "@/lib/meta-sync/asset-hash";
import type { PhotoView, ShotResult } from "./types";

export const DRAFT_BUCKET = "ad-drafts";
export const PUBLIC_BUCKET = "campaign-assets";
const PREVIEW_URL_TTL = 60 * 60;

/** Drafts are free, so they are capped (kept photos are paid and never count against anyone). */
export const FREE_PHOTOS_PER_SHOOT_PER_DAY = 24;
export const FREE_PHOTOS_PER_USER_PER_DAY = 60;
export const MIN_CREDITS_TO_SHOOT = 1;

async function admin() {
  return (await import("@/auth/supabase/admin")).supabaseAdmin;
}

/** A photo made before keep-to-pay has no `kept` flag and was already delivered in full. */
export function isKept(r: ShotResult): boolean {
  return r.kept !== false;
}

/** Stable id for a photo (older photos are identified by their address). */
export function photoId(r: ShotResult): string {
  return r.id || r.url;
}

export const draftPrefix = (userId: string, sessionId: string) => `${userId}/photo-${sessionId}`;
export const publicPrefix = (userId: string, sessionId: string) => `photo-studio/${userId}/${sessionId}`;

/** Store a new photo privately with its watermarked preview. */
export async function storeDraftPhoto(userId: string, sessionId: string, id: string, buffer: Buffer): Promise<{ storagePath: string; previewPath: string }> {
  const sb = await admin();
  const storagePath = `${draftPrefix(userId, sessionId)}/${id}.png`;
  const previewPath = `${draftPrefix(userId, sessionId)}/${id}.preview.jpg`;
  const up = await sb.storage.from(DRAFT_BUCKET).upload(storagePath, buffer, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`Photo upload failed: ${up.error.message}`);
  const preview = await makePreview(buffer, "Keep it to get the full photo");
  const pv = await sb.storage.from(DRAFT_BUCKET).upload(previewPath, preview, { contentType: "image/jpeg", upsert: true });
  if (pv.error) throw new Error(`Preview upload failed: ${pv.error.message}`);
  return { storagePath, previewPath };
}

/** The full-quality file of a draft (server-side only: edits work from it). */
export async function loadDraftPhoto(storagePath: string): Promise<Buffer> {
  const sb = await admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Could not read the photo: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signPreviews(previewPaths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!previewPaths.length) return out;
  const sb = await admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).createSignedUrls(previewPaths, PREVIEW_URL_TTL);
  if (error) throw new Error(error.message);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/** Copy a kept photo's full file to the public bucket; returns its public address. */
export async function publishKeptPhoto(userId: string, sessionId: string, r: ShotResult): Promise<string> {
  if (!r.storagePath) throw new Error("Photo has no stored file");
  const sb = await admin();
  const buffer = await loadDraftPhoto(r.storagePath);
  const path = `${publicPrefix(userId, sessionId)}/${photoId(r)}.png`;
  const up = await sb.storage.from(PUBLIC_BUCKET).upload(path, buffer, { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (up.error) throw new Error(`Publish failed: ${up.error.message}`);
  await registerSkalxAssetHash({ userId, buffer, source: "photo_studio", storagePath: path });
  return sb.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type PreviewSigner = (previewPaths: string[]) => Promise<Map<string, string>>;

/**
 * What the browser gets: drafts carry a (short-lived) preview address, kept photos their
 * full file. Storage paths never leave the server.
 */
export async function toPhotoViews(results: ShotResult[], sign: PreviewSigner = signPreviews): Promise<PhotoView[]> {
  const drafts = results.filter((r) => !isKept(r) && r.previewPath);
  const signed = await sign(drafts.map((r) => r.previewPath!)).catch(() => new Map<string, string>());
  return results.map((r) => {
    const { storagePath: _s, previewPath, published: _p, ...rest } = r;
    const kept = isKept(r);
    return { ...rest, id: photoId(r), kept, url: kept ? r.url : (previewPath && signed.get(previewPath)) || "" };
  });
}

/** Photos made in the last 24 hours (free drafts are capped per day). */
export function photosInLastDay(results: ShotResult[], now = Date.now()): number {
  const since = now - 24 * 60 * 60 * 1000;
  return results.filter((r) => r.kept !== undefined && Date.parse(r.createdAt) >= since).length;
}

/** Remove every stored file of a shoot (drafts, previews and kept photos). Best effort. */
export async function removeShootFiles(userId: string, sessionId: string): Promise<void> {
  const sb = await admin();
  for (const [bucket, prefix] of [
    [DRAFT_BUCKET, draftPrefix(userId, sessionId)],
    [PUBLIC_BUCKET, publicPrefix(userId, sessionId)],
  ] as const) {
    const { data } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (data?.length) await sb.storage.from(bucket).remove(data.map((f) => `${prefix}/${f.name}`));
  }
}
