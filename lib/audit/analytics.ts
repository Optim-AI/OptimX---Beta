/** Funnel events via the existing Vercel Analytics integration (client-side). */

import { getSafeNextPath } from '@/lib/routing/safe-next';
import { POST_AUTH_WORKSPACE_PATH } from '@/lib/auth/post-auth-decision';

export type AuditFunnelEvent =
  | 'audit_started'
  | 'audit_completed'
  | 'audit_results_viewed'
  | 'audit_idea_selected'
  | 'audit_campaign_started'
  | 'signup_completed'
  | 'audit_claimed'
  | 'audit_paid_conversion';

const ATTRIBUTION_KEY = 'skalx_audit_attribution';

export function trackAuditEvent(event: AuditFunnelEvent, data: Record<string, string | number | boolean | null> = {}) {
  if (typeof window === 'undefined') return;
  import('@vercel/analytics')
    .then((m) => m.track(event, data))
    .catch(() => undefined);
}

/** Remember the audit that led to this account so a later checkout is attributed. */
export function rememberAuditAttribution(auditId: string) {
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ auditId, at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

export function consumeAuditAttribution(): string | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(ATTRIBUTION_KEY);
    const parsed = JSON.parse(raw) as { auditId?: string; at?: number };
    if (!parsed.auditId || !parsed.at || Date.now() - parsed.at > 30 * 86_400_000) return null;
    return parsed.auditId;
  } catch {
    return null;
  }
}

export function isAuditNextPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && /^\/audit\/[0-9a-f-]{36}(?:[/?#].*)?$/i.test(path);
}

/**
 * Onboarding pricing step after a free audit (`/try?from=audit`).
 * The public marketing page `/pricing` is not part of this funnel.
 */
export function isAuditPricingNextPath(path: string | null | undefined): path is string {
  if (typeof path !== 'string') return false;
  const qIndex = path.indexOf('?');
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex);
  if (pathname !== '/try' && pathname !== '/pricing') return false;
  const q = qIndex === -1 ? '' : path.slice(qIndex + 1);
  return new URLSearchParams(q).get('from') === 'audit';
}

/** Where to send someone after auth when they came from a free audit. */
export function auditPricingPath(): string {
  return '/try?from=audit';
}

/**
 * Free-audit continuation paths honored for new accounts:
 * the onboarding pricing step, or a legacy /audit/:id return.
 * Older `/pricing?from=audit` links are folded into the onboarding step.
 * Grants no paid access.
 */
export function auditReturnPath(next: unknown): string | null {
  const safe = getSafeNextPath(next, '');
  if (isAuditPricingNextPath(safe)) return auditPricingPath();
  if (isAuditNextPath(safe)) return safe;
  return null;
}

/** App pages a signed-out person can be returned to after signing in again. */
const APP_RETURN_PREFIXES = [
  '/photo-studio', '/brand-kit', '/brand-studio', '/content-studio', '/brand-research',
  '/image-library', '/create-campaign', '/library', '/integrations', '/analytics', '/settings', '/buy-credits',
];

export function appReturnPath(next: unknown): string | null {
  const safe = getSafeNextPath(next, '');
  return APP_RETURN_PREFIXES.some((p) => safe === p || safe.startsWith(`${p}/`) || safe.startsWith(`${p}?`)) ? safe : null;
}

/** Checkout handoff a new account can resume after sign-in. Does not grant access. */
export function checkoutReturnPath(next: unknown): string | null {
  const safe = getSafeNextPath(next, '');
  return /^\/subscribe\?plan=(skalx_starter|skalx_growth|skalx_pro)$/.test(safe) ? safe : null;
}

/**
 * Where to go after auth.
 * Existing accounts (workspace) enter the product.
 * New accounts continue the funnel: audit pricing, checkout, or /try.
 */
export function resolvePostAuthPath(decisionPath: string, next: unknown): string {
  if (decisionPath === POST_AUTH_WORKSPACE_PATH) {
    return appReturnPath(next) ?? decisionPath;
  }
  return auditReturnPath(next) ?? checkoutReturnPath(next) ?? decisionPath;
}
