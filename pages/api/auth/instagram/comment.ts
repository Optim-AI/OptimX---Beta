// pages/api/auth/instagram/comment.ts
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mediaId, message } = req.body;
  if (!mediaId || !message) return res.status(400).json({ error: "mediaId and message required" });

  try {
    const saved = await readSaved();
    const pageAccessToken = saved.pageAccessToken;
    if (!pageAccessToken) return res.status(500).json({ error: "Missing page access token" });

    // Use URLSearchParams so Graph receives form-encoded body (safe)
    const url = `https://graph.facebook.com/v${version}/${encodeURIComponent(mediaId)}/comments`;
    const params = new URLSearchParams({ message, access_token: pageAccessToken });

    const gRes = await fetch(url, { method: "POST", body: params });
    const json = await gRes.json();

    if (!gRes.ok) return res.status(gRes.status).json(json);
    return res.status(200).json(json);
  } catch (err: unknown) {
    const messageErr = err instanceof Error ? err.message : String(err);
    console.error("instagram/comment error:", err);
    return res.status(500).json({ error: "comment failed", details: messageErr });
  }
}
