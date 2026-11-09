/**
 * Remembers the MD5 of images SkalX generates so synced Meta ads using the exact same
 * file can be tagged made_by_skalx. Never throws: generation must not fail because of this.
 */
import { createHash } from 'crypto';

export function md5Hex(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex');
}

export async function registerSkalxAssetHash(input: { userId: string; buffer: Buffer; source: string; storagePath?: string | null }): Promise<void> {
  try {
    const [{ db }, { skalxAssetHashes }] = await Promise.all([import('@/database/client'), import('@/database/schema')]);
    await db.insert(skalxAssetHashes)
      .values({ userId: input.userId, md5: md5Hex(input.buffer), source: input.source, storagePath: input.storagePath ?? null })
      .onConflictDoNothing();
  } catch (err) {
    console.warn('[meta] asset_hash_register_failed', { source: input.source, message: (err as Error).message });
  }
}
