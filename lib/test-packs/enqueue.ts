/** Queue test pack generation on Trigger.dev (or inline in local dev with META_SYNC_INLINE=true). */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { inlineSyncAllowed, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { runPackGeneration } from './service';
import * as store from './store';
import type { testPackGenerate } from '@/trigger/test-pack';

export async function enqueuePackGeneration(packId: string): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      await tasks.trigger<typeof testPackGenerate>('test-pack-generate', { packId }, { idempotencyKey: `test-pack-${packId}-${Date.now()}` });
    } catch (err) {
      await store.updatePack(packId, { status: 'failed', error: 'Could not start generating. Please try again.' });
      throw err;
    }
    return;
  }
  if (!inlineSyncAllowed()) {
    await store.updatePack(packId, { status: 'draft' });
    throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  }
  void runPackGeneration(packId).catch((err) => metaLog.error('inline_pack_failed', { packId, message: (err as Error).message }));
}
