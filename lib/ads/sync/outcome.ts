/**
 * Pure helpers to classify ads sync outcomes from entity + metrics results.
 */

import type {
  AdsSyncRunStatus,
  FetchDailyMetricsResult,
  MetricsFetchFailure,
} from "@/lib/ads/types";

export function normalizeFetchDailyMetricsResult(
  raw: FetchDailyMetricsResult | unknown
): FetchDailyMetricsResult {
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as FetchDailyMetricsResult).metrics)
  ) {
    const r = raw as FetchDailyMetricsResult;
    return {
      metrics: r.metrics,
      failures: Array.isArray(r.failures) ? r.failures : [],
      levelsAttempted: Array.isArray(r.levelsAttempted) ? r.levelsAttempted : [],
      levelsSucceeded: Array.isArray(r.levelsSucceeded) ? r.levelsSucceeded : [],
    };
  }
  // Legacy providers that still return a bare array
  if (Array.isArray(raw)) {
    return {
      metrics: raw as FetchDailyMetricsResult["metrics"],
      failures: [],
      levelsAttempted: ["legacy"],
      levelsSucceeded: ["legacy"],
    };
  }
  return {
    metrics: [],
    failures: [
      {
        level: "unknown",
        message: "Provider returned an invalid metrics payload",
        code: "invalid_metrics_result",
      },
    ],
    levelsAttempted: [],
    levelsSucceeded: [],
  };
}

export function summarizeMetricFailures(failures: MetricsFetchFailure[]): string {
  if (!failures.length) return "";
  return failures
    .map((f) => {
      const code = f.code != null ? ` (${f.code})` : "";
      const trunc = f.truncated ? " [truncated]" : "";
      return `${f.level}: ${f.message}${code}${trunc}`;
    })
    .join("; ")
    .slice(0, 500);
}

/**
 * Decide run status after entities were fetched (or not) and metrics completed.
 *
 * - success: no insight failures (empty metrics OK)
 * - partial: some levels succeeded or some metrics persisted, but failures exist
 * - error: no usable sync output (no entities upserted and all insight work failed / empty with failures)
 */
export function classifyAdsSyncOutcome(opts: {
  entitiesUpserted: number;
  metricsUpserted: number;
  metricsResult: FetchDailyMetricsResult;
}): {
  status: AdsSyncRunStatus;
  errorMessage: string | null;
  ok: boolean;
} {
  const { entitiesUpserted, metricsUpserted, metricsResult } = opts;
  const failures = metricsResult.failures;
  const levelsSucceeded = metricsResult.levelsSucceeded.length;
  const levelsAttempted = metricsResult.levelsAttempted.length;

  if (!failures.length) {
    return { status: "success", errorMessage: null, ok: true };
  }

  const summary = summarizeMetricFailures(failures);
  const anyInsightSuccess =
    levelsSucceeded > 0 || metricsUpserted > 0 || metricsResult.metrics.length > 0;
  const anyEntitySuccess = entitiesUpserted > 0;

  if (anyInsightSuccess || anyEntitySuccess) {
    return {
      status: "partial",
      errorMessage: summary || "Some sync operations failed",
      ok: true,
    };
  }

  // All attempted insight levels failed and nothing was persisted
  if (levelsAttempted > 0 && levelsSucceeded === 0) {
    return {
      status: "error",
      errorMessage: summary || "All insights fetches failed",
      ok: false,
    };
  }

  return {
    status: "error",
    errorMessage: summary || "Sync produced no valid results",
    ok: false,
  };
}
