// POST /api/meta-intel/assets — save the picker selection.
// Body: { adAccountIds: string[], pageId: string | null, igAccountId: string | null }
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { MetaConnectionDAO } from '@/database';
import { getMetaStatus } from '@/lib/meta/status';
import { metaLog } from '@/lib/meta/log';
import { enqueueSync, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';

const isId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,30}$/.test(v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const adAccountIds = Array.isArray(body.adAccountIds) ? body.adAccountIds.filter(isId) : [];
  const pageId = isId(body.pageId) ? body.pageId : null;
  const igAccountId = isId(body.igAccountId) ? body.igAccountId : null;
  if (!adAccountIds.length && !pageId && !igAccountId) {
    return res.status(400).json({ error: 'empty_selection', message: 'Choose at least one ad account, Page or Instagram account.' });
  }

  try {
    const assets = await MetaConnectionDAO.listAssets(userId);
    const has = (kind: string, id: string) => assets.some((a) => a.kind === kind && a.metaId === id);
    if (adAccountIds.some((id) => !has('ad_account', id)) || (pageId && !has('page', pageId)) || (igAccountId && !has('ig_account', igAccountId))) {
      return res.status(400).json({ error: 'unknown_asset', message: 'That account is no longer available. Please reconnect.' });
    }
    const conn = await MetaConnectionDAO.saveSelection(userId, { adAccountIds, pageId, igAccountId });
    if (!conn) return res.status(404).json({ error: 'not_connected' });
    metaLog.info('selection_saved', { userId, adAccounts: adAccountIds.length, page: !!pageId, ig: !!igAccountId });
    // Kick off the first (or a fresh) sync. Failure to queue must not undo the selection.
    let syncQueued = false;
    try {
      syncQueued = (await enqueueSync({ connectionId: conn.id, userId, trigger: 'initial' })).queued;
    } catch (err) {
      if (!(err instanceof SyncNotConfiguredError)) metaLog.error('initial_sync_enqueue_failed', { userId, message: (err as Error).message });
    }
    return res.status(200).json({ ...(await getMetaStatus(userId)), syncQueued });
  } catch (err) {
    metaLog.error('selection_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'selection_failed' });
  }
}
