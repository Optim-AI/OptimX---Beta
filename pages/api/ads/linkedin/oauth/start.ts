// pages/api/ads/linkedin/oauth/start.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "@/auth/helpers";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";
import {
  getLinkedInOAuthConfig,
  isLinkedInConfigured,
  LINKEDIN_ADS_SCOPES,
} from "@/lib/ads/providers/linkedin/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isLinkedInConfigured()) {
    return res.status(503).json({
      error: "linkedin_not_configured",
      message:
        "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable LinkedIn Ads.",
    });
  }

  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);
  if (!supabaseToken) {
    return res.status(401).json({ error: "missing_auth" });
  }

  const { clientId } = getLinkedInOAuthConfig();
  const origin = resolveRequestOrigin(req);
  const redirectUri = `${origin}/api/ads/linkedin/oauth/callback`;
  const state = encodeState({
    r: Math.random().toString(36).slice(2, 12),
    p: "linkedin",
    t: supabaseToken,
  });

  const url =
    `https://www.linkedin.com/oauth/v2/authorization` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(LINKEDIN_ADS_SCOPES)}`;

  res.redirect(url);
}
