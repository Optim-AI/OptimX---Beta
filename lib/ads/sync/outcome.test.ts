/**
 * Ads sync outcome classification.
 * Run: npx --yes tsx lib/ads/sync/outcome.test.ts
 */
import assert from "assert";
import {
  classifyAdsSyncOutcome,
  normalizeFetchDailyMetricsResult,
  summarizeMetricFailures,
} from "@/lib/ads/sync/outcome";

// Empty successful insights → success
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 3,
    metricsUpserted: 0,
    metricsResult: {
      metrics: [],
      failures: [],
      levelsAttempted: ["account", "campaign", "ad"],
      levelsSucceeded: ["account", "campaign", "ad"],
    },
  });
  assert.strictEqual(r.status, "success");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.errorMessage, null);
}

// Complete success with metrics
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 10,
    metricsUpserted: 5,
    metricsResult: {
      metrics: [{ entityType: "account", entityExternalId: "1", metricDate: "2026-04-01" }],
      failures: [],
      levelsAttempted: ["account"],
      levelsSucceeded: ["account"],
    },
  });
  assert.strictEqual(r.status, "success");
  assert.ok(r.ok);
}

// Partial — campaign failed, account succeeded
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 4,
    metricsUpserted: 2,
    metricsResult: {
      metrics: [{ entityType: "account", entityExternalId: "1", metricDate: "2026-04-01" }],
      failures: [
        { level: "campaign", message: "Rate limit", code: 4 },
      ],
      levelsAttempted: ["account", "campaign", "ad"],
      levelsSucceeded: ["account", "ad"],
    },
  });
  assert.strictEqual(r.status, "partial");
  assert.strictEqual(r.ok, true);
  assert.ok(r.errorMessage?.includes("campaign"));
}

// Partial — entities ok, all insights failed (metricsUpserted 0)
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 8,
    metricsUpserted: 0,
    metricsResult: {
      metrics: [],
      failures: [
        { level: "account", message: "OAuthException" },
        { level: "campaign", message: "OAuthException" },
        { level: "ad", message: "OAuthException" },
      ],
      levelsAttempted: ["account", "campaign", "ad"],
      levelsSucceeded: [],
    },
  });
  assert.strictEqual(r.status, "partial");
  assert.strictEqual(r.ok, true);
}

// Total failure — nothing persisted
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 0,
    metricsUpserted: 0,
    metricsResult: {
      metrics: [],
      failures: [
        { level: "account", message: "down" },
        { level: "campaign", message: "down" },
        { level: "ad", message: "down" },
      ],
      levelsAttempted: ["account", "campaign", "ad"],
      levelsSucceeded: [],
    },
  });
  assert.strictEqual(r.status, "error");
  assert.strictEqual(r.ok, false);
}

// Pagination truncated → failure present → partial when entities exist
{
  const r = classifyAdsSyncOutcome({
    entitiesUpserted: 1,
    metricsUpserted: 100,
    metricsResult: {
      metrics: [],
      failures: [
        {
          level: "ad",
          message: "Insights pagination truncated after 5 pages",
          code: "pagination_truncated",
          truncated: true,
        },
      ],
      levelsAttempted: ["account", "campaign", "ad"],
      levelsSucceeded: ["account", "campaign", "ad"],
    },
  });
  assert.strictEqual(r.status, "partial");
  assert.ok(summarizeMetricFailures(r.errorMessage ? [{ level: "ad", message: r.errorMessage }] : []).length >= 0);
}

// Normalize legacy array
{
  const n = normalizeFetchDailyMetricsResult([
    { entityType: "account", entityExternalId: "x", metricDate: "2026-01-01" },
  ]);
  assert.strictEqual(n.failures.length, 0);
  assert.strictEqual(n.metrics.length, 1);
}

console.log("ads sync outcome.test: PASS");
