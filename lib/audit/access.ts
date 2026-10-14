/**
 * Pure ownership + public projection for marketing audits (no DB imports so it
 * stays unit-testable). An audit is visible only to the profile that owns it:
 * the guest shadow profile behind the HttpOnly cookie, or the signed-in user.
 */

import { AUDIT_STAGES, type AuditStage, type AuditStageName, type AuditStatus, type PublicAudit } from './types';

export type AuditViewer = { authUserId: string | null; guestProfileId: string | null };

export const MAX_AUDIT_ATTEMPTS = 3;

export function canAccessAudit(ownerId: string | null | undefined, viewer: AuditViewer): boolean {
  if (!ownerId) return false;
  return ownerId === viewer.authUserId || ownerId === viewer.guestProfileId;
}

/** Campaign creation needs a real account that owns (or can claim) the audit. */
export function campaignAccess(
  ownerId: string,
  viewer: AuditViewer
): 'ok' | 'needs_auth' | 'needs_claim' | 'forbidden' {
  if (!viewer.authUserId) return canAccessAudit(ownerId, viewer) ? 'needs_auth' : 'forbidden';
  if (ownerId === viewer.authUserId) return 'ok';
  if (ownerId === viewer.guestProfileId) return 'needs_claim';
  return 'forbidden';
}

export type AuditRowLike = {
  id: string;
  userId: string;
  websiteUrl: string;
  normalizedHost: string;
  status: string;
  stage: string;
  attemptCount: number;
  site: unknown;
  brand: unknown;
  competitors: unknown;
  competitorPosts: unknown;
  insights: unknown;
  ideas: unknown;
  sources: unknown;
  limitations: unknown;
  selectedIdeaIndex: number | null;
  campaignSessionId: string | null;
  error: unknown;
  createdAt: string | null;
  completedAt: string | null;
  leaseExpiresAt: string | null;
};

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function completedStages(stage: string): AuditStageName[] {
  const idx = AUDIT_STAGES.indexOf(stage as AuditStageName);
  return idx < 0 ? [] : AUDIT_STAGES.slice(0, idx + 1);
}

export function canRetryAudit(row: Pick<AuditRowLike, 'status' | 'attemptCount' | 'leaseExpiresAt'>, now = Date.now()) {
  if (row.attemptCount >= MAX_AUDIT_ATTEMPTS) return false;
  if (row.status === 'failed' || row.status === 'queued') return true;
  if (row.status === 'running') return !row.leaseExpiresAt || new Date(row.leaseExpiresAt).getTime() < now;
  return false;
}

/** Strips owner ids, IP hashes, raw page text, and provider payloads. */
export function toPublicAudit(row: AuditRowLike, viewer: AuditViewer): PublicAudit {
  const site = row.site as PublicAudit['site'] & { excerpt?: string };
  const err = row.error as { code?: string; message?: string } | null;
  return {
    id: row.id,
    websiteUrl: row.websiteUrl,
    host: row.normalizedHost,
    status: row.status as AuditStatus,
    stage: row.stage as AuditStage,
    progress: { stage: row.stage as AuditStage, completed: completedStages(row.stage) },
    canRetry: canRetryAudit(row),
    site: site
      ? { finalUrl: site.finalUrl, title: site.title, description: site.description, retrievedAt: site.retrievedAt }
      : null,
    brand: (row.brand as PublicAudit['brand']) ?? null,
    competitors: arr(row.competitors),
    competitorPosts: arr(row.competitorPosts),
    insights: (row.insights as PublicAudit['insights']) ?? null,
    ideas: arr(row.ideas),
    sources: arr(row.sources),
    limitations: arr(row.limitations),
    selectedIdeaIndex: row.selectedIdeaIndex,
    campaignSessionId: row.campaignSessionId,
    error: err?.code ? { code: err.code, message: err.message || 'Something went wrong.' } : null,
    ownedByGuest: row.userId !== viewer.authUserId && row.userId === viewer.guestProfileId,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}
