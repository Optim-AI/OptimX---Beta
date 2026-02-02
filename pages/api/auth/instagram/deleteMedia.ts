// pages/api/auth/instagram/deleteMedia.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

function redactToken(t?: string | null) {
  if (!t) return null;
  if (t.length <= 10) return t[0] + "...";
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

async function callDelete(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = saved.pageAccessToken ?? null;
    const userAccessToken = saved.userAccessToken ?? null;
    const longUserToken = saved.longUserToken ?? null;

    const body = req.method === "POST" ? req.body : req.body;
    const mediaId = (body?.mediaId ?? body?.postId ?? body?.id) as string | undefined;
    if (!mediaId) return res.status(400).json({ error: "mediaId or postId required in body" });

    const attempts: any[] = [];

    if (pageAccessToken) {
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?access_token=${encodeURIComponent(pageAccessToken)}`;
      const r = await callDelete(url);
      attempts.push({ usedToken: "pageAccessToken", tokenRedacted: redactToken(pageAccessToken), urlCalled: url, ...r });
      if (r.ok) return res.status(200).json({ success: true, attempts });
    }

    if (longUserToken) {
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?access_token=${encodeURIComponent(longUserToken)}`;
      const r = await callDelete(url);
      attempts.push({ usedToken: "longUserToken", tokenRedacted: redactToken(longUserToken), urlCalled: url, ...r });
      if (r.ok) return res.status(200).json({ success: true, attempts });
    }

    if (userAccessToken) {
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?access_token=${encodeURIComponent(userAccessToken)}`;
      const r = await callDelete(url);
      attempts.push({ usedToken: "userAccessToken", tokenRedacted: redactToken(userAccessToken), urlCalled: url, ...r });
      if (r.ok) return res.status(200).json({ success: true, attempts });
    }

    // token debug
    const debugs: any[] = [];
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (pageAccessToken && appId && appSecret) {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
      const dres = await fetch(debugUrl);
      const dtext = await dres.text();
      let dbody: any = dtext;
      try { dbody = JSON.parse(dtext); } catch {}
      debugs.push({ which: "pageAccessToken", debugUrl, status: dres.status, ok: dres.ok, body: dbody, tokenRedacted: redactToken(pageAccessToken) });
    }
    if (userAccessToken && appId && appSecret) {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
      const dres = await fetch(debugUrl);
      const dtext = await dres.text();
      let dbody: any = dtext;
      try { dbody = JSON.parse(dtext); } catch {}
      debugs.push({ which: "userAccessToken", debugUrl, status: dres.status, ok: dres.ok, body: dbody, tokenRedacted: redactToken(userAccessToken) });
    }

    return res.status(500).json({
      success: false,
      reason: "All deletion attempts failed",
      attempts,
      tokenDebug: debugs,
      note: "Check fbtrace_id in the Graph error body for Meta support if error is transient.",
    });
  } catch (err: any) {
    console.error("deleteMedia handler error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
