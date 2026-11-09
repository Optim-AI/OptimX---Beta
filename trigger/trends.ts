/** Trigger.dev task: today's trends for one brand (shared daily search per category + brand fit). */
import { logger, queue, task } from '@trigger.dev/sdk';
import { runBrandTrends } from '@/lib/trends/service';

const trendsQueue = queue({ name: 'trends', concurrencyLimit: 3 });

export const trendsBrand = task({
  id: 'trends-brand',
  queue: trendsQueue,
  maxDuration: 900,
  // No automatic retry: the job records a friendly failure and the owner can refresh.
  retry: { maxAttempts: 1 },
  run: async (payload: { ideasId: string }) => {
    await runBrandTrends(payload);
    logger.info('brand trends finished', payload);
  },
});
