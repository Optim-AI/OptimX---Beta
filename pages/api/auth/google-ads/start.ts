// Legacy twin of auth.ts — redirect to shared Google Ads OAuth start.
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") qs.set(k, v);
  }
  return res.redirect(307, `/api/ads/google/oauth/start${qs.toString() ? `?${qs}` : ""}`);
}
