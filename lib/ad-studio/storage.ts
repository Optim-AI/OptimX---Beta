/**
 * Draft storage: full-quality posters and their watermarked previews go to the PRIVATE
 * `ad-drafts` bucket. Keeping a draft copies the full image to the public `campaign-assets`
 * bucket (like every other SkalX poster) and registers it for "Made by SkalX" matching.
 */
import { createHash } from 'crypto';
import { makePreview } from './preview';
import { registerSkalxAssetHash } from '@/lib/meta-sync/asset-hash';

export const DRAFT_BUCKET = 'ad-drafts';
export const PUBLIC_BUCKET = 'campaign-assets';
const INTERNAL_URL_TTL = 7 * 24 * 60 * 60; // engine QC + edits read the full image server-side
const PREVIEW_URL_TTL = 60 * 60;

async function admin() {
  return (await import('@/auth/supabase/admin')).supabaseAdmin;
}

export const previewPathFor = (fullPath: string) => `${fullPath.replace(/\.[a-z]+$/i, '')}.preview.jpg`;

/** Drop-in replacement for the engine's storePosterGeneratedImage (same input/output shape). */
export async function storeDraftImage(options: {
  userId: string;
  sessionId: string;
  generationId: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const sb = await admin();
  const contentType = options.contentType || 'image/png';
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
  const storagePath = `${options.userId}/${options.sessionId}/${options.generationId}.${ext}`;
  const up = await sb.storage.from(DRAFT_BUCKET).upload(storagePath, options.buffer, { contentType, upsert: true });
  if (up.error) throw new Error(`Draft upload failed: ${up.error.message}`);
  // Scene layers (generationId ending "-scene") don't need a preview.
  if (!options.generationId.endsWith('-scene')) {
    const preview = await makePreview(options.buffer);
    const pv = await sb.storage.from(DRAFT_BUCKET).upload(previewPathFor(storagePath), preview, { contentType: 'image/jpeg', upsert: true });
    if (pv.error) throw new Error(`Preview upload failed: ${pv.error.message}`);
  }
  const signed = await sb.storage.from(DRAFT_BUCKET).createSignedUrl(storagePath, INTERNAL_URL_TTL);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`Draft signing failed: ${signed.error?.message}`);
  return { publicUrl: signed.data.signedUrl, storagePath };
}

export async function signedPreviewUrls(previewPaths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!previewPaths.length) return out;
  const sb = await admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).createSignedUrls(previewPaths, PREVIEW_URL_TTL);
  if (error) throw new Error(error.message);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/** Publish a kept draft: private full image → public bucket, plus the SKX image fingerprint. */
export async function publishKeptDraft(userId: string, storagePath: string, source = 'ad_studio_poster'): Promise<{ url: string; path: string; md5: string }> {
  const sb = await admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Could not read the draft: ${error?.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || 'image/png';
  const path = `ad-studio/${storagePath}`;
  const up = await sb.storage.from(PUBLIC_BUCKET).upload(path, buffer, { contentType, upsert: true, cacheControl: '3600' });
  if (up.error) throw new Error(`Publish failed: ${up.error.message}`);
  await registerSkalxAssetHash({ userId, buffer, source, storagePath: path });
  return { url: sb.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl, path, md5: createHash('md5').update(buffer).digest('hex') };
}
