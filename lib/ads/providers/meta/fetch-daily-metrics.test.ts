/**
 * Meta daily insights collection — failure reporting.
 * Run: npx --yes tsx lib/ads/providers/meta/fetch-daily-metrics.test.ts
 */
import assert from "assert";
import { collectMetaDailyMetrics } from "@/lib/ads/providers/meta/fetch-daily-metrics";
import type { MetaInsightsPager } from "@/lib/ads/providers/meta/fetch-daily-metrics";

const range = { since: "2026-04-01", until: "2026-04-03" };

function pagerFromMap(
  map: Record<string, { items?: any[]; truncated?: boolean; throwMsg?: string }>
): MetaInsightsPager {
  return async (_path, _token, params) => {
    const level = String(params.level || "");
    const entry = map[level] || { items: [] };
    if (entry.throwMsg) {
      const err = new Error(entry.throwMsg) as Error & { code?: number };
      err.code = 1;
      throw err;
    }
    return {
      items: entry.items || [],
      pagesFetched: 1,
      truncated: Boolean(entry.truncated),
    };
  };
}

async function main() {
  // Complete success (including empty range)
  {
    const r = await collectMetaDailyMetrics({
      accountId: "111",
      accessToken: "tok",
      range,
      getAll: pagerFromMap({
        account: { items: [] },
        campaign: { items: [] },
        ad: { items: [] },
      }),
    });
    assert.strictEqual(r.failures.length, 0);
    assert.deepStrictEqual(r.levelsSucceeded, ["account", "campaign", "ad"]);
    assert.strictEqual(r.metrics.length, 0);
  }

  // Partial — campaign fails, account succeeds
  {
    const r = await collectMetaDailyMetrics({
      accountId: "111",
      accessToken: "tok",
      range,
      getAll: pagerFromMap({
        account: {
          items: [
            {
              date_start: "2026-04-01",
              spend: "10",
              impressions: "100",
              clicks: "5",
            },
          ],
        },
        campaign: { throwMsg: "Campaign insights unavailable" },
        ad: { items: [] },
      }),
    });
    assert.ok(r.metrics.length >= 1);
    assert.ok(r.failures.some((f) => f.level === "campaign"));
    assert.ok(r.levelsSucceeded.includes("account"));
    assert.ok(!r.levelsSucceeded.includes("campaign"));
  }

  // Total insight failure
  {
    const r = await collectMetaDailyMetrics({
      accountId: "111",
      accessToken: "tok",
      range,
      getAll: pagerFromMap({
        account: { throwMsg: "account down" },
        campaign: { throwMsg: "campaign down" },
        ad: { throwMsg: "ad down" },
      }),
    });
    assert.strictEqual(r.metrics.length, 0);
    assert.strictEqual(r.failures.length, 3);
    assert.strictEqual(r.levelsSucceeded.length, 0);
  }

  // Pagination truncated → failure with truncated flag, level still succeeded
  {
    const r = await collectMetaDailyMetrics({
      accountId: "111",
      accessToken: "tok",
      range,
      getAll: pagerFromMap({
        account: { items: [] },
        campaign: { items: [{ date_start: "2026-04-01", campaign_id: "c1", spend: "1" }], truncated: true },
        ad: { items: [] },
      }),
    });
    const trunc = r.failures.find((f) => f.code === "pagination_truncated");
    assert.ok(trunc);
    assert.strictEqual(trunc!.truncated, true);
    assert.ok(r.levelsSucceeded.includes("campaign"));
    assert.ok(r.metrics.some((m) => m.entityType === "campaign"));
  }

  // Currency stamp — INR account
  {
    const r = await collectMetaDailyMetrics({
      accountId: "111",
      accessToken: "tok",
      range,
      currency: "INR",
      getAll: pagerFromMap({
        account: {
          items: [
            {
              date_start: "2026-04-01",
              spend: "100",
              impressions: "10",
              clicks: "1",
            },
          ],
        },
        campaign: { items: [] },
        ad: { items: [] },
      }),
    });
    assert.ok(r.metrics.length >= 1);
    assert.ok(r.metrics.every((m) => m.currency === "INR"));
  }

  // Currency stamp — non-INR (USD)
  {
    const r = await collectMetaDailyMetrics({
      accountId: "222",
      accessToken: "tok",
      range,
      currency: "usd",
      getAll: pagerFromMap({
        account: {
          items: [
            {
              date_start: "2026-04-02",
              spend: "25",
              impressions: "50",
              clicks: "2",
            },
          ],
        },
        campaign: {
          items: [
            {
              date_start: "2026-04-02",
              campaign_id: "c9",
              spend: "25",
            },
          ],
        },
        ad: { items: [] },
      }),
    });
    assert.ok(r.metrics.every((m) => m.currency === "USD"));
  }

  // Missing currency → null (runner stamps from selected account)
  {
    const r = await collectMetaDailyMetrics({
      accountId: "333",
      accessToken: "tok",
      range,
      getAll: pagerFromMap({
        account: {
          items: [{ date_start: "2026-04-01", spend: "1" }],
        },
        campaign: { items: [] },
        ad: { items: [] },
      }),
    });
    assert.ok(r.metrics.every((m) => m.currency == null));
  }

  console.log("meta fetch-daily-metrics.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
