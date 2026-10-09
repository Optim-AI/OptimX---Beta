/**
 * Local DB pipeline validation (mocked provider data — no live Ads APIs).
 * Uses local DATABASE_URL only. Cleans up after itself.
 *
 * Run: npx --yes tsx lib/ads/validation/local-pipeline.test.ts
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

// Use a dedicated test key so placeholder SESSION_SECRET does not disable encryption
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  "skalx-local-pipeline-test-encryption-key-v1";

import { db } from "@/database/client";
import { integrations } from "@/database/schema";
import { eq } from "drizzle-orm";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import {
  AdMetricsDAO,
  AdPlatformEntityDAO,
  AdSyncRunDAO,
} from "@/database/models/AdMetrics.dao";
import { prepareTokensForStorage, revealTokens } from "@/lib/ads/crypto/tokens";
import { IntegrationDAO } from "@/database/models/Integration.dao";

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  assert.ok(
    host === "localhost" || host === "127.0.0.1",
    `Refusing non-local DB host: ${host}`
  );

  const userId = randomUUID();
  // auth.users FK may not apply to integrations.user_id in local schema —
  // insert integration directly if FK absent; otherwise skip user FK path.
  let integrationId: string | null = null;

  try {
    const prepared = prepareTokensForStorage({
      accessToken: "test_access_token_meta",
      refreshToken: "test_refresh_token_meta",
    });

    const row = await IntegrationDAO.upsert({
      userId,
      provider: "meta",
      accessToken: prepared.accessToken,
      refreshToken: prepared.refreshToken,
      tokenEncrypted: prepared.tokenEncrypted,
      adAccountId: "999000111",
      scopes: ["ads_read"],
      healthStatus: "healthy",
    });
    integrationId = row.id;

    const loaded = await IntegrationDAO.findById(integrationId);
    assert.ok(loaded);
    assert.ok(loaded!.tokenEncrypted === true || prepared.tokenEncrypted);
    const revealed = revealTokens(loaded!);
    assert.strictEqual(revealed.accessToken, "test_access_token_meta");
    assert.strictEqual(revealed.refreshToken, "test_refresh_token_meta");
    // tokens must not equal plaintext in DB when encryption enabled
    if (prepared.tokenEncrypted) {
      assert.notStrictEqual(loaded!.accessToken, "test_access_token_meta");
    }

    // Discover + select accounts (no auto-first: explicit select)
    await AdAccountDAO.upsertDiscovered(integrationId, "meta", [
      { accountId: "111", name: "Account A", currency: "USD" },
      { accountId: "222", name: "Account B", currency: "INR" },
    ]);
    let accounts = await AdAccountDAO.listByIntegration(integrationId);
    assert.strictEqual(accounts.length, 2);
    assert.ok(accounts.every((a) => !a.isSelected), "none selected yet");

    const selected = await AdAccountDAO.selectAccount(integrationId, "222");
    assert.ok(selected);
    assert.strictEqual(selected!.accountId, "222");
    assert.strictEqual(selected!.isSelected, true);
    accounts = await AdAccountDAO.listByIntegration(integrationId);
    assert.strictEqual(accounts.filter((a) => a.isSelected).length, 1);

    // Idempotent discover
    await AdAccountDAO.upsertDiscovered(integrationId, "meta", [
      { accountId: "222", name: "Account B Updated", currency: "INR" },
    ]);
    accounts = await AdAccountDAO.listByIntegration(integrationId);
    assert.strictEqual(accounts.length, 2, "no duplicate accounts");

    // Entities upsert
    const e1 = await AdPlatformEntityDAO.upsertMany(
      integrationId,
      selected!.id,
      "meta",
      [
        {
          entityType: "campaign",
          externalId: "c1",
          name: "Camp 1",
          status: "ACTIVE",
          dailyBudget: 1000,
        },
      ]
    );
    assert.strictEqual(e1, 1);
    const e2 = await AdPlatformEntityDAO.upsertMany(
      integrationId,
      selected!.id,
      "meta",
      [
        {
          entityType: "campaign",
          externalId: "c1",
          name: "Camp 1 Renamed",
          status: "ACTIVE",
        },
      ]
    );
    assert.strictEqual(e2, 1);
    const entities = await AdPlatformEntityDAO.listByIntegration(
      integrationId,
      "campaign"
    );
    assert.strictEqual(entities.length, 1, "entity upsert idempotent");
    assert.strictEqual(entities[0].name, "Camp 1 Renamed");

    // Metrics upsert twice — same grain
    const metric = {
      entityType: "account" as const,
      entityExternalId: "222",
      metricDate: "2026-04-01",
      spend: 12.5,
      impressions: 1000,
      clicks: 40,
      reach: 800,
      conversions: 2,
      conversionValue: 50,
      currency: "INR",
    };
    const m1 = await AdMetricsDAO.upsertDaily(
      integrationId,
      selected!.id,
      "meta",
      [metric]
    );
    const m2 = await AdMetricsDAO.upsertDaily(
      integrationId,
      selected!.id,
      "meta",
      [{ ...metric, spend: 15, impressions: 1100 }]
    );
    assert.strictEqual(m1, 1);
    assert.strictEqual(m2, 1);

    const agg = await AdMetricsDAO.aggregateRange(
      integrationId,
      "2026-04-01",
      "2026-04-01",
      "account"
    );
    assert.strictEqual(agg.spend, 15, "second upsert replaced spend");
    assert.strictEqual(agg.impressions, 1100);
    assert.ok(agg.ctr != null && agg.ctr > 0);
    assert.ok(agg.roas != null && agg.roas > 0);

    // Sync run audit
    const run = await AdSyncRunDAO.start({
      integrationId,
      adAccountId: selected!.id,
      provider: "meta",
      triggerSource: "manual",
      sinceDate: "2026-04-01",
      untilDate: "2026-04-01",
    });
    await AdSyncRunDAO.finish(run.id, {
      status: "success",
      entitiesUpserted: 1,
      metricsUpserted: 1,
    });
    const recent = await AdSyncRunDAO.listRecent(integrationId, 5);
    assert.ok(recent.length >= 1);
    assert.strictEqual(recent[0].status, "success");

    // Ownership isolation: other user's aggregate empty
    const other = await AdMetricsDAO.hasData(randomUUID());
    assert.strictEqual(other, false);

    console.log("PASS lib/ads/validation/local-pipeline.test.ts");
  } finally {
    if (integrationId) {
      // CASCADE should remove child rows
      await db.delete(integrations).where(eq(integrations.id, integrationId));
    }
  }
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
