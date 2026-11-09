/** Run an AI analysis in the background (same Vercel function, see lib/jobs/background). */
import { runInBackground } from '@/lib/jobs/background';
import { runAnalysis } from './analyze';

export async function enqueueAnalysis(input: { userId: string; trigger: 'sync' | 'manual'; force?: boolean }): Promise<void> {
  runInBackground('meta-analyze', () => runAnalysis(input));
}
