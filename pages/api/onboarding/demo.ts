/**
 * POST /api/onboarding/demo
 * Isolated one-shot onboarding creative-set demo (Phase 12).
 * Server decides eligibility — browser cannot skip billing or force completion.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import {
  OnboardingDemoError,
  runOnboardingPosterDemo,
} from '@/lib/onboarding/demo-poster';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
  maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Ignore any client-supplied userId / skipCredits / assetRef
  if (req.body && typeof req.body === 'object') {
    if ('userId' in req.body || 'user_id' in req.body) {
      console.warn('[onboarding/demo] ignored client-supplied user id');
    }
    if ('skipCredits' in req.body || 'skipBilling' in req.body) {
      console.warn('[onboarding/demo] ignored client billing bypass attempt');
    }
  }

  try {
    const result = await runOnboardingPosterDemo(userId);
    return res.status(200).json({
      success: true,
      reused: result.reused,
      brandName: result.brandName,
      demo: result.demo,
    });
  } catch (err: unknown) {
    if (err instanceof OnboardingDemoError) {
      return res.status(err.httpStatus).json({
        success: false,
        error: err.message,
        code: err.code,
        demo: err.demo || null,
      });
    }
    console.error('[onboarding/demo] unexpected error', err);
    const raw = err instanceof Error ? err.message : '';
    // Never surface SQL / Drizzle internals to the browser.
    const isSchemaGap =
      /generation_job_locks|Failed query|relation .* does not exist/i.test(raw);
    return res.status(500).json({
      success: false,
      error: isSchemaGap
        ? 'Onboarding demo is temporarily unavailable. Please try again shortly.'
        : 'Demo generation failed',
      code: isSchemaGap ? 'SCHEMA_UNAVAILABLE' : 'INTERNAL',
    });
  }
}
