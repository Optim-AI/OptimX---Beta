// GET  /api/meta-intel/instagram[?refresh=1] → watched hashtags + competitor accounts (+ you), cached 6h
// POST /api/meta-intel/instagram { action: 'add', kind, value } | { action: 'remove', id } | { action: 'style' }
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { instagramView, addWatch, removeWatch, runStyleRead, IgWatchError } from '@/lib/meta-ig/service';
import { metaLog } from '@/lib/meta/log';

// The style read looks at images with Gemini; give it time.
export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return res.status(200).json(await instagramView(userId, { force: req.query.refresh === '1' }));
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { action?: string; kind?: string; value?: string; id?: string };
      if (body.action === 'add' && (body.kind === 'hashtag' || body.kind === 'account') && typeof body.value === 'string') await addWatch(userId, body.kind, body.value);
      else if (body.action === 'remove' && typeof body.id === 'string') await removeWatch(userId, body.id);
      else if (body.action === 'style') await runStyleRead(userId);
      else return res.status(400).json({ error: 'bad_request', message: 'Unknown action.' });
      return res.status(200).json(await instagramView(userId));
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    if (err instanceof IgWatchError) return res.status(err.status).json({ error: 'ig_watch', message: err.message });
    metaLog.error('ig_watch_api_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'ig_watch_failed', message: 'Something went wrong. Please try again.' });
  }
}
