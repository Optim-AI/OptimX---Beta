// pages/api/auth/facebook/updateLeadStatus.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';
import { IntegrationDAO } from '@/database/models/Integration.dao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed: use POST" });

  try {
    const { lead_id, status } = req.body ?? {};
    if (!lead_id) return res.status(400).json({ error: "lead_id is required in body" });
    if (!status) return res.status(400).json({ error: "status is required in body" });

    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    // find the integration row for this user/provider
    const savedRow = await readSavedIntegration({ provider: "meta", userId });
    if (!savedRow || !savedRow.savedRowId) {
      return res.status(400).json({ error: "no_integration" });
    }

    const rowId = savedRow.savedRowId;

    // fetch existing row to merge metadata safely
    const existingIntegration = await IntegrationDAO.getById(rowId);
    if (!existingIntegration) {
      console.error("updateLeadStatus - integration not found:", rowId);
      return res.status(500).json({ error: "Integration not found" });
    }

    const metadata = (existingIntegration.metadata ?? {}) as any;
    metadata.leadStatuses = metadata.leadStatuses ?? {};
    metadata.leadStatuses[String(lead_id)] = String(status);

    await IntegrationDAO.updateMetadata(rowId, metadata);

    return res.status(200).json({ ok: true, lead_id: String(lead_id), status: String(status) });
  } catch (err: any) {
    console.error("facebook/updateLeadStatus error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
