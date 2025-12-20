// pages/api/debug-facebook-upload.ts
import type { NextApiRequest, NextApiResponse } from "next";

const FB_API_VERSION = process.env.FACEBOOK_API_VERSION || "v24.0";

async function safeFetchJson(url: string, opts?: RequestInit) {
  try {
    const resp = await fetch(url, opts);
    // Ensure resp is defined
    if (!resp) return { ok: false, error: "no_response_object" };

    const text = await resp.text().catch((e) => {
      return `__TEXT_READ_ERROR__ ${String(e)}`;
    });

    // try parse JSON otherwise return raw text
    try {
      const body = JSON.parse(text);
      return { ok: resp.ok, status: resp.status, body };
    } catch (e) {
      return { ok: resp.ok, status: resp.status, body: text };
    }
  } catch (err: any) {
    // network/other fetch error
    return { ok: false, error: String(err) };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = String(req.body?.access_token || req.query?.access_token || "").trim();
    const adAccountId = String(req.body?.ad_account_id || req.query?.ad_account_id || "").trim();

    if (!token) return res.status(400).json({ error: "missing_token", message: "Provide access_token as body or query param" });
    if (!adAccountId) return res.status(400).json({ error: "missing_ad_account", message: "Provide ad_account_id as body or query param" });

    const results: any = {};

    // debug_token — requires APP_ID|APP_SECRET in env to run
    if (process.env.FB_APP_ID && process.env.FB_APP_SECRET) {
      const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`;
      results.debug_token = await safeFetchJson(debugUrl);
    } else {
      results.debug_token = { note: "FB_APP_ID or FB_APP_SECRET not set — run debug_token locally with APP_ID|APP_SECRET" };
    }

    // me/adaccounts
    const adaccUrl = `https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts?access_token=${encodeURIComponent(token)}`;
    results.me_adaccounts = await safeFetchJson(adaccUrl);

    // me/accounts (pages)
    const pagesUrl = `https://graph.facebook.com/${FB_API_VERSION}/me/accounts?access_token=${encodeURIComponent(token)}`;
    results.me_pages = await safeFetchJson(pagesUrl);

    // Try a simple /adimages upload using URL-encoded form (avoids Node FormData issues)
    try {
      const uploadUrl = `https://graph.facebook.com/${FB_API_VERSION}/act_${encodeURIComponent(adAccountId)}/adimages`;
      const params = new URLSearchParams();
      params.append("url", "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png");
      params.append("access_token", token);

      const uploadResp = await safeFetchJson(uploadUrl, { method: "POST", body: params });
      results.adimages = uploadResp;
    } catch (e: any) {
      results.adimages = { ok: false, error: String(e) };
    }

    return res.status(200).json({ ok: true, results });
  } catch (err: any) {
    console.error("debug endpoint error", err);
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
}
