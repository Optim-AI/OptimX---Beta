// pages/api/auth/facebook/getPosts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const saved = await readSaved();
    const pageId = saved?.pageId ?? process.env.PAGE_ID;
    const pageAccessToken = saved?.pageAccessToken ?? process.env.PAGE_ACCESS_TOKEN;

    if (!pageId || !pageAccessToken) {
      return res.status(500).json({ error: "Missing pageId or pageAccessToken (check data/instagram.json or env vars)" });
    }

    const fields = [
      "id",
      "message",
      "created_time",
      "permalink_url",
      "full_picture",
      "comments.summary(true)",
      "reactions.summary(true)",
    ].join(",");

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/posts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=50`;

    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/getPosts error:", err);
    return res.status(500).json({ error: message });
  }
}