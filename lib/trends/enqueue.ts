/** Run a brand's trends check in the background (same Vercel function, see lib/jobs/background). */
import { runInBackground } from '@/lib/jobs/background';
import { runBrandTrends } from './service';

export async function enqueueBrandTrends(ideasId: string): Promise<void> {
  runInBackground('trends-brand', () => runBrandTrends({ ideasId }));
}
