// pages/api/auth/facebook/deletePost.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
function appSecretProof(token?: string) {
  if (!token || !APP_SECRET) return undefined;
  return crypto.createHmac("sha256", APP_SECRET).update(token).digest("hex");
}

async function fetchJson(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, ok: r.ok, body, url };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed (use POST or DELETE)" });
  }

  try {
    const reqBody = req.method === "POST" ? req.body : req.body as any;
    const maybePostId = (reqBody?.postId ?? reqBody?.id) as string | undefined;
    if (!maybePostId) return res.status(400).json({ error: "postId required in body" });
    const postId = String(maybePostId);

    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = saved.pageAccessToken ?? null;
    const longUserToken = saved.longUserToken ?? null;
    const userAccessToken = saved.userAccessToken ?? null;

    const attempts: any[] = [];

    const buildUrl = (id: string, token: string) => {
      const proof = appSecretProof(token);
      const base = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(id)}`;
      const q = new URLSearchParams({ access_token: token });
      if (proof) q.set("appsecret_proof", proof);
      return `${base}?${q.toString()}`;
    };

    async function diagnosticGet(tokenName: string, token: string) {
      const url = `${buildUrl(postId, token)}&fields=id,permalink_url,message,created_time`;
      const r = await fetchJson(url);
      attempts.push({ attempt: "diag_get", usedToken: tokenName, tokenRedacted: token ? token.slice(0,6) + "..." : null, urlCalled: url, ...r });
      return r;
    }

    async function tryDeleteWith(tokenName: string, token?: string | null) {
      if (!token) return null;
      await diagnosticGet(tokenName, token);
      const url = buildUrl(postId, token);
      const r = await fetchJson(url, { method: "DELETE" });
      attempts.push({ attempt: "delete", usedToken: tokenName, tokenRedacted: token ? token.slice(0,6) + "..." : null, urlCalled: url, ...r });
      return r;
    }

    if (pageAccessToken) {
      const r = await tryDeleteWith("pageAccessToken", pageAccessToken);
      if (r?.ok) return res.status(200).json({ success: true, attempts });
    }
    if (longUserToken) {
      const r = await tryDeleteWith("longUserToken", longUserToken);
      if (r?.ok) return res.status(200).json({ success: true, attempts });
    }
    if (userAccessToken) {
      const r = await tryDeleteWith("userAccessToken", userAccessToken);
      if (r?.ok) return res.status(200).json({ success: true, attempts });
    }

    // token debug if possible
    const tokenDebug: any[] = [];
    const APP_ID = process.env.FACEBOOK_APP_ID;
    const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
    if (pageAccessToken && APP_ID && APP_SECRET) {
      const dbgUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(`${APP_ID}|${APP_SECRET}`)}`;
      const d = await fetchJson(dbgUrl);
      tokenDebug.push({ which: "pageAccessToken", debugUrl: dbgUrl, ...d, tokenRedacted: pageAccessToken ? pageAccessToken.slice(0,6) + "..." : null });
    }

    return res.status(500).json({
      success: false,
      reason: "All deletion attempts failed",
      attempts,
      tokenDebug,
      note: "If this persists share attempts[].body.error.fbtrace_id for deeper debugging.",
    });
  } catch (err: any) {
    console.error("facebook/deletePost handler error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
