// GET /api/cron/agent-tasks — Vercel Cron, every 30 minutes. Runs Marketing Agent scheduled tasks that are due.
import type { NextApiRequest, NextApiResponse } from "next";
import { isCronRequest } from "@/lib/jobs/cron-auth";
import { runDueTasks } from "@/lib/agent/tasks";

export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isCronRequest(req)) return res.status(401).json({ error: "unauthorized" });
  const out = await runDueTasks();
  console.log("[cron/agent-tasks]", out);
  return res.status(200).json(out);
}
