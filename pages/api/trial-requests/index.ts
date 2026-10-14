import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { validateTrialRequest } from '@/lib/trial/validate';
import {
  TRIAL_REQUEST_LIMITS,
  countTrialRequestsByIp,
  findRecentPendingByEmail,
  insertTrialRequest,
  markTrialNotifyResult,
} from '@/lib/trial/store';
import { notifyTeamOfTrialRequest } from '@/lib/trial/notify';

/**
 * POST /api/trial-requests
 * Public lead capture for Free Trial. Never creates a subscription or grants credits.
 * Status is always forced to pending; clients cannot self-approve.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const validated = validateTrialRequest(req.body);
  if (!validated.ok) {
    return res.status(400).json({
      ok: false,
      error: validated.error,
      field: validated.field,
    });
  }

  const ip = getClientIp(req);
  const ipHash = hashClientIp(ip);
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  try {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [hourCount, dayCount] = await Promise.all([
      countTrialRequestsByIp(ipHash, hourAgo),
      countTrialRequestsByIp(ipHash, dayAgo),
    ]);
    if (hourCount >= TRIAL_REQUEST_LIMITS.perIpHour || dayCount >= TRIAL_REQUEST_LIMITS.perIpDay) {
      res.setHeader('Retry-After', '3600');
      return res.status(429).json({
        ok: false,
        code: 'rate_limited',
        error: 'Too many trial requests from this network. Please try again later.',
      });
    }

    const existing = await findRecentPendingByEmail(validated.value.email);
    if (existing) {
      // Retry team email if the first attempt never landed.
      if (!existing.notifySentAt) {
        const retry = await notifyTeamOfTrialRequest({
          id: existing.id,
          data: {
            fullName: existing.fullName,
            email: existing.email,
            companyName: existing.companyName,
            useCase: existing.useCase,
            websiteUrl: existing.websiteUrl,
          },
          createdAt: existing.createdAt || new Date().toISOString(),
        });
        if (retry.notified) {
          await markTrialNotifyResult(existing.id, { ok: true });
        } else if (retry.error) {
          console.warn('[trial-requests] notify retry failed', retry.error);
          await markTrialNotifyResult(existing.id, { ok: false, error: retry.error });
        }
      }
      return res.status(200).json({
        ok: true,
        reused: true,
        id: existing.id,
        message:
          'Thanks for your interest in SkalX! Your free trial request has been submitted. Our team will review your request and contact you through our official email with the next steps.',
      });
    }

    const row = await insertTrialRequest({
      data: validated.value,
      ipHash,
      userAgent,
    });

    const notify = await notifyTeamOfTrialRequest({
      id: row.id,
      data: validated.value,
      createdAt: row.createdAt || new Date().toISOString(),
    });
    if (notify.notified) {
      console.info('[trial-requests] notified', notify.provider, '→', 'info@skalxai.app');
      await markTrialNotifyResult(row.id, { ok: true });
    } else if (notify.error) {
      console.warn('[trial-requests] notify failed', notify.error);
      await markTrialNotifyResult(row.id, { ok: false, error: notify.error });
    }

    return res.status(201).json({
      ok: true,
      reused: false,
      id: row.id,
      message:
        'Thanks for your interest in SkalX! Your free trial request has been submitted. Our team will review your request and contact you through our official email with the next steps.',
    });
  } catch (e) {
    console.error('[trial-requests] create failed', (e as Error)?.message);
    return res.status(500).json({
      ok: false,
      error: "We couldn't submit your request. Please try again.",
    });
  }
}
