import type { NextApiRequest, NextApiResponse } from "next";
import { getOAuthSession } from "@/integrations/meta/oauth-session";

/**
 * GET /api/social/facebook/oauth/session?sessionId={id}
 * Sanitized pages for publishing Page selection (no tokens).
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

  try {
    const sessionId = Array.isArray(req.query.sessionId)
      ? req.query.sessionId[0]
      : req.query.sessionId;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId parameter" });
      return;
    }

    const session = await getOAuthSession(sessionId);
    if (!session) {
      res.status(404).json({
        error: "session_not_found",
        message: "Session not found or expired. Please reconnect publishing.",
      });
      return;
    }

    const pages = (session.pages || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      tasks: p.tasks,
      hasPageToken: !!p.access_token,
    }));

    res.status(200).json({
      pages,
      errorType: session.errorType,
      expiresAt: session.expiresAt,
      purpose: "facebook_page_publish",
    });
  } catch (err: any) {
    console.error("Failed to retrieve publish OAuth session:", err);
    res.status(500).json({
      error: "server_error",
      message: "Failed to retrieve session data",
    });
  }
}
