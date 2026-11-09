/** Build a Monday brief in the background (same Vercel function, see lib/jobs/background). */
import { runInBackground } from '@/lib/jobs/background';
import { runWeeklyBrief } from './run';

export async function enqueueBrief(input: { userId: string; trigger: 'schedule' | 'manual'; send: boolean }): Promise<void> {
  runInBackground('monday-brief', () => runWeeklyBrief(input));
}
