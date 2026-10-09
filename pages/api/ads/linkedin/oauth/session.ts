import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { OAuthSessionDAO } from "@/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "missing_user" });

  const sessionId = Array.isArray(req.query.sessionId)
    ? req.query.sessionId[0]
    : req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: "missing_sessionId" });

  const session = await OAuthSessionDAO.get(sessionId);
  if (!session || session.userId !== userId) {
    return res.status(404).json({ error: "session_not_found" });
  }

  const data = session.data as any;
  return res.status(200).json({
    accounts: data?.accounts || [],
    discoverError: data?.discoverError || null,
  });
}
