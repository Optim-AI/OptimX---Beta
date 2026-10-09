// pages/api/ads/google/oauth/finalize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { OAuthSessionDAO, IntegrationDAO } from "@/database";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { setUserStatusForUser } from "@/integrations/store";
import { runAdsSync } from "@/lib/ads/sync/runner";

/**
 * POST { sessionId, customerId, managerCustomerId? }
 * Explicit customer selection — never auto-picks first account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const { sessionId, customerId, managerCustomerId } = req.body ?? {};
    if (!sessionId || !customerId) {
      return res.status(400).json({
        error: "missing_parameters",
        message: "sessionId and customerId are required",
      });
    }

    const session = await OAuthSessionDAO.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(400).json({
        error: "session_expired",
        message: "Selection session expired. Reconnect Google Ads.",
      });
    }

    const data = session.data as any;
    const accounts: any[] = data?.accounts || [];
    const normalized = String(customerId).replace(/-/g, "");
    const match = accounts.find((a) => String(a.accountId) === normalized);

    if (!match && accounts.length > 0) {
      return res.status(400).json({
        error: "customer_not_found",
        message: "Selected customer was not in the discovered list.",
      });
    }

    const integrationId = data.integrationId as string;
    const integration = await IntegrationDAO.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      return res.status(400).json({ error: "integration_missing" });
    }

    const selected = await AdAccountDAO.selectAccount(integrationId, normalized);
    if (!selected) {
      // Ensure row exists then select
      await AdAccountDAO.upsertDiscovered(integrationId, "google-ads", [
        {
          accountId: normalized,
          name: match?.name || `Customer ${normalized}`,
          currency: match?.currency,
          timezone: match?.timezone,
          status: match?.status,
          metadata: {
            isManager: match?.isManager,
            managerId: managerCustomerId || match?.managerId || null,
          },
        },
      ]);
      await AdAccountDAO.selectAccount(integrationId, normalized);
    }

    const mgr =
      managerCustomerId ||
      match?.managerId ||
      process.env.GOOGLE_ADS_MANAGER_ID ||
      null;

    await IntegrationDAO.update(integrationId, {
      adAccountId: normalized,
      metadata: {
        ...((integration.metadata as object) || {}),
        managerCustomerId: mgr,
        selectedCustomerId: normalized,
        selectedAt: new Date().toISOString(),
      },
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
    } as any);

    await setUserStatusForUser(userId, "google-ads", true).catch(() => {});
    await OAuthSessionDAO.delete(sessionId).catch(() => {});

    // Kick off initial sync (best-effort)
    let sync: any = null;
    try {
      sync = await runAdsSync({
        userId,
        provider: "google-ads",
        triggerSource: "reconnect",
        lookbackDays: 30,
      });
    } catch (e: any) {
      sync = { ok: false, error: e?.message };
    }

    return res.status(200).json({
      success: true,
      customerId: normalized,
      managerCustomerId: mgr,
      sync,
    });
  } catch (err: any) {
    console.error("google-ads finalize:", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
}
