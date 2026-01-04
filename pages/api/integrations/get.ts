// pages/api/integrations/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { IntegrationDAO } from '@/database';
import { PLATFORMS } from '@/integrations/store';

/**
 * GET /api/integrations/get?provider=meta
 * Returns the authenticated user's integration row for given provider (default "meta").
 *
 * Security notes:
 * - User identity is derived from the request using getUserIdFromRequest (do NOT trust client-sent userId).
 * - Provider is validated against allowed PLATFORMS.
 * - Sensitive fields (access_token, refresh_token, tokenJson, raw tokens) are redacted before returning to client.
 */
function redactSensitive(row: any) {
  if (!row) return row;
  const clone = JSON.parse(JSON.stringify(row));
  const redactKeys = ["access_token", "refresh_token", "refreshToken", "token", "pageAccessToken", "userAccessToken"];
  for (const k of redactKeys) {
    if (clone[k]) clone[k] = "[REDACTED]";
    if (clone.metadata && typeof clone.metadata === "object" && clone.metadata[k]) clone.metadata[k] = "[REDACTED]";
  }
  if (clone.raw && typeof clone.raw === "object") {
    // remove common nested token shapes
    if (clone.raw.tokenJson) clone.raw.tokenJson = "[REDACTED]";
    if (clone.raw.access_token) clone.raw.access_token = "[REDACTED]";
    if (clone.raw.refresh_token) clone.raw.refresh_token = "[REDACTED]";
  }
  return clone;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "missing_user", details: "Auth required" });
    }

    const providerRaw = typeof req.query.provider === "string" ? req.query.provider : "meta";
    const provider = providerRaw.trim().toLowerCase();

    // Validate provider against allowed list
    if (!PLATFORMS.includes(provider as any)) {
      return res.status(400).json({ ok: false, error: "invalid_provider", details: `provider must be one of: ${PLATFORMS.join(", ")}` });
    }

    const data = await IntegrationDAO.findByUserAndProvider(userId, provider);

    if (!data) {
      return res.status(404).json({ ok: true, integration: null, note: "no_integration_for_user" });
    }

    // redact sensitive fields before returning
    const safe = redactSensitive(data);

    return res.status(200).json({ ok: true, integration: safe });
  } catch (err: any) {
    console.error("integrations.get fatal:", err);
    return res.status(500).json({ ok: false, error: "server_error", details: err?.message ?? String(err) });
  }
}
