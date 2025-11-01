// pages/api/auth/instagram/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
import { setStatus } from "../../../../lib/integrationStore";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

async function saveJSON(obj: any) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) return res.status(400).send("missing code");

    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

    // 1) Exchange code for short-lived user access token
    const tokenResp = await fetch(
      `https://graph.facebook.com/v${version}/oauth/access_token` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}` +
        `&code=${encodeURIComponent(code)}`
    );
    const tokenJson = await tokenResp.json();
    if (tokenJson.error) {
      console.error("token error", tokenJson);
      return res.status(500).json(tokenJson);
    }

    // 2) Exchange for long-lived token (optional but recommended)
    const exchangeResp = await fetch(
      `https://graph.facebook.com/v${version}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${tokenJson.access_token}`
    );
    const exchangeJson = await exchangeResp.json();
    const userAccessToken = exchangeJson.access_token || tokenJson.access_token;

    // 3) Get Pages the user manages
    const pagesResp = await fetch(
      `https://graph.facebook.com/v${version}/me/accounts?access_token=${userAccessToken}`
    );
    const pagesJson = await pagesResp.json();
    if (!pagesJson?.data?.length) {
      return res.status(400).json({
        error: "No pages found for this user. Make sure you manage a Page linked to Instagram.",
        pagesJson,
      });
    }
    const page = pagesJson.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // 4) Get connected Instagram Business Account ID for that Page
    const igResp = await fetch(
      `https://graph.facebook.com/v${version}/${pageId}` +
        `?fields=instagram_business_account&access_token=${pageAccessToken}`
    );
    const igJson = await igResp.json();
    const igUserId = igJson.instagram_business_account?.id;

    // 5) Get Ad Accounts for this user (so you can run ads)
    const adAccountsResp = await fetch(
      `https://graph.facebook.com/v${version}/me/adaccounts?access_token=${userAccessToken}`
    );
    const adAccountsJson = await adAccountsResp.json();
    const adAccountId = adAccountsJson?.data?.[0]?.id;

    const saved = {
      createdAt: new Date().toISOString(),
      userAccessToken,
      pageAccessToken,
      pageId,
      igUserId,
      adAccountId,
      raw: {
        tokenJson,
        exchangeJson,
        pagesJson,
        igJson,
        adAccountsJson,
      },
    };

    await saveJSON(saved);

    // mark integration on server using id 'meta' (matches your frontend PLATFORMS)
    await setStatus("meta", true);

    // notify opener and close popup; fallback to query param
    const fallback = `/integrations?connected=meta`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"/><title>Instagram connected</title></head>
        <body>
          <p>Instagram connected. You can close this window.</p>
          <script>
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: "oauth_connected", platform: "meta" }, "*");
              }
            } catch (e) {}
            setTimeout(function(){
              try { window.close(); } catch(e) {}
              window.location = ${JSON.stringify(fallback)};
            }, 600);
          </script>
        </body>
      </html>
    `);

  } catch (err) {
    console.error("callback error", err);
    res.status(500).json({ error: "callback error", details: (err as any).toString() });
  }
}
