/** Copies ad creative images into the private `meta-creatives` bucket (Meta CDN urls expire). */
import { createHash } from 'crypto';
import * as store from './store';
import { bump, recordError, type SyncContext } from './context';
import type { MetaConnectionRow } from '@/database/models/MetaConnection.dao';

export const CREATIVE_BUCKET = 'meta-creatives';
const MAX_BYTES = 10 * 1024 * 1024;
const PER_RUN_LIMIT = 300;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export type ImageStorage = {
  upload(path: string, body: Buffer, contentType: string): Promise<void>;
  removePrefix(prefix: string): Promise<number>;
};

async function supabaseStorage(): Promise<ImageStorage> {
  const { supabaseAdmin } = await import('@/auth/supabase/admin');
  const bucket = () => supabaseAdmin.storage.from(CREATIVE_BUCKET);
  return {
    async upload(path, body, contentType) {
      const { error } = await bucket().upload(path, body, { contentType, upsert: true, cacheControl: '86400' });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async removePrefix(prefix) {
      let removed = 0;
      for (let i = 0; i < 50; i++) {
        const { data, error } = await bucket().list(prefix, { limit: 100 });
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        const paths = data.map((f) => `${prefix}/${f.name}`);
        const { error: rmErr } = await bucket().remove(paths);
        if (rmErr) throw new Error(rmErr.message);
        removed += paths.length;
        if (data.length < 100) break;
      }
      return removed;
    },
  };
}

export function creativePrefix(userId: string, connectionId: string) {
  return `${userId}/${connectionId}`;
}

export async function copyCreativeImages(ctx: SyncContext, deps: { storage?: ImageStorage; fetchImpl?: typeof fetch } = {}) {
  const storage = deps.storage ?? (await supabaseStorage());
  const doFetch = deps.fetchImpl ?? fetch;
  const pending = await store.creativesNeedingImages(ctx.connectionId, PER_RUN_LIMIT);
  for (const c of pending) {
    if (!c.sourceImageUrl) continue;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await doFetch(c.sourceImageUrl, { signal: controller.signal }).finally(() => clearTimeout(timer));
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!res.ok || !EXT[type]) throw new Error(`image fetch ${res.status} ${type || 'no type'}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error('image too large');
      const path = `${creativePrefix(ctx.userId, ctx.connectionId)}/${c.metaId}.${EXT[type]}`;
      await storage.upload(path, buf, type);
      await store.markCreativeImageStored(ctx.connectionId, c.metaId, path, createHash('md5').update(buf).digest('hex'));
      bump(ctx, 'images_stored');
    } catch (err) {
      bump(ctx, 'images_failed');
      if ((ctx.counts.images_failed ?? 0) <= 5) recordError(ctx, 'creative_image', err, c.adAccountId);
    }
  }
}

/** Disconnect / deletion: remove every stored creative image for the connection. */
export async function removeCreativeImages(conn: Pick<MetaConnectionRow, 'id' | 'userId'>, storage?: ImageStorage) {
  const s = storage ?? (await supabaseStorage());
  return s.removePrefix(creativePrefix(conn.userId, conn.id));
}
