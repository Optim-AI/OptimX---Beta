// pages/api/integrations/disconnect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { setStatus } from "../../../lib/integrationStore";
import { PLATFORMS } from "../../../lib/integrationStore";

/**
 * POST { platform: string }
 * Deletes the integration row for the authenticated user and provider,
 * then updates app_settings.integrations_flags to false for that platform.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const { platform } = req.body ?? {};
    if (!platform || typeof platform !== "string") {
      return res.status(400).json({ error: "platform required" });
    }

    // Validate platform is one we know about
    if (!PLATFORMS.includes(platform as any)) {
      return res.status(400).json({ error: "invalid_platform" });
    }

    // Delete integration rows for this user + provider
    const { error: deleteError } = await supabaseAdmin
      .from("integrations")
      .delete()
      .eq("user_id", userId)
      .eq("provider", platform);

    if (deleteError) {
      console.error("integrations.disconnect db delete error:", deleteError);
      return res.status(500).json({ error: "db_error", details: deleteError.message });
    }

    // Update global flag in app_settings (best-effort)
    try {
      await setStatus(platform, false);
    } catch (e) {
      // don't fail the whole request if this fails, but log for observability
      console.warn("Failed to update integrations_flags after disconnect:", e);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("disconnect error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
