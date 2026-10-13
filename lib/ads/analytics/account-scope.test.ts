/**
 * Selected ad-account isolation — never blend sibling accounts.
 * Run: npx --yes tsx lib/ads/analytics/account-scope.test.ts
 */
import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  filterRowsForSelectedAdAccount,
  metricDailyGrainKey,
  resolveWarehouseAccountScope,
} from "@/lib/ads/analytics/account-scope";
import { summarizeSpendByCurrency } from "@/lib/ads/analytics/currency";

// No selection → unavailable (do not guess)
{
  const s = resolveWarehouseAccountScope(null);
  assert.strictEqual(s.ok, false);
  if (!s.ok) assert.strictEqual(s.reason, "no_selected_account");
}

{
  const s = resolveWarehouseAccountScope({ id: "acc-a", accountId: "111", currency: "USD" });
  assert.strictEqual(s.ok, true);
  if (s.ok) {
    assert.strictEqual(s.adAccountId, "acc-a");
    assert.strictEqual(s.accountExternalId, "111");
  }
}

// Same currency, two accounts — selecting A never includes B
{
  const rows = [
    { adAccountId: "acc-a", spend: 100, currency: "USD", impressions: 1000 },
    { adAccountId: "acc-b", spend: 50, currency: "USD", impressions: 500 },
    { adAccountId: "acc-a", spend: 25, currency: "USD", impressions: 200 },
  ];
  const aOnly = filterRowsForSelectedAdAccount(rows, "acc-a");
  assert.strictEqual(aOnly.length, 2);
  assert.ok(aOnly.every((r) => r.adAccountId === "acc-a"));
  const spendA = summarizeSpendByCurrency(aOnly);
  assert.strictEqual(spendA.totalSpend, 125);
  assert.strictEqual(spendA.currency, "USD");
  assert.strictEqual(spendA.mixedCurrency, false);

  const bOnly = filterRowsForSelectedAdAccount(rows, "acc-b");
  assert.strictEqual(bOnly.length, 1);
  assert.strictEqual(summarizeSpendByCurrency(bOnly).totalSpend, 50);
}

// Different currencies — still isolated by account, not blended
{
  const rows = [
    { adAccountId: "acc-inr", spend: 1000, currency: "INR" },
    { adAccountId: "acc-usd", spend: 40, currency: "USD" },
  ];
  const inr = filterRowsForSelectedAdAccount(rows, "acc-inr");
  const usd = filterRowsForSelectedAdAccount(rows, "acc-usd");
  assert.strictEqual(summarizeSpendByCurrency(inr).currency, "INR");
  assert.strictEqual(summarizeSpendByCurrency(inr).totalSpend, 1000);
  assert.strictEqual(summarizeSpendByCurrency(usd).currency, "USD");
  assert.strictEqual(summarizeSpendByCurrency(usd).totalSpend, 40);
  // Unscoped (bad) would mix — prove filter prevents that
  const mixed = summarizeSpendByCurrency(rows);
  assert.strictEqual(mixed.mixedCurrency, true);
  assert.strictEqual(mixed.totalSpend, null);
}

// Legacy null adAccountId rows are excluded (unattributable)
{
  const rows = [
    { adAccountId: null, spend: 999, currency: "USD" },
    { adAccountId: "acc-a", spend: 10, currency: "USD" },
  ];
  const filtered = filterRowsForSelectedAdAccount(rows, "acc-a");
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(summarizeSpendByCurrency(filtered).totalSpend, 10);
}

// Unique grain includes account — two accounts can share entityExternalId+date
{
  const g1 = metricDailyGrainKey({
    integrationId: "int-1",
    adAccountId: "acc-a",
    entityType: "account",
    entityExternalId: "111",
    metricDate: "2026-04-01",
  });
  const g2 = metricDailyGrainKey({
    integrationId: "int-1",
    adAccountId: "acc-b",
    entityType: "account",
    entityExternalId: "222",
    metricDate: "2026-04-01",
  });
  assert.notStrictEqual(g1, g2);
  // Same external entity date under different accounts must differ
  const campA = metricDailyGrainKey({
    integrationId: "int-1",
    adAccountId: "acc-a",
    entityType: "campaign",
    entityExternalId: "camp-1",
    metricDate: "2026-04-01",
  });
  const campB = metricDailyGrainKey({
    integrationId: "int-1",
    adAccountId: "acc-b",
    entityType: "campaign",
    entityExternalId: "camp-1",
    metricDate: "2026-04-01",
  });
  assert.notStrictEqual(campA, campB);
}

// DAO + warehouse + migration wiring
{
  const dao = readFileSync(
    join(process.cwd(), "database/models/AdMetrics.dao.ts"),
    "utf8"
  );
  assert.ok(dao.includes("eq(adMetricsDaily.adAccountId"));
  assert.ok(dao.includes("requireAdAccountId"));

  const wh = readFileSync(
    join(process.cwd(), "lib/ads/analytics/warehouse-metrics.ts"),
    "utf8"
  );
  assert.ok(wh.includes("resolveWarehouseAccountScope"));
  assert.ok(wh.includes("scope.adAccountId"));

  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261013150000_ad_metrics_daily_account_grain.sql"
    ),
    "utf8"
  );
  assert.ok(sql.includes("ad_account_id"));
  assert.ok(sql.includes("uq_ad_metrics_daily_grain"));
}

console.log("ads analytics account-scope.test: PASS");
