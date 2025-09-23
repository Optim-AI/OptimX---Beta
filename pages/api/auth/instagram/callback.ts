// pages/api/auth/instagram/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

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
      `?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
    );
    const tokenJson = await tokenResp.json();
    if (tokenJson.error) return res.status(500).json(tokenJson);

    // 2) Exchange short-lived for long-lived user access token (optional but recommended)
    const exchangeResp = await fetch(
      `https://graph.facebook.com/v${version}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`
    );
    const exchangeJson = await exchangeResp.json();
    const userAccessToken = exchangeJson.access_token || tokenJson.access_token;

    // 3) Fetch the Facebook Pages the user manages (to get a page access token)
    const pagesResp = await fetch(
      `https://graph.facebook.com/v${version}/me/accounts?access_token=${userAccessToken}`
    );
    const pagesJson = await pagesResp.json();
    if (!pagesJson?.data?.length) {
      return res.status(400).json({ error: "No pages found for this user. Make sure you manage a Page linked to Instagram." });
    }

    // pick the first page (for demo)
    const page = pagesJson.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // 4) Get the connected Instagram Business Account ID for that Page
    const igResp = await fetch(
      `https://graph.facebook.com/v${version}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );
    const igJson = await igResp.json();
    const igUserId = igJson.instagram_business_account?.id;

    const saved = {
      createdAt: new Date().toISOString(),
      userAccessToken,
      pageAccessToken,
      pageId,
      igUserId,
      raw: { tokenJson, exchangeJson, pagesJson, igJson }
    };

    // Save for local testing (BE CAREFUL in prod — never write secrets to disk)
    await saveJSON(saved);

    // Redirect back to your frontend page
    res.redirect("/integrationsInstagram?connected=1");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "callback error", details: (err as any).toString() });
  }
}
