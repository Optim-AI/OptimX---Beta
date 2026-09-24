// pages/api/auth/google-ads/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";
import { setStatus } from '@/integrations/store';
import { resolveRequestOrigin } from "@/lib/routing/safe-next";

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_PATH = "/api/auth/google-ads/callback";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).send(
        'Missing Google Ads configuration. Please set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET environment variables.'
      );
    }

    const { code, error } = req.query;

    if (error) {
      console.error("[google-ads callback] oauth error param present");
      return res.status(400).send("OAuth error: " + String(error));
    }
    if (!code || Array.isArray(code)) {
      return res.status(400).send("Missing code");
    }

    let origin: string;
    try {
      origin = resolveRequestOrigin(req);
    } catch (err: any) {
      return res.status(500).send(err?.message || "Application URL is not configured");
    }
    const redirectUri = `${origin}${REDIRECT_PATH}`;

    // Exchange authorization code for tokens
    let tokenJson: TokenResponse | null = null;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenText = await tokenRes.text();
    try {
      tokenJson = JSON.parse(tokenText) as TokenResponse;
    } catch {
      console.error("[google-ads] token parse error");
      return res.status(500).send("Failed to parse token response");
    }

    if (!tokenRes.ok) {
      console.error("[google-ads] token endpoint returned error", tokenJson?.error || tokenRes.status);
      const msg = tokenJson?.error_description || tokenJson?.error || `status ${tokenRes.status}`;
      return res.status(500).send("Token exchange failed: " + msg);
    }

    if (!tokenJson || !tokenJson.access_token) {
      console.error("[google-ads] no access_token in token response");
      return res.status(500).send("No access token in response");
    }

    // Decide cookie flags: SameSite=None + Secure for https origins, otherwise lax+insecure for localhost.
    const isSecureContext = redirectUri.startsWith("https://") || process.env.NODE_ENV === "production";
    const sameSiteValue = isSecureContext ? ("none" as const) : ("lax" as const);
    const maxAgeAccess = tokenJson.expires_in ?? 3600;

    const cookiesToSet: string[] = [];

    cookiesToSet.push(
      cookie.serialize("ga_access_token", String(tokenJson.access_token), {
        httpOnly: true,
        path: "/",
        maxAge: maxAgeAccess,
        sameSite: sameSiteValue,
        secure: isSecureContext,
      })
    );

    if (tokenJson.refresh_token) {
      cookiesToSet.push(
        cookie.serialize("ga_refresh_token", String(tokenJson.refresh_token), {
          httpOnly: true,
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: sameSiteValue,
          secure: isSecureContext,
        })
      );
    }

    cookiesToSet.push(
      cookie.serialize("ga_token_time", String(Date.now()), {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: sameSiteValue,
        secure: isSecureContext,
      })
    );

    res.setHeader("Set-Cookie", cookiesToSet);

    try {
      await setStatus("google-ads", true);
    } catch (sErr) {
      console.warn("[google-ads] setStatus failed");
    }

    const payload = {
      type: "oauth_connected",
      platform: "google-ads",
      redirect: "/integrationsGoogle",
    };

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Connected</title>
    <style>body{font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;color:#0f172a}</style>
  </head>
  <body>
    <h3>Connected</h3>
    <p>If this window doesn't close automatically, <a id="continue" href="/integrationsGoogle?connected=google-ads">click here to continue</a>.</p>
    <script>
      (function () {
        try {
          var payload = ${JSON.stringify(payload)};
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(payload, '*');
            } catch (e) {
              console.warn('postMessage failed:', e);
            }
          }
          try { window.close(); } catch (e) {}
          setTimeout(function () {
            if (!window.closed) window.location.replace('/integrationsGoogle?connected=google-ads');
          }, 500);
        } catch (err) {
          try { window.location.replace('/integrationsGoogle?connected=google-ads'); } catch(e) {}
        }
      })();
    </script>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (outerErr: any) {
    console.error("[google-ads callback] unexpected error");
    const errHtml = `<!doctype html><html><body><h3>OAuth callback error</h3><pre>${String(outerErr?.message || outerErr)}</pre></body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(errHtml);
  }
}
