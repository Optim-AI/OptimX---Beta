// pages/api/auth/instagram/getPosts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

async function readSaved() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const saved = await readSaved();
    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;

    if (!igUserId || !pageAccessToken) {
      return res.status(400).json({ error: "Missing igUserId or pageAccessToken in data/instagram.json" });
    }

    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "permalink",
      "timestamp",
      "like_count",
      "comments_count"
    ].join(",");

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=50`;

    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    // Return raw information so you can inspect exact Graph output
    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("instagram/getPosts error:", err);
    return res.status(500).json({ error: msg });
  }
}
