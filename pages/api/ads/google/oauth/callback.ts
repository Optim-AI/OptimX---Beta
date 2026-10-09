// pages/api/ads/google/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { decodeState } from "@/auth/helpers";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";
import { OAuthSessionDAO } from "@/database";
import { saveIntegration, setUserStatusForUser } from "@/integrations/store";
import { googleAdsProvider } from "@/lib/ads/providers/google/provider";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";

/**
 * Exchanges code → tokens, stores encrypted credentials on integrations,
 * discovers customers, redirects to account selection.
 * Does NOT use browser cookies for tokens.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).send("GOOGLE_ADS_CLIENT_ID/SECRET not configured");
    }

    if (req.query.error) {
      return res.redirect(
        `/integrations?connected=google-ads&status=error&reason=${encodeURIComponent(
          String(req.query.error)
        )}`
      );
    }

    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) return res.status(400).send("Missing code");

    const stateObj = decodeState(req.query.state);
    const supabaseToken = stateObj?.t ?? null;
    if (!supabaseToken) {
      return res.status(400).send("Missing auth state — restart Google Ads connect from Integrations");
    }

    const { data, error } = await supabaseAdmin.auth.getUser(supabaseToken);
    if (error || !data?.user?.id) {
      return res.status(401).send("Invalid SkalX session for Google Ads OAuth");
    }
    const userId = data.user.id;

    const origin = resolveRequestOrigin(req);
    const redirectUri = `${origin}/api/ads/google/oauth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("[google-ads oauth] token exchange failed", tokenJson?.error);
      return res.redirect(
        `/integrations?connected=google-ads&status=error&reason=token_exchange`
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokenJson.expires_in ?? 3600) * 1000
    ).toISOString();

    // Persist tokens immediately (refresh may be omitted on re-consent — keep existing if missing)
    const { IntegrationDAO } = await import("@/database");
    const { revealTokens } = await import("@/lib/ads/crypto/tokens");
    const existing = await IntegrationDAO.findByUserAndProvider(userId, "google-ads");
    const existingTokens = existing ? revealTokens(existing) : null;

    const integration = await saveIntegration(
      {
        accessToken: tokenJson.access_token,
        refreshToken:
          tokenJson.refresh_token || existingTokens?.refreshToken || null,
        userAccessToken:
          tokenJson.refresh_token || existingTokens?.refreshToken || null,
        pageAccessToken: tokenJson.access_token,
        tokenExpiresAt: expiresAt,
        scopes: [
          "https://www.googleapis.com/auth/adwords",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
        healthStatus: "healthy",
        lastHealthCheck: new Date().toISOString(),
        metadata: {
          oauthAt: new Date().toISOString(),
          // Keep env MCC as hint only — user must select account
          managerCustomerIdHint: process.env.GOOGLE_ADS_MANAGER_ID || null,
        },
        raw: { tokenType: tokenJson.token_type, scope: tokenJson.scope },
      },
      { userId, provider: "google-ads" }
    );

    // Discover accounts for selection
    let accounts: any[] = [];
    let discoverError: string | null = null;
    try {
      accounts = await googleAdsProvider.listAdAccounts({
        userId,
        integrationId: integration.id,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
        managerCustomerId: process.env.GOOGLE_ADS_MANAGER_ID || null,
      });
      await AdAccountDAO.upsertDiscovered(integration.id, "google-ads", accounts);
    } catch (e: any) {
      discoverError = e?.message || String(e);
      console.warn("[google-ads] account discovery failed:", discoverError);
    }

    await setUserStatusForUser(userId, "google-ads", true).catch(() => {});

    const sessionId = `oauth_google_${userId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await OAuthSessionDAO.store(
      sessionId,
      userId,
      "google-ads",
      {
        userId,
        integrationId: integration.id,
        accounts: accounts.map((a) => ({
          accountId: a.accountId,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone,
          status: a.status,
          isManager: !!(a.metadata as any)?.isManager,
          managerId: (a.metadata as any)?.managerId || null,
        })),
        discoverError,
        createdAt: new Date().toISOString(),
        expiresAt: expires.toISOString(),
      },
      expires
    );

    return res.redirect(
      `/integrations/google-ads/select-account?sessionId=${encodeURIComponent(sessionId)}`
    );
  } catch (err: any) {
    console.error("[google-ads oauth callback]", err);
    return res.redirect(
      `/integrations?connected=google-ads&status=error&reason=callback`
    );
  }
}
