/**
 * Pure helpers for Meta Ads sync outcome messaging in Integrations UI.
 */

export type AdsSyncApiResult = {
  ok?: boolean;
  status?: string;
  metricsUpserted?: number;
  entitiesUpserted?: number;
  errorMessage?: string | null;
  error?: string;
  warnings?: string[];
};

export type SyncFeedbackTone = "info" | "success" | "warning" | "error";

export type SyncFeedback = {
  tone: SyncFeedbackTone;
  message: string;
  /** When true, status should be refreshed and retry offered */
  shouldRefreshStatus: boolean;
};

/** Normalize runner/API syncStatus values the UI understands. */
export function normalizeSyncStatus(raw: string | null | undefined): string {
  const s = String(raw || "idle").toLowerCase();
  if (s === "syncing" || s === "running" || s === "in_progress") return "running";
  if (s === "failed" || s === "error") return "error";
  if (s === "partial") return "partial";
  if (s === "success" || s === "succeeded" || s === "ok") return "success";
  return s || "idle";
}

/** Safe, user-facing sync error (strip tokens / stack noise). */
export function sanitizeSyncErrorMessage(
  raw: string | null | undefined,
  fallback = "Sync failed. Try again."
): string {
  if (!raw) return fallback;
  let t = String(raw).trim();
  if (!t) return fallback;
  // Redact anything that looks like a token
  t = t.replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]");
  t = t.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]");
  if (t.length > 240) t = `${t.slice(0, 237)}…`;
  return t;
}

export function formatLastSyncedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return d.toISOString();
  }
}

/**
 * Interpret POST /api/ads/sync JSON + HTTP status.
 * Never reports success for partial or error.
 */
export function interpretAdsSyncResponse(
  httpOk: boolean,
  body: AdsSyncApiResult | null | undefined
): SyncFeedback {
  const status = normalizeSyncStatus(body?.status);
  const err = sanitizeSyncErrorMessage(
    body?.errorMessage || body?.error || null
  );

  if (!httpOk || status === "error" || body?.ok === false) {
    return {
      tone: "error",
      message: err,
      shouldRefreshStatus: true,
    };
  }

  if (status === "partial") {
    const detail =
      sanitizeSyncErrorMessage(body?.errorMessage, "") ||
      (body?.warnings?.length ? body.warnings.slice(0, 2).join("; ") : "");
    return {
      tone: "warning",
      message: detail
        ? `Partial sync — ${detail}`
        : "Partial sync — some metrics may be incomplete. Retry when ready.",
      shouldRefreshStatus: true,
    };
  }

  const rows = body?.metricsUpserted ?? 0;
  return {
    tone: "success",
    message: `Sync succeeded (${rows} metric row${rows === 1 ? "" : "s"})`,
    shouldRefreshStatus: true,
  };
}
