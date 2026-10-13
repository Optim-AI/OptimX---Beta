import type { NextApiRequest, NextApiResponse } from "next";
import { getOAuthSession } from "@/integrations/meta/oauth-session";
import { sanitizeAccountForClient } from "@/lib/social/instagram/discovery";
import type { InstagramEligibleAccount } from "@/lib/social/instagram/discovery";

/**
 * GET /api/social/instagram/oauth/session?sessionId=
 * Returns discovered IG accounts (no tokens).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sessionId = Array.isArray(req.query.sessionId)
    ? req.query.sessionId[0]
    : req.query.sessionId;

  if (!sessionId) {
    res.status(400).json({ error: "missing_session", message: "sessionId required" });
    return;
  }

  const session = await getOAuthSession(sessionId);
  if (!session) {
    res.status(404).json({
      error: "session_expired",
      message: "Session not found or expired. Reconnect Instagram.",
    });
    return;
  }

  const accounts = Array.isArray(session.adAccounts)
    ? (session.adAccounts as InstagramEligibleAccount[]).map(
        sanitizeAccountForClient
      )
    : [];

  res.status(200).json({
    sessionId,
    errorType: session.errorType || null,
    accounts,
    pagesCount: session.pages?.length || 0,
  });
}
