// pages/api/debug/saveTest.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { saveIntegration } from "../../../lib/integrationStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sample = {
    createdAt: new Date().toISOString(),
    userAccessToken: "TEST_USER_TOKEN",
    pageAccessToken: "TEST_PAGE_TOKEN",
    pageId: "1234567890",
    igUserId: "17841234567890123",
    adAccountId: "act_111222333444",
    raw: { note: "integration test" }
  };
  try {
    const data = await saveIntegration(sample, { provider: "meta", userId: null });
    res.status(200).json({ ok: true, data });
  } catch (err: any) {
    // return the error object (it will also be in server logs)
    res.status(500).json({ ok: false, error: err?.message ?? err, details: err });
  }
}
