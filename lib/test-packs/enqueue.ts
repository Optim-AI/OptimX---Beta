/** Generate a test pack in the background (same Vercel function, see lib/jobs/background). */
import { runInBackground } from '@/lib/jobs/background';
import { runPackGeneration } from './service';

export async function enqueuePackGeneration(packId: string): Promise<void> {
  runInBackground('test-pack', () => runPackGeneration(packId));
}
