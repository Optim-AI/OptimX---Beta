// pages/api/meta/oauth/cleanup.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { cleanupExpiredSessions } from '@/integrations/meta/oauth-session';

/**
 * GET /api/meta/oauth/cleanup
 * Cleans up expired OAuth sessions
 *
 * This endpoint can be called by:
 * - A cron job (e.g., Vercel Cron, GitHub Actions)
 * - A monitoring service
 * - Manually for testing
 *
 * Optional: Add authentication/secret key for production
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Optional: Add secret key authentication for production
    const authKey = req.headers["x-cleanup-key"] || req.query.key;
    const expectedKey = process.env.CLEANUP_SECRET_KEY;

    if (expectedKey && authKey !== expectedKey) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Invalid cleanup key",
      });
    }

    // Clean up expired sessions
    const startTime = Date.now();
    await cleanupExpiredSessions();
    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: "Expired OAuth sessions cleaned up",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cleanup error:", err);
    return res.status(500).json({
      error: "cleanup_failed",
      message: err.message,
    });
  }
}
