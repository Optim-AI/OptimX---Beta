// GET /api/meta-intel/post-stats → what kind of post does best (format, day, time), last 90 days, per platform.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { loadRecentPosts, postStats, POSTS_RANGE_DAYS, type PostStats } from '@/lib/meta-intel/analysis-input';
import { metaLog } from '@/lib/meta/log';

export type PostStatsResponse = { rangeDays: number; platforms: PostStats[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const conn = await MetaConnectionDAO.getByUser(userId);
    if (!conn) return res.status(404).json({ error: 'not_connected' });
    const { posts } = await loadRecentPosts(conn.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ rangeDays: POSTS_RANGE_DAYS, platforms: postStats(posts) } satisfies PostStatsResponse);
  } catch (err) {
    metaLog.error('post_stats_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'post_stats_failed' });
  }
}
