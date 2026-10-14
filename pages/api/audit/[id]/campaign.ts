import type { NextApiRequest, NextApiResponse } from 'next';
import { CreativeStudioSessionDAO } from '@/database/models/CreativeStudioSession.dao';
import { DEFAULT_AD_BUILDER_DATA } from '@/app/web/src/components/creative-studio/ad-builder-defaults';
import { claimGuestSession } from '@/lib/onboarding/guest-session';
import { campaignAccess } from '@/lib/audit/access';
import { buildCampaignSessionPayload, campaignPath } from '@/lib/audit/campaign';
import { getAudit, getAuditViewer, lockAuditCampaign, setAuditCampaign } from '@/lib/audit/store';
import type { AuditBrand, ContentIdea } from '@/lib/audit/types';

/**
 * POST /api/audit/:id/campaign — turn the selected idea into a draft Creative
 * Studio session for the signed-in owner. Claims a guest-owned audit first.
 * Idempotent: repeated calls return the same session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const id = String(req.query.id || '');
  try {
    const viewer = await getAuditViewer(req);
    let row = await getAudit(id);
    if (!row) return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });

    const access = campaignAccess(row.userId, viewer);
    if (access === 'forbidden') {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });
    }
    if (access === 'needs_auth') {
      return res.status(401).json({ ok: false, code: 'auth_required', error: 'Create a free account to continue.' });
    }
    let claimed = false;
    if (access === 'needs_claim') {
      claimed = (await claimGuestSession(req, res, viewer.authUserId!)).claimed;
      row = await getAudit(id);
      if (!row || row.userId !== viewer.authUserId) {
        return res.status(409).json({ ok: false, code: 'claim_failed', error: "We couldn't attach this audit to your account." });
      }
    }
    const userId = viewer.authUserId!;

    if (row.campaignSessionId) {
      const existing = await CreativeStudioSessionDAO.getById(row.campaignSessionId);
      if (existing && existing.userId === userId) {
        const type = existing.sessionType === 'video' ? 'video' : 'poster';
        return res.status(200).json({ ok: true, claimed, sessionId: existing.id, sessionType: type, path: campaignPath(type, existing.id) });
      }
    }

    const requested = req.body?.index;
    const index = Number.isInteger(requested) ? Number(requested) : row.selectedIdeaIndex;
    const ideas = (Array.isArray(row.ideas) ? row.ideas : []) as ContentIdea[];
    if (index == null || index < 0 || index > 2 || !ideas[index]) {
      return res.status(400).json({ ok: false, code: 'no_idea', error: 'Pick an idea to continue.' });
    }

    if (!(await lockAuditCampaign(id, userId))) {
      return res.status(409).json({ ok: false, code: 'in_progress', error: 'Your campaign is already being created.' });
    }
    try {
      const payload = buildCampaignSessionPayload({
        userId,
        idea: ideas[index],
        brand: (row.brand as AuditBrand | null) ?? null,
        websiteUrl: row.websiteUrl,
        host: row.normalizedHost,
        defaultAdBuilderData: DEFAULT_AD_BUILDER_DATA as unknown as Record<string, unknown>,
      });
      let name = payload.name;
      for (let n = 2; n < 50 && (await CreativeStudioSessionDAO.existsByNameAndType(userId, name, payload.sessionType)); n++) {
        name = `${payload.name} (${n})`;
      }
      const session = await CreativeStudioSessionDAO.create({ ...payload, name });
      await setAuditCampaign(id, session.id);
      return res.status(201).json({
        ok: true,
        claimed,
        sessionId: session.id,
        sessionType: payload.sessionType,
        path: campaignPath(payload.sessionType, session.id),
      });
    } catch (e) {
      await setAuditCampaign(id, null);
      throw e;
    }
  } catch (e) {
    console.error('[audit] campaign failed', (e as Error)?.message);
    return res.status(500).json({ ok: false, code: 'server_error', error: "We couldn't start your campaign. Please try again." });
  }
}
