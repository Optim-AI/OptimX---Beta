// pages/api/auth/facebook/updateLeadStatus.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data/instagram.json");

async function readSaved() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed: use POST" });

  try {
    const { lead_id, status } = req.body ?? {};
    if (!lead_id) return res.status(400).json({ error: "lead_id is required in body" });
    if (!status) return res.status(400).json({ error: "status is required in body" });

    const saved = (await readSaved()) ?? {};

    // Ensure leadStatuses map exists
    saved.leadStatuses = saved.leadStatuses ?? {};

    // Update status
    saved.leadStatuses[String(lead_id)] = String(status);

    // Persist back to disk (overwrite file)
    await fs.writeFile(DATA_FILE, JSON.stringify(saved, null, 2), "utf8");

    return res.status(200).json({ ok: true, lead_id: String(lead_id), status: String(status) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/updateLeadStatus error:", err);
    return res.status(500).json({ error: message });
  }
}
