// pages/api/auth/facebook/comment.ts
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { postId, message } = req.body as { postId?: string; message?: string };
    if (!postId || !message) return res.status(400).json({ error: "postId and message required" });

    const saved = await readSaved();
    const pageAccessToken = saved?.pageAccessToken ?? process.env.PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) return res.status(500).json({ error: "Missing page access token" });

    // use form-encoded body
    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments`;
    const params = new URLSearchParams({ message, access_token: pageAccessToken });

    const gRes = await fetch(url, { method: "POST", body: params });
    const json = await gRes.json();

    if (!gRes.ok) return res.status(gRes.status).json(json);
    return res.status(200).json(json);
  } catch (err: unknown) {
    const messageErr = err instanceof Error ? err.message : String(err);
    console.error("facebook/comment error:", err);
    return res.status(500).json({ error: "comment failed", details: messageErr });
  }
}
