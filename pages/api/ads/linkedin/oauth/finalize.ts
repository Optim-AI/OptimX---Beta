import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { OAuthSessionDAO, IntegrationDAO } from "@/database";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { setUserStatusForUser } from "@/integrations/store";
import { runAdsSync } from "@/lib/ads/sync/runner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "missing_user" });

  const { sessionId, adAccountId } = req.body ?? {};
  if (!sessionId || !adAccountId) {
    return res.status(400).json({
      error: "missing_parameters",
      message: "sessionId and adAccountId are required",
    });
  }

  const session = await OAuthSessionDAO.get(sessionId);
  if (!session || session.userId !== userId) {
    return res.status(400).json({ error: "session_expired" });
  }

  const data = session.data as any;
  const integrationId = data.integrationId as string;
  const normalized = String(adAccountId).replace(/^urn:li:sponsoredAccount:/, "");

  const accounts: any[] = data.accounts || [];
  if (accounts.length && !accounts.some((a) => String(a.accountId) === normalized)) {
    return res.status(400).json({ error: "ad_account_not_found" });
  }

  await AdAccountDAO.upsertDiscovered(integrationId, "linkedin", [
    {
      accountId: normalized,
      name: accounts.find((a) => a.accountId === normalized)?.name || null,
    },
  ]);
  await AdAccountDAO.selectAccount(integrationId, normalized);

  await IntegrationDAO.update(integrationId, {
    adAccountId: normalized,
    metadata: {
      selectedAdAccountId: normalized,
      selectedAt: new Date().toISOString(),
    },
  } as any);

  await setUserStatusForUser(userId, "linkedin", true).catch(() => {});
  await OAuthSessionDAO.delete(sessionId).catch(() => {});

  let sync: any = null;
  try {
    sync = await runAdsSync({
      userId,
      provider: "linkedin",
      triggerSource: "reconnect",
      lookbackDays: 30,
    });
  } catch (e: any) {
    sync = { ok: false, error: e?.message };
  }

  return res.status(200).json({ success: true, adAccountId: normalized, sync });
}
