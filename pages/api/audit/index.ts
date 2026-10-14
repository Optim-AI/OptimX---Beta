import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ensureProfile } from '@/lib/auth/ensure-profile';
import { ensureGuestSession, readGuestSession } from '@/lib/onboarding/guest-session';
import { toPublicAudit } from '@/lib/audit/access';
import {
  classifyAuditPersistError,
  clientMessageForCode,
  logAuditApiError,
  newAuditRequestId,
} from '@/lib/audit/api-errors';
import { AUDIT_LIMITS, decideAuditRateLimit, getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { countRecentAudits, createOrReuseAudit } from '@/lib/audit/store';
import { assertPublicHost, normalizeAuditUrl, UnsafeUrlError } from '@/lib/audit/url-safety';

const HOST_MESSAGES: Record<string, string> = {
  private_address: clientMessageForCode('private_address'),
  dns: clientMessageForCode('dns'),
};

/** POST /api/audit — start (or resume) a free audit for a website. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = newAuditRequestId();
  res.setHeader('x-audit-request-id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      code: 'method_not_allowed',
      requestId,
      error: clientMessageForCode('method_not_allowed'),
    });
  }

  const check = normalizeAuditUrl(typeof req.body?.url === 'string' ? req.body.url : '');
  if (!check.ok) {
    return res.status(400).json({
      ok: false,
      code: check.reason || 'invalid_url',
      requestId,
      error: check.message || clientMessageForCode('invalid_url'),
    });
  }
  try {
    await assertPublicHost(new URL(check.url).hostname);
  } catch (e) {
    const code = e instanceof UnsafeUrlError ? e.code : 'dns';
    return res.status(400).json({
      ok: false,
      code,
      requestId,
      error: HOST_MESSAGES[code] || HOST_MESSAGES.dns,
    });
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
      try {
        const guest = await ensureGuestSession(req, res);
        actorId = guest.profileId;
        guestProfileId = guest.profileId;
      } catch (e) {
        const classified = classifyAuditPersistError(e);
        logAuditApiError({
          requestId,
          stage: 'guest_session',
          code: 'guest_session_failed',
          detail: classified.detail,
          err: e,
          host: check.host,
        });
        return res.status(classified.status === 503 ? 503 : 500).json({
          ok: false,
          code: 'guest_session_failed',
          requestId,
          error: clientMessageForCode('guest_session_failed'),
        });
      }
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
        requestId,
        error: clientMessageForCode('rate_limited'),
      });
    }

    return res.status(result.reused ? 200 : 201).json({
      ok: true,
      reused: result.reused,
      requestId,
      audit: toPublicAudit(result.row, { authUserId, guestProfileId }),
    });
  } catch (e) {
    const classified = classifyAuditPersistError(e);
    logAuditApiError({
      requestId,
      stage: 'create',
      code: classified.code,
      detail: classified.detail,
      err: e,
      host: check.host,
    });
    return res.status(classified.status).json({
      ok: false,
      code: classified.code,
      requestId,
      error: classified.message,
    });
  }
}
