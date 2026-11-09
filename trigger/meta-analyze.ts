/** Trigger.dev task: AI analysis of a brand's Meta data (Claude). */
import { logger, queue, task } from '@trigger.dev/sdk';
import { runAnalysis } from '@/lib/meta-intel/analyze';

const metaAnalyzeQueue = queue({ name: 'meta-analyze', concurrencyLimit: 2 });

export const metaAnalyzeConnection = task({
  id: 'meta-analyze-connection',
  queue: metaAnalyzeQueue,
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 30_000, maxTimeoutInMs: 120_000, factor: 2 },
  run: async (payload: { userId: string; trigger: 'sync' | 'manual'; force?: boolean }) => {
    const result = await runAnalysis(payload);
    logger.info('meta analysis finished', { ...result });
    return result;
  },
});
