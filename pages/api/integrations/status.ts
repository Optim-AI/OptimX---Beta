// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";
import { getStatuses } from "../../../lib/integrationStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const statuses = await getStatuses();

    // Debug: parse cookies from incoming request but DO NOT return token values
    const raw = req.headers.cookie || "";
    const parsed = raw ? cookie.parse(raw) : {};
    const cookiePresence = {
      has_ga_access_token: !!parsed["ga_access_token"],
      has_ga_refresh_token: !!parsed["ga_refresh_token"],
      cookie_header: raw ? true : false,
    };

    // Return statuses and cookie presence info for debugging
    return res.status(200).json({ ...statuses, __debug_cookies: cookiePresence });
  } catch (err) {
    console.error("status read error", err);
    res.status(500).json({ error: "failed to read statuses", details: String(err) });
  }
}
