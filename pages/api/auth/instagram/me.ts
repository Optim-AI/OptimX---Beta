// pages/api/auth/instagram/me.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const json = JSON.parse(raw);
    // Return a safe subset
    res.json({
      connected: true,
      pageId: json.pageId,
      igUserId: json.igUserId,
      createdAt: json.createdAt
    });
  } catch (e) {
    res.json({ connected: false });
  }
}
