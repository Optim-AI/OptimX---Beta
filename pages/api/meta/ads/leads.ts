// pages/api/meta/ads/leads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireAdsAccount } from "../../../../lib/meta/auth";
import { getLeads, getLeadForms } from "../../../../lib/meta/ads";

/**
 * Get Meta ad leads for authenticated user.
 * GET /api/meta/ads/leads?formId=123 (get leads from specific form)
 * GET /api/meta/ads/leads (get all lead forms)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireAdsAccount(integration);

    const { formId } = req.query;
    const formIdStr = Array.isArray(formId) ? formId[0] : formId;

    if (formIdStr) {
      // Get leads from specific form
      const result = await getLeads({
        formId: formIdStr,
        accessToken: integration.userAccessToken,
      });
      return res.status(200).json(result);
    } else {
      // Get all lead forms
      const result = await getLeadForms({
        adAccountId: integration.adAccountId!,
        accessToken: integration.userAccessToken,
      });
      return res.status(200).json(result);
    }
  } catch (err: any) {
    console.error("meta ads leads error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get leads" });
  }
}
