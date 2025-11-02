// pages/api/integrations/disconnect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { setStatus } from "../../../lib/integrationStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: "platform required" });

    const { error } = await supabaseAdmin.from("integrations").delete().eq("user_id", userId).eq("provider", platform);
    if (error) return res.status(500).json({ error: "db_error", details: error.message });

    try { await setStatus(platform, false); } catch (e) { /* ignore */ }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("disconnect error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
