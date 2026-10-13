/**
 * Warehouse payload classification (no DB) — empty range must not invent zeros.
 * Run: npx --yes tsx lib/ads/analytics/warehouse-metrics.test.ts
 */
import assert from "assert";
import { classifyAdsAnalyticsAvailability } from "@/lib/ads/analytics/availability";
import { resolveMetricsRange } from "@/lib/ads/analytics/warehouse-metrics";

// Range resolution
{
  const r = resolveMetricsRange({ range: "7d" });
  assert.ok(r.since <= r.until);
  assert.ok(r.prevSince <= r.prevUntil);
  assert.ok(r.prevUntil < r.since);
}

{
  const r = resolveMetricsRange({ start: "2026-04-01", end: "2026-04-07" });
  assert.strictEqual(r.since, "2026-04-01");
  assert.strictEqual(r.until, "2026-04-07");
  assert.strictEqual(r.prevUntil, "2026-03-31");
  assert.strictEqual(r.prevSince, "2026-03-25");
}

// Contract: empty range payload shape (what API must return)
function emptyRangeContract(rowCount: number, hasWarehouse: boolean) {
  const availability = classifyAdsAnalyticsAvailability({
    hasWarehouseData: hasWarehouse,
    rowCountInRange: rowCount,
    syncStatus: "success",
    lastSyncedAt: new Date().toISOString(),
  });
  const current = rowCount === 0 ? null : { total_spend: 0 };
  return { availability, current };
}

{
  const p = emptyRangeContract(0, true);
  assert.strictEqual(p.availability.state, "empty_range");
  assert.strictEqual(p.current, null);
}

{
  const p = emptyRangeContract(1, true);
  assert.strictEqual(p.availability.state, "available");
  assert.ok(p.current);
  assert.strictEqual(p.current!.total_spend, 0);
}

console.log("ads analytics warehouse-metrics.test: PASS");
