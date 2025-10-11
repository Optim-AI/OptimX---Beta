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
    const saved = await readSaved();
    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;

    const url = `https://graph.facebook.com/v${version}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${pageAccessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) return res.status(400).json(data);

    res.status(200).json({ success: true, data: data.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fetch failed", details: (err as any).toString() });
  }
}
