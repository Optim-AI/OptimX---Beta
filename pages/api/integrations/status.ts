// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getStatuses } from "../../../lib/integrationStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const statuses = await getStatuses();
    res.status(200).json(statuses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to read statuses" });
  }
}
