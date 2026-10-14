/**
 * Safe audit API error classification and logging.
 * Never logs secrets, cookies, auth headers, or raw request bodies.
 */

import { randomUUID } from 'crypto';

export type AuditApiStage =
  | 'create'
  | 'run'
  | 'get'
  | 'select'
  | 'campaign'
  | 'guest_session'
  | 'persist'
  | 'rate_limit'
  | 'url_validate';

export type ClassifiedAuditError = {
  /** Stable machine code for clients / logs */
  code: string;
  /** Safe message suitable for the browser */
  message: string;
  /** HTTP status to return */
  status: number;
  /** Short operator hint (no secrets) */
  detail: string;
};

const CLIENT_MESSAGES: Record<string, string> = {
  method_not_allowed: 'Method not allowed',
  invalid_url: 'Enter a valid website address (for example, https://example.com).',
  private_address: 'That address points to a private or internal network.',
  dns: "We couldn't find that website. Check the spelling and try again.",
  rate_limited: "You've run several audits recently. Please try again later.",
  not_found: 'Audit not found.',
  audit_storage_unavailable:
    'Audit storage is temporarily unavailable. Please try again in a few minutes.',
  database_error: "We couldn't save your audit right now. Please try again.",
  guest_session_failed: "We couldn't start a guest session. Please try again.",
  server_error: "We couldn't start your audit. Please try again.",
  run_failed: 'Something went wrong running your audit.',
};

export function newAuditRequestId(): string {
  return randomUUID();
}

export function clientMessageForCode(code: string, fallback?: string): string {
  return CLIENT_MESSAGES[code] || fallback || CLIENT_MESSAGES.server_error;
}

/**
 * Map driver / runtime errors from the create/persist path to a stable response.
 * Does not include SQL, connection strings, or stack traces in the client payload.
 */
export function classifyAuditPersistError(err: unknown): ClassifiedAuditError {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const pgCode = String(e?.code || e?.cause?.code || '');
  const msg = String(e?.message || e?.cause?.message || '').toLowerCase();

  // Postgres undefined_table / undefined_column
  if (
    pgCode === '42P01' ||
    pgCode === '42703' ||
    /relation ["']?marketing_audits["']? does not exist/.test(msg) ||
    (/marketing_audits/.test(msg) && /does not exist/.test(msg))
  ) {
    return {
      code: 'audit_storage_unavailable',
      message: CLIENT_MESSAGES.audit_storage_unavailable,
      status: 503,
      detail: 'marketing_audits_missing_or_schema_mismatch',
    };
  }

  // FK / integrity — guest profile or related row missing
  if (pgCode === '23503' || /foreign key|violates foreign key/i.test(msg)) {
    return {
      code: 'database_error',
      message: CLIENT_MESSAGES.database_error,
      status: 500,
      detail: 'foreign_key_violation',
    };
  }

  if (/timeout|etimedout|econnrefused|connection terminated|too many connections/i.test(msg)) {
    return {
      code: 'database_error',
      message: CLIENT_MESSAGES.database_error,
      status: 503,
      detail: 'database_connectivity',
    };
  }

  return {
    code: 'server_error',
    message: CLIENT_MESSAGES.server_error,
    status: 500,
    detail: 'unhandled_create_error',
  };
}

/** Structured console log — never pass cookies, tokens, or PII fields. */
export function logAuditApiError(input: {
  requestId: string;
  stage: AuditApiStage;
  code: string;
  detail?: string;
  err?: unknown;
  host?: string;
  auditId?: string;
}) {
  const err = input.err as { name?: string; code?: string; message?: string } | undefined;
  const safeMessage = String(err?.message || '')
    .replace(/password=[^&\s]+/gi, 'password=[redacted]')
    .replace(/api[_-]?key=[^&\s]+/gi, 'api_key=[redacted]')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .slice(0, 240);

  console.error(
    JSON.stringify({
      scope: 'marketing_audit',
      requestId: input.requestId,
      stage: input.stage,
      code: input.code,
      detail: input.detail || undefined,
      host: input.host || undefined,
      auditId: input.auditId || undefined,
      errName: err?.name || undefined,
      errCode: err?.code || undefined,
      errMessage: safeMessage || undefined,
    })
  );
}
