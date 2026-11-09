/**
 * Reads Meta's rate-limit headers and decides how long to wait.
 * Headers: X-Business-Use-Case-Usage (Marketing API, per business/ad account),
 * X-App-Usage (platform), X-Ad-Account-Usage (older ad calls).
 * Pure functions so they can be unit-tested.
 */

export type MetaUsage = {
  /** Highest percentage across call_count / total_cputime / total_time / acc_id_util_pct. */
  maxPct: number;
  /** Seconds Meta says to wait before access returns (BUC estimated_time_to_regain_access is in minutes). */
  regainSeconds: number;
};

type HeaderGetter = (name: string) => string | null | undefined;

function safeJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseUsageHeaders(get: HeaderGetter): MetaUsage {
  let maxPct = 0;
  let regainSeconds = 0;

  const app = safeJson(get('x-app-usage')) as Record<string, unknown> | null;
  if (app) maxPct = Math.max(maxPct, num(app.call_count), num(app.total_cputime), num(app.total_time));

  const acc = safeJson(get('x-ad-account-usage')) as Record<string, unknown> | null;
  if (acc) {
    maxPct = Math.max(maxPct, num(acc.acc_id_util_pct));
    regainSeconds = Math.max(regainSeconds, num(acc.reset_time_duration));
  }

  const buc = safeJson(get('x-business-use-case-usage')) as Record<string, unknown> | null;
  if (buc && typeof buc === 'object') {
    for (const entries of Object.values(buc)) {
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Record<string, unknown>[]) {
        maxPct = Math.max(maxPct, num(e.call_count), num(e.total_cputime), num(e.total_time));
        regainSeconds = Math.max(regainSeconds, num(e.estimated_time_to_regain_access) * 60);
      }
    }
  }
  return { maxPct, regainSeconds };
}

/** Milliseconds to pause before the next call, given current usage. 0 = go ahead. */
export function backoffMs(usage: MetaUsage): number {
  if (usage.regainSeconds > 0 && usage.maxPct >= 100) return usage.regainSeconds * 1000;
  if (usage.maxPct >= 95) return 60_000;
  if (usage.maxPct >= 85) return 15_000;
  if (usage.maxPct >= 75) return 3_000;
  return 0;
}
