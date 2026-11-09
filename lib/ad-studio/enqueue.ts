/** Start a draft round or a draft edit/size in the background (same Vercel function, see lib/jobs/background). */
import { runInBackground } from '@/lib/jobs/background';
import { runRound } from './service';
import { runDraftOp, type DraftOp } from './ops';

export async function enqueueRound(input: { projectId: string; round: number; size: number; feedback?: string | null }) {
  runInBackground('ad-studio-round', () => runRound(input));
}

export async function enqueueDraftOp(op: DraftOp) {
  runInBackground('ad-studio-draft-op', () => runDraftOp(op));
}
