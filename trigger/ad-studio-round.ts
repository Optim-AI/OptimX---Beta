/** Trigger.dev task: research a round of angles and draw the draft posters (no credits charged). */
import { logger, queue, task } from '@trigger.dev/sdk';
import { runRound } from '@/lib/ad-studio/service';

const adStudioQueue = queue({ name: 'ad-studio-round', concurrencyLimit: 3 });

export const adStudioRound = task({
  id: 'ad-studio-round',
  queue: adStudioQueue,
  maxDuration: 1800,
  retry: { maxAttempts: 1 },
  run: async (payload: { projectId: string; round: number; size: number; feedback?: string | null }) => {
    const result = await runRound(payload);
    logger.info('ad studio round', { ...payload, ...result });
    return result;
  },
});

import { runDraftOp, type DraftOp } from '@/lib/ad-studio/ops';

/** Edits (free drafts) and extra sizes for kept posters (1 credit, charged when it comes out). */
export const adStudioDraftOp = task({
  id: 'ad-studio-draft-op',
  queue: adStudioQueue,
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async (payload: DraftOp) => {
    const result = await runDraftOp(payload);
    logger.info('ad studio draft op', { kind: payload.kind, draftId: payload.draftId, ...result });
    return result;
  },
});
