/** Queue a brand's trends run on Trigger.dev (or inline in local dev with META_SYNC_INLINE=true). */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { inlineSyncAllowed, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { db } from '@/database/client';
import { brandTrendIdeas } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { runBrandTrends } from './service';
import type { trendsBrand } from '@/trigger/trends';

export async function enqueueBrandTrends(ideasId: string): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      await tasks.trigger<typeof trendsBrand>('trends-brand', { ideasId }, { idempotencyKey: `trends-${ideasId}` });
    } catch (err) {
      await db.update(brandTrendIdeas).set({ status: 'failed', error: 'Could not start. Please try again.', finishedAt: new Date().toISOString() }).where(eq(brandTrendIdeas.id, ideasId));
      throw err;
    }
    return;
  }
  if (!inlineSyncAllowed()) {
    await db.update(brandTrendIdeas).set({ status: 'failed', error: 'Trends are not set up yet.', finishedAt: new Date().toISOString() }).where(eq(brandTrendIdeas.id, ideasId));
    throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  }
  void runBrandTrends({ ideasId }).catch((err) => metaLog.error('inline_trends_failed', { message: (err as Error).message }));
}
