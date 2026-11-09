// Shared error mapping for /api/test-packs/* routes.
import type { NextApiResponse } from 'next';
import { TestPackError } from '@/lib/test-packs/service';
import { SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { metaLog } from '@/lib/meta/log';

export function sendError(res: NextApiResponse, err: unknown, where: string) {
  if (err instanceof TestPackError) return res.status(err.status).json({ error: err.code ?? 'test_pack_error', message: err.message });
  if (err instanceof SyncNotConfiguredError) return res.status(503).json({ error: 'not_configured', message: 'Generating test packs is not set up yet. Please contact support.' });
  metaLog.error(`test_pack_${where}_failed`, { message: (err as Error).message });
  return res.status(500).json({ error: 'failed', message: 'Something went wrong. Please try again.' });
}
