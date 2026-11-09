// Error mapping for /api/ad-studio/* routes.
import type { NextApiResponse } from 'next';
import { AdStudioError } from './service';
import { SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { metaLog } from '@/lib/meta/log';

export function sendError(res: NextApiResponse, err: unknown, where: string) {
  if (err instanceof AdStudioError) return res.status(err.status).json({ error: err.code ?? 'ad_studio_error', message: err.message });
  if (err instanceof SyncNotConfiguredError) return res.status(503).json({ error: 'not_configured', message: 'Poster drafts are not set up yet. Please contact support.' });
  metaLog.error(`ad_studio_${where}_failed`, { message: (err as Error).message });
  return res.status(500).json({ error: 'failed', message: 'Something went wrong. Please try again.' });
}
