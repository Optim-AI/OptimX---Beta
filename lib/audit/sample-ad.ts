/**
 * One sample ad for a free brand audit (Nano Banana), built from the audit's first idea.
 *
 * Cost controls:
 * - Only audits started with an email (an audit_leads row) get a sample; one per lead, ever.
 * - A daily cap across all leads (AUDIT_SAMPLE_AD_DAILY_CAP, default 100). Over the cap the
 *   lead is marked "skipped" and the audit page simply leaves the sample out.
 * - A claimed run that dies is retried once it is stale (5 minutes); a failure is final.
 *
 * Stored in the campaign-assets bucket at audit-samples/{auditId}.png.
 */
import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { auditLeads } from '@/database/schema';
import type { AuditRow } from './store';
import type { AuditBrand, ContentIdea } from './types';
import { buildSampleAdPrompt } from './sample-ad-prompt';

export { buildSampleAdPrompt };

export type SampleAdState =
  | { status: 'none' }
  | { status: 'generating' }
  | { status: 'ready'; url: string; ideaIndex: number }
  | { status: 'failed' | 'skipped' };

const STALE_MS = 5 * 60_000;
const BUCKET = 'campaign-assets';

function dailyCap(): number {
  const n = Number(process.env.AUDIT_SAMPLE_AD_DAILY_CAP);
  return Number.isFinite(n) && n >= 0 ? n : 100;
}

async function leadForAudit(auditId: string) {
  const [lead] = await db.select().from(auditLeads).where(eq(auditLeads.auditId, auditId)).limit(1);
  return lead ?? null;
}

function toState(lead: typeof auditLeads.$inferSelect | null): SampleAdState {
  if (!lead || !lead.sampleAdStatus) return { status: 'none' };
  if (lead.sampleAdStatus === 'ready' && lead.sampleAdUrl) return { status: 'ready', url: lead.sampleAdUrl, ideaIndex: 0 };
  if (lead.sampleAdStatus === 'generating') return { status: 'generating' };
  return { status: lead.sampleAdStatus === 'skipped' ? 'skipped' : 'failed' };
}

/** Current state without starting anything. */
export async function getSampleAd(auditId: string): Promise<SampleAdState> {
  return toState(await leadForAudit(auditId));
}

/**
 * Generate the sample once (if allowed) and return its state. Safe to call repeatedly:
 * only one caller can claim the work.
 */
export async function ensureSampleAd(audit: AuditRow): Promise<SampleAdState> {
  const lead = await leadForAudit(audit.id);
  if (!lead) return { status: 'none' };
  const ideas = (audit.ideas as ContentIdea[] | null) ?? [];
  if (!ideas.length || !(audit.status === 'completed' || audit.status === 'partial')) return toState(lead);
  if (lead.sampleAdStatus && lead.sampleAdStatus !== 'generating') return toState(lead);

  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const claimed = await db
    .update(auditLeads)
    .set({ sampleAdStatus: 'generating', sampleAdStartedAt: new Date().toISOString(), sampleAdError: null })
    .where(
      and(
        eq(auditLeads.id, lead.id),
        or(isNull(auditLeads.sampleAdStatus), and(eq(auditLeads.sampleAdStatus, 'generating'), lt(auditLeads.sampleAdStartedAt, staleBefore)))
      )
    )
    .returning({ id: auditLeads.id });
  if (!claimed.length) return toState(await leadForAudit(audit.id));

  // Global daily cap on paid generations.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLeads)
    .where(and(eq(auditLeads.sampleAdStatus, 'ready'), gte(auditLeads.sampleAdCreatedAt, since)));
  if (count >= dailyCap()) {
    await db.update(auditLeads).set({ sampleAdStatus: 'skipped', sampleAdError: 'daily_cap' }).where(eq(auditLeads.id, lead.id));
    return { status: 'skipped' };
  }

  try {
    const { generateGeminiImage } = await import('@/lib/creative-studio/nano-banana');
    const image = await generateGeminiImage({
      prompt: buildSampleAdPrompt(audit.brand as AuditBrand | null, audit.normalizedHost, ideas[0]),
      aspectRatio: '4:5',
      operationLabel: 'audit-sample-ad',
      maxRetries: 1,
    });
    const ext = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/webp' ? 'webp' : 'png';
    const path = `audit-samples/${audit.id}.${ext}`;
    const { supabaseAdmin } = await import('@/auth/supabase/admin');
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, image.buffer, { cacheControl: '86400', contentType: image.mimeType || 'image/png', upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await db
      .update(auditLeads)
      .set({ sampleAdStatus: 'ready', sampleAdUrl: url, sampleAdCreatedAt: new Date().toISOString() })
      .where(eq(auditLeads.id, lead.id));
    return { status: 'ready', url, ideaIndex: 0 };
  } catch (e) {
    const message = (e as Error)?.message?.slice(0, 300) || 'unknown';
    console.error('[audit-sample-ad] generation failed', { auditId: audit.id, message });
    await db.update(auditLeads).set({ sampleAdStatus: 'failed', sampleAdError: message }).where(eq(auditLeads.id, lead.id));
    return { status: 'failed' };
  }
}
