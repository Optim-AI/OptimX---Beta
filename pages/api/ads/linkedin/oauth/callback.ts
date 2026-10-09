import type { NextApiRequest, NextApiResponse } from "next";
import { decodeState } from "@/auth/helpers";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";
import { OAuthSessionDAO } from "@/database";
import { saveIntegration, setUserStatusForUser } from "@/integrations/store";
import { getLinkedInOAuthConfig } from "@/lib/ads/providers/linkedin/client";
import { linkedInAdsProvider } from "@/lib/ads/providers/linkedin/provider";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.query.error) {
      return res.redirect(
        `/integrations?connected=linkedin&status=error&reason=${encodeURIComponent(
          String(req.query.error)
        )}`
      );
    }

    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) return res.status(400).send("Missing code");

    const stateObj = decodeState(req.query.state);
    const supabaseToken = stateObj?.t;
    if (!supabaseToken) return res.status(400).send("Missing auth state");

    const { data, error } = await supabaseAdmin.auth.getUser(supabaseToken);
    if (error || !data?.user?.id) return res.status(401).send("Invalid session");
    const userId = data.user.id;

    const { clientId, clientSecret } = getLinkedInOAuthConfig();
    const origin = resolveRequestOrigin(req);
    const redirectUri = `${origin}/api/ads/linkedin/oauth/callback`;

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("[linkedin oauth] token failed", tokenJson);
      return res.redirect(`/integrations?connected=linkedin&status=error&reason=token`);
    }

    const expiresAt = new Date(
      Date.now() + (tokenJson.expires_in ?? 5184000) * 1000
    ).toISOString();

    const integration = await saveIntegration(
      {
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
        pageAccessToken: tokenJson.access_token,
        userAccessToken: tokenJson.refresh_token || null,
        tokenExpiresAt: expiresAt,
        scopes: String(tokenJson.scope || "").split(/[\s,]+/).filter(Boolean),
        healthStatus: "healthy",
        lastHealthCheck: new Date().toISOString(),
        raw: { tokenType: tokenJson.token_type },
      },
      { userId, provider: "linkedin" }
    );

    let accounts: any[] = [];
    let discoverError: string | null = null;
    try {
      accounts = await linkedInAdsProvider.listAdAccounts({
        userId,
        integrationId: integration.id,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
      });
      await AdAccountDAO.upsertDiscovered(integration.id, "linkedin", accounts);
    } catch (e: any) {
      discoverError = e?.message || String(e);
    }

    await setUserStatusForUser(userId, "linkedin", true).catch(() => {});

    const sessionId = `oauth_li_${userId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await OAuthSessionDAO.store(
      sessionId,
      userId,
      "linkedin",
      {
        userId,
        integrationId: integration.id,
        accounts: accounts.map((a) => ({
          accountId: a.accountId,
          name: a.name,
          currency: a.currency,
          status: a.status,
        })),
        discoverError,
      },
      new Date(Date.now() + 15 * 60 * 1000)
    );

    return res.redirect(
      `/integrations/linkedin/select-account?sessionId=${encodeURIComponent(sessionId)}`
    );
  } catch (err: any) {
    console.error("[linkedin oauth callback]", err);
    return res.redirect(`/integrations?connected=linkedin&status=error&reason=callback`);
  }
}
