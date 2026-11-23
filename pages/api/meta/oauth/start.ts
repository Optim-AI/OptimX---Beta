// pages/api/meta/oauth/start.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { getUserIdFromRequest } from "@/auth/request";
import { createState, STATE_COOKIE, STATE_TTL_SECONDS } from "@/lib/meta/oauth-state";

/** Cookie path shared by start and callback (the nonce must reach the callback). */
const META_OAUTH_COOKIE_PATH = "/api/meta/oauth";

/**
 * POST /api/meta/oauth/start (signed in, Bearer) → { url } for the Facebook + Instagram dialog.
 *
 * The state is signed and names the signed-in user; a matching nonce goes in an httpOnly
 * cookie, so a connect link can't be replayed in someone else's browser and the user's
 * sign-in token never appears in a URL. A plain GET (old links) sends people back to the
 * Integrations page to start again.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.redirect(302, "/integrations");
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please sign in again, then try connecting." });

  const appId = process.env.FACEBOOK_APP_ID;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;

  if (!appId || !process.env.NEXT_PUBLIC_APP_URL) {
    return res.status(503).json({ error: "Meta connection is not set up yet. Please contact support." });
  }

  let state: string;
  let nonce: string;
  try {
    ({ state, nonce } = createState(userId));
  } catch {
    return res.status(503).json({ error: "Meta connection is not set up yet. Please contact support." });
  }

  // Request comprehensive permissions for Facebook, Instagram, and Ads
  const scopes = [
    // Instagram permissions
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    // Facebook Page permissions
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    // Business management - REQUIRED for pages connected to Instagram Business accounts
    // Without this, /me/accounts returns empty when Instagram permissions are requested
    "business_management",
    // Ads permissions
    "ads_read",
    "ads_management",
    "leads_retrieval",
  ].join(",");

  const oauthUrl =
    `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  res.setHeader(
    "Set-Cookie",
    serialize(STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: META_OAUTH_COOKIE_PATH,
      maxAge: STATE_TTL_SECONDS,
    })
  );
  return res.status(200).json({ url: oauthUrl });
}
