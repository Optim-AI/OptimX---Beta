// pages/api/auth/facebook/getPostComments.ts
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
    const postId = String(req.query.postId || "");
    if (!postId) return res.status(400).json({ error: "Missing postId query param" });

    const saved = await readSaved();
    const pageAccessToken = saved?.pageAccessToken ?? process.env.PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) return res.status(500).json({ error: "Missing page access token (data/instagram.json or env)" });

    // fetch top-level comments (expand fields as needed)
    const fields = ["id", "message", "from", "created_time"].join(",");
    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=200`;

    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    if (!gRes.ok) return res.status(gRes.status).json(body);
    return res.status(200).json(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/getPostComments error:", err);
    return res.status(500).json({ error: message });
  }
}
