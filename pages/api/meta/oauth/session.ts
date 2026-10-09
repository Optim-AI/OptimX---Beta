// pages/api/meta/oauth/session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getOAuthSession } from "@/integrations/meta/oauth-session";

/**
 * GET /api/meta/oauth/session?sessionId={id}
 * Returns sanitized pages + ad accounts for asset selection (no tokens).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sessionId = Array.isArray(req.query.sessionId)
      ? req.query.sessionId[0]
      : req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId parameter" });
    }

    const session = await getOAuthSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "session_not_found",
        message: "Session not found or expired. Please try connecting again.",
      });
    }

    const pages = (session.pages || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      tasks: p.tasks,
      igUserId: p.instagram_business_account?.id ?? null,
      hasPageToken: !!p.access_token,
    }));

    const adAccounts = (session.adAccounts || []).map((a: any) => ({
      id: String(a.account_id || a.id || "").replace(/^act_/, ""),
      name: a.name || null,
      currency: a.currency || null,
      timezone: a.timezone_name || a.timezone || null,
      status: a.account_status != null ? String(a.account_status) : null,
      business: a.business || null,
    }));

    res.status(200).json({
      pages,
      adAccounts,
      errorType: session.errorType,
      expiresAt: session.expiresAt,
      requiresAdAccountSelection: true,
    });
  } catch (err: any) {
    console.error("Failed to retrieve OAuth session:", err);
    res.status(500).json({
      error: "server_error",
      message: "Failed to retrieve session data",
    });
  }
}
