/** Trigger.dev task: generate a test pack's posters (3 angles × feed + story) and its ZIP. */
import { logger, queue, task } from '@trigger.dev/sdk';
import { runPackGeneration } from '@/lib/test-packs/service';

const testPackQueue = queue({ name: 'test-pack', concurrencyLimit: 2 });

export const testPackGenerate = task({
  id: 'test-pack-generate',
  queue: testPackQueue,
  maxDuration: 3600,
  retry: { maxAttempts: 1 }, // credits are charged per poster; never retry the whole pack automatically
  run: async (payload: { packId: string }) => {
    const result = await runPackGeneration(payload.packId);
    logger.info('test pack finished', { packId: payload.packId, ...result });
    return result;
  },
});
