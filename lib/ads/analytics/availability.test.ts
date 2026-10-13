/**
 * Ads analytics availability — zero vs unknown.
 * Run: npx --yes tsx lib/ads/analytics/availability.test.ts
 */
import assert from "assert";
import {
  ADS_METRICS_STALE_AFTER_MS,
  changePctWhenAvailable,
  classifyAdsAnalyticsAvailability,
  deriveRatesWhenAvailable,
  formatKnownMetric,
  isActualZeroAggregate,
  isStaleLastSynced,
} from "@/lib/ads/analytics/availability";
import {
  availabilityBanner,
  buildOverviewCards,
  metricCardValue,
} from "@/lib/ads/analytics/ui-state";

// 1) Actual zero aggregate (rows present, values 0)
assert.ok(
  isActualZeroAggregate({
    rowCount: 2,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    conversions: 0,
  })
);
assert.ok(
  !isActualZeroAggregate({
    rowCount: 0,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    conversions: 0,
  }),
  "rowCount 0 is unknown, not actual zero"
);

// 2) Empty range with historical warehouse → empty_range
{
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: 0,
    syncStatus: "success",
    lastSyncedAt: new Date().toISOString(),
  });
  assert.strictEqual(a.state, "empty_range");
  assert.strictEqual(a.emptyRange, true);
}

// 3) No successful sync / no warehouse → no_data
{
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: false,
    rowCountInRange: 0,
    syncStatus: null,
  });
  assert.strictEqual(a.state, "no_data");
}

// 4) Partial sync with stored metrics
{
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: 5,
    syncStatus: "partial",
    lastSyncedAt: new Date().toISOString(),
  });
  assert.strictEqual(a.state, "partial");
}

// 5) Failed sync with previously stored metrics
{
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: 5,
    syncStatus: "error",
    lastSyncedAt: new Date().toISOString(),
  });
  assert.strictEqual(a.state, "unavailable");
}

// 6) Stale data
{
  const old = new Date(Date.now() - ADS_METRICS_STALE_AFTER_MS - 1000).toISOString();
  assert.ok(isStaleLastSynced(old));
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: 3,
    syncStatus: "success",
    lastSyncedAt: old,
  });
  assert.strictEqual(a.state, "stale");
}

// Fresh available
{
  const a = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: 3,
    syncStatus: "success",
    lastSyncedAt: new Date().toISOString(),
  });
  assert.strictEqual(a.state, "available");
  assert.strictEqual(a.message, null);
}

// 7) Derived percentages when inputs unavailable → null (not 0)
{
  const rates = deriveRatesWhenAvailable({
    spend: null,
    impressions: null,
    clicks: null,
    conversions: null,
    conversionValue: null,
    reach: null,
  });
  assert.strictEqual(rates.ctr, null);
  assert.strictEqual(rates.cpc, null);
  assert.strictEqual(rates.roas, null);

  const knownZeroSpend = deriveRatesWhenAvailable({
    spend: 0,
    impressions: 100,
    clicks: 0,
    conversions: 0,
    conversionValue: 0,
    reach: 50,
  });
  assert.strictEqual(knownZeroSpend.ctr, 0);
  assert.strictEqual(knownZeroSpend.cpc, null);
}

assert.strictEqual(changePctWhenAvailable(null, 10), null);
assert.strictEqual(changePctWhenAvailable(20, 10), 100);

// 8) UI never converts missing → "0"
assert.strictEqual(metricCardValue(null), "—");
assert.strictEqual(metricCardValue(undefined), "—");
assert.strictEqual(metricCardValue(0), "0");
assert.strictEqual(formatKnownMetric(null), "—");
assert.strictEqual(formatKnownMetric(0), "0");

{
  const cards = buildOverviewCards(
    null,
    null,
    (n) => (n == null ? "—" : `₹${n}`),
    (n) => (n == null ? "—" : `${n}%`)
  );
  assert.ok(
    cards.every((c) => c.value === "—"),
    "missing current must not render numeric zeros"
  );
}

{
  const cards = buildOverviewCards(
    {
      total_spend: 0,
      total_reach: 0,
      impressions: 0,
      clicks: 0,
      avg_ctr: 0,
      conversions: 0,
      budget_estimate_daily: null,
    },
    { total_spend_pct: null },
    (n) => (n == null ? "—" : `₹${n}`),
    (n) => (n == null ? "—" : `${n}%`)
  );
  const spend = cards.find((c) => c.label === "Spend");
  assert.strictEqual(spend?.value, "₹0");
}

assert.strictEqual(availabilityBanner("no_data").tone, "info");
assert.strictEqual(availabilityBanner("unavailable").tone, "error");
assert.strictEqual(availabilityBanner("available").tone, "none");

console.log("ads analytics availability.test: PASS");
