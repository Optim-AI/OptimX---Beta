/** Queue a draft round on Trigger.dev (or inline in local dev with META_SYNC_INLINE=true). */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { inlineSyncAllowed, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { runRound } from './service';
import * as store from './store';
import type { adStudioRound } from '@/trigger/ad-studio-round';

export async function enqueueRound(input: { projectId: string; round: number; size: number; feedback?: string | null }) {
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      await tasks.trigger<typeof adStudioRound>('ad-studio-round', input, { idempotencyKey: `ad-studio-${input.projectId}-${input.round}` });
    } catch (err) {
      await store.updateProject(input.projectId, { status: 'failed', error: 'Could not start. Please try again.' });
      throw err;
    }
    return;
  }
  if (!inlineSyncAllowed()) {
    await store.updateProject(input.projectId, { status: 'failed', error: 'Poster drafts are not set up yet.' });
    throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  }
  void runRound(input).catch((err) => metaLog.error('inline_round_failed', { message: (err as Error).message }));
}

import { runDraftOp, type DraftOp } from './ops';
import type { adStudioDraftOp } from '@/trigger/ad-studio-round';

export async function enqueueDraftOp(op: DraftOp) {
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      await tasks.trigger<typeof adStudioDraftOp>('ad-studio-draft-op', op, { idempotencyKey: `ad-studio-op-${op.draftId}` });
    } catch (err) {
      await store.updateDraft(op.draftId, { status: 'failed', error: 'Could not start. Please try again.' });
      throw err;
    }
    return;
  }
  if (!inlineSyncAllowed()) {
    await store.updateDraft(op.draftId, { status: 'failed', error: 'Not set up yet.' });
    throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  }
  void runDraftOp(op).catch((err) => metaLog.error('inline_draft_op_failed', { message: (err as Error).message }));
}
