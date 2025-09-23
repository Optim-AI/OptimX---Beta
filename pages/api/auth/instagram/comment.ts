// pages/api/auth/instagram/comment.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { mediaId, message } = req.body;
  if (!mediaId || !message) return res.status(400).json({ error: "mediaId and message required" });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const saved = JSON.parse(raw);
    const pageAccessToken = saved.pageAccessToken;

    const url = `https://graph.facebook.com/v${version}/${mediaId}/comments`;
    const params = new URLSearchParams({ message, access_token: pageAccessToken });
    const r = await fetch(url, { method: "POST", body: params });
    const json = await r.json();
    return res.json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "comment failed", details: (err as any).toString() });
  }
}
