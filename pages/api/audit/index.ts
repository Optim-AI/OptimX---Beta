import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ensureProfile } from '@/lib/auth/ensure-profile';
import { ensureGuestSession, readGuestSession } from '@/lib/onboarding/guest-session';
import { toPublicAudit } from '@/lib/audit/access';
import { AUDIT_LIMITS, decideAuditRateLimit, getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { countRecentAudits, createOrReuseAudit } from '@/lib/audit/store';
import { assertPublicHost, normalizeAuditUrl, UnsafeUrlError } from '@/lib/audit/url-safety';

const HOST_MESSAGES: Record<string, string> = {
  private_address: 'That address points to a private or internal network.',
  dns: "We couldn't find that website. Check the spelling and try again.",
};

/** POST /api/audit — start (or resume) a free audit for a website. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const check = normalizeAuditUrl(req.body?.url);
  if (!check.ok) {
    return res.status(400).json({ ok: false, code: check.reason, error: check.message });
  }
  try {
    await assertPublicHost(new URL(check.url).hostname);
  } catch (e) {
    const code = e instanceof UnsafeUrlError ? e.code : 'dns';
    return res.status(400).json({ ok: false, code, error: HOST_MESSAGES[code] || HOST_MESSAGES.dns });
  }

  try {
    const authUserId = await getUserIdFromRequest(req);
    let actorId: string;
    let guestProfileId: string | null = null;
    if (authUserId) {
      await ensureProfile(authUserId);
      actorId = authUserId;
      guestProfileId = (await readGuestSession(req))?.profileId ?? null;
    } else {
      const guest = await ensureGuestSession(req, res);
      actorId = guest.profileId;
      guestProfileId = guest.profileId;
    }

    const ipHash = hashClientIp(getClientIp(req));
    let retryAfter = 0;
    const result = await createOrReuseAudit({
      ownerIds: [actorId, guestProfileId].filter((v): v is string => Boolean(v)),
      actorId,
      websiteUrl: check.url,
      host: check.host,
      ipHash,
      beforeInsert: async () => {
        const decision = decideAuditRateLimit(await countRecentAudits(actorId, ipHash), AUDIT_LIMITS);
        if (!decision.allowed) retryAfter = decision.retryAfterSeconds;
        return { allowed: decision.allowed };
      },
    });

    if ('limited' in result) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        ok: false,
        code: 'rate_limited',
        error: "You've run several audits recently. Please try again later.",
      });
    }

    return res.status(result.reused ? 200 : 201).json({
      ok: true,
      reused: result.reused,
      audit: toPublicAudit(result.row, { authUserId, guestProfileId }),
    });
  } catch (e) {
    console.error('[audit] create failed', (e as Error)?.message);
    return res.status(500).json({ ok: false, code: 'server_error', error: "We couldn't start your audit. Please try again." });
  }
}
