// pages/api/integrations/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import { supabaseAdmin } from "../../../lib/supabaseClient";

/**
 * GET /api/integrations/get?provider=meta
 * Returns the authenticated user's integration row for given provider (default "meta").
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const provider = typeof req.query.provider === "string" ? req.query.provider : "meta";

    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("integrations.get db error:", error);
      return res.status(500).json({ error: "db_error", details: error.message });
    }

    if (!data) return res.status(404).json({ error: "no_integration", details: "No integration row found for user/provider" });

    return res.status(200).json({ ok: true, integration: data });
  } catch (err: any) {
    console.error("integrations.get fatal:", err);
    return res.status(500).json({ error: "server_error", details: err?.message ?? String(err) });
  }
}
