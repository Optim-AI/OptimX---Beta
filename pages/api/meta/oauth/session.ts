// pages/api/meta/oauth/session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getOAuthSession } from '@/integrations/meta/oauth-session';
import { getUserIdFromRequest } from '@/auth/request';

/**
 * GET /api/meta/oauth/session?sessionId={id}
 * Retrieves a temporary OAuth session for page selection
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "unauthorized", message: "Please sign in again, then try connecting." });
    }
    const sessionId = Array.isArray(req.query.sessionId)
      ? req.query.sessionId[0]
      : req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId parameter" });
    }

    const found = await getOAuthSession(sessionId);
    const session = found && found.userId === userId ? found : null;

    if (!session) {
      return res.status(404).json({
        error: "session_not_found",
        message: "Session not found or expired. Please try connecting again.",
      });
    }

    // Return session data (without sensitive tokens for security)
    return res.status(200).json({
      pages: session.pages,
      errorType: session.errorType,
      expiresAt: session.expiresAt,
    });
  } catch (err: any) {
    console.error("Failed to retrieve OAuth session:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Failed to retrieve session data",
    });
  }
}
