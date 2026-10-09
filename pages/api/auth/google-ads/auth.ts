// Legacy entrypoint — redirect to DB-backed Google Ads OAuth.
// Does not interfere with Supabase Google Sign-In.
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const target = `/api/ads/google/oauth/start${qs.toString() ? `?${qs}` : ""}`;
  return res.redirect(307, target);
}
