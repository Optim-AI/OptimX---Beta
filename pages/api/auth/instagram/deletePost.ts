// pages/api/auth/instagram/deleteMedia.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

type SavedCreds = {
  pageAccessToken?: string;
  userAccessToken?: string;
  longUserToken?: string;
  [k: string]: any;
};

async function readSaved(): Promise<SavedCreds | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function redactToken(t?: string | null) {
  if (!t) return null;
  if (t.length <= 10) return t[0] + "...";
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

function appSecretProof(token?: string | null) {
  if (!token || !APP_SECRET) return undefined;
  return crypto.createHmac("sha256", APP_SECRET).update(token).digest("hex");
}

async function fetchJson(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* text is fine */ }
  return { status: r.status, ok: r.ok, body, url };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed (use POST or DELETE)" });
  }

  try {
    const reqBody = (req.method === "POST" ? req.body : req.body) as Record<string, any>;
    const maybeMediaId = (reqBody?.mediaId ?? reqBody?.postId ?? reqBody?.id) as string | undefined;

    if (!maybeMediaId) {
      return res.status(400).json({ error: "mediaId or postId required in body" });
    }

    // Narrow once for TypeScript so downstream code gets a plain string
    const mediaId: string = String(maybeMediaId);

    const saved = await readSaved();
    if (!saved) return res.status(500).json({ error: `Missing or unreadable ${DATA_FILE}` });

    const pageAccessToken = saved.pageAccessToken ?? null;
    const userAccessToken = saved.userAccessToken ?? null;
    const longUserToken = saved.longUserToken ?? null;

    const attempts: any[] = [];

    // buildUrl now always receives strings
    const buildUrl = (id: string, token: string) => {
      const proof = appSecretProof(token);
      const base = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(id)}`;
      const q = new URLSearchParams({ access_token: token });
      if (proof) q.set("appsecret_proof", proof);
      return `${base}?${q.toString()}`;
    };

    async function diagnosticGet(tokenName: string, token: string) {
      const url = `${buildUrl(mediaId, token)}&fields=id,permalink,media_type,media_url,timestamp,caption`;
      const r = await fetchJson(url);
      attempts.push({ attempt: "diag_get", usedToken: tokenName, tokenRedacted: redactToken(token), urlCalled: url, ...r });
      return r;
    }

    async function tryDeleteWith(tokenName: string, token?: string | null) {
      if (!token) return null;
      await diagnosticGet(tokenName, token);
      const url = buildUrl(mediaId, token);
      const r = await fetchJson(url, { method: "DELETE" });
      attempts.push({ attempt: "delete", usedToken: tokenName, tokenRedacted: redactToken(token), urlCalled: url, ...r });
      return r;
    }

    // Try tokens in order
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

    // Token debug info
    const tokenDebug: any[] = [];
    if (pageAccessToken && APP_ID && APP_SECRET) {
      const dbgUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(`${APP_ID}|${APP_SECRET}`)}`;
      const d = await fetchJson(dbgUrl);
      tokenDebug.push({ which: "pageAccessToken", debugUrl: dbgUrl, ...d, tokenRedacted: redactToken(pageAccessToken) });
    }
    if (userAccessToken && APP_ID && APP_SECRET) {
      const dbgUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(`${APP_ID}|${APP_SECRET}`)}`;
      const d = await fetchJson(dbgUrl);
      tokenDebug.push({ which: "userAccessToken", debugUrl: dbgUrl, ...d, tokenRedacted: redactToken(userAccessToken) });
    }

    return res.status(500).json({
      success: false,
      reason: "All deletion attempts failed",
      attempts,
      tokenDebug,
      note: "If app secret proof is required we included it. If this persists check attempts[].body.error.fbtrace_id and share it.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("instagram/deleteMedia handler error:", err);
    return res.status(500).json({ error: msg });
  }
}
