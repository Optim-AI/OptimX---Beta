/**
 * Safe stage-level diagnostics for the marketing audit pipeline.
 * Never includes secrets, raw prompts, API keys, or full provider payloads.
 */

export type AuditProvider =
  | 'website'
  | 'gemini'
  | 'serpapi'
  | 'meta_ad_library'
  | 'google_ads'
  | 'none';

export type AuditStageOutcome =
  | 'ok'
  | 'empty'
  | 'partial'
  | 'skipped'
  | 'provider_error'
  | 'config_missing'
  | 'missing_key'
  | 'timeout'
  | 'quota'
  | 'parse_error'
  | 'rejected';

export type StageDiagnostic = {
  correlationId: string;
  stage: string;
  provider: AuditProvider;
  elapsedMs: number;
  outcome: AuditStageOutcome;
  /** Short machine code, e.g. gemini_quota, serp_http_401 */
  errorClass?: string;
  /** Sanitized human detail — no secrets */
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export function newAuditCorrelationId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function classifyProviderError(err: unknown): {
  outcome: AuditStageOutcome;
  errorClass: string;
  detail: string;
} {
  const status = (err as { status?: number })?.status;
  const msg = String((err as Error)?.message ?? err ?? 'unknown').slice(0, 240);
  if ((err as { name?: string })?.name === 'AbortError' || /aborted|timeout/i.test(msg)) {
    return { outcome: 'timeout', errorClass: 'timeout', detail: 'Provider request timed out' };
  }
  if (status === 401 || status === 403 || /api[_-]?key|permission|unauthorized|forbidden/i.test(msg)) {
    return { outcome: 'config_missing', errorClass: `http_${status || 'auth'}`, detail: 'Provider rejected credentials' };
  }
  if (
    status === 429 ||
    /quota|RESOURCE_EXHAUSTED|rate limit|billing|exceeded your current/i.test(msg)
  ) {
    return { outcome: 'quota', errorClass: status === 429 ? 'rate_limit' : 'quota', detail: 'Provider quota or rate limit' };
  }
  if (status && status >= 500) {
    return { outcome: 'provider_error', errorClass: `http_${status}`, detail: 'Provider server error' };
  }
  if (status && status >= 400) {
    return { outcome: 'provider_error', errorClass: `http_${status}`, detail: 'Provider client error' };
  }
  return { outcome: 'provider_error', errorClass: 'exception', detail: msg.slice(0, 120) };
}

export function logStageDiagnostic(d: StageDiagnostic): void {
  const parts = [
    `[audit:${d.correlationId}]`,
    `stage=${d.stage}`,
    `provider=${d.provider}`,
    `outcome=${d.outcome}`,
    `ms=${d.elapsedMs}`,
  ];
  if (d.errorClass) parts.push(`class=${d.errorClass}`);
  if (d.detail) parts.push(`detail=${d.detail}`);
  if (d.meta) {
    for (const [k, v] of Object.entries(d.meta)) {
      if (v == null) continue;
      parts.push(`${k}=${String(v).slice(0, 80)}`);
    }
  }
  const line = parts.join(' ');
  if (d.outcome === 'ok' || d.outcome === 'empty' || d.outcome === 'partial' || d.outcome === 'skipped') {
    console.info(line);
  } else {
    console.warn(line);
  }
}

export function recordDiagnostic(list: StageDiagnostic[], d: StageDiagnostic): void {
  list.push(d);
  logStageDiagnostic(d);
}
