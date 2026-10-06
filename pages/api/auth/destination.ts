// pages/api/auth/destination.ts
// Authenticated post-auth destination. Never invents "new user" on DB failure.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getTokenFromReq, getUserIdFromRequest } from '@/auth/request';
import { ensureProfile } from '@/lib/auth/ensure-profile';
import {
  postAuthRedirectPath,
  resolvePostAuthDestination,
} from '@/lib/auth/post-auth-destination';
import { supabaseAdmin } from '@/auth/supabase/admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    let email: string | null = null;
    let fullName: string | null = null;
    try {
      const token = getTokenFromReq(req);
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        email = data?.user?.email ?? null;
        const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
        const name =
          (typeof meta.full_name === 'string' && meta.full_name) ||
          (typeof meta.name === 'string' && meta.name) ||
          null;
        fullName = name;
      }
    } catch {
      /* ensureProfile can still insert with id only */
    }

    await ensureProfile(userId, { email, fullName });

    const decision = await resolvePostAuthDestination(userId);
    if (!decision.ok) {
      return res.status(503).json({
        ok: false,
        error: decision.error,
      });
    }

    return res.status(200).json({
      ok: true,
      destination: decision.destination,
      step: decision.step ?? null,
      path: postAuthRedirectPath(decision),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to resolve destination';
    console.error('[api/auth/destination]', message);
    return res.status(503).json({
      ok: false,
      error: 'Could not determine where to send you. Please try again.',
    });
  }
}
