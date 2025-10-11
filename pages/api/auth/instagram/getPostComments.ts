// pages/api/auth/instagram/getPostComments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = String(req.query.postId || "");
    if (!postId) return res.status(400).json({ error: "Missing postId query param" });

    const saved = await readSaved();
    const pageAccessToken = saved.pageAccessToken;
    if (!pageAccessToken) return res.status(500).json({ error: "Missing page access token" });

    // fetch comments (instagram and facebook comments endpoints are similar)
    const url = `https://graph.facebook.com/v${version}/${encodeURIComponent(postId)}/comments?access_token=${encodeURIComponent(pageAccessToken)}&limit=200`;
    const gRes = await fetch(url);
    const text = await gRes.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (!gRes.ok) return res.status(gRes.status).json(json);
    return res.status(200).json(json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("instagram/getPostComments error:", err);
    return res.status(500).json({ error: message });
  }
}
