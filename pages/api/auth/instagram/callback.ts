// Retired (security audit 2026-11-23): this older Instagram connect flow put the user's
// sign-in token in the URL and had no CSRF protection. Meta is connected from the
// Integrations page via /api/meta/oauth/start (signed state + nonce cookie).
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.redirect(302, "/integrations");
}
