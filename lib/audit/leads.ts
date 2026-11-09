/**
 * Free brand audit leads: one free audit per email. Stores the email, category and website
 * for sales follow-up (audit_leads table).
 */
import { eq } from 'drizzle-orm';
import { db } from '@/database/client';
import { auditLeads, marketingAudits } from '@/database/schema';

export { cleanLeadCategory, normalizeLeadEmail } from './lead-input';

export type AuditLeadRow = typeof auditLeads.$inferSelect;

/** audit_leads not created yet (migration not applied): log once and let audits run. */
function isMissingLeadsTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = String(e?.code || e?.cause?.code || '');
  const msg = String(e?.message || e?.cause?.message || '');
  return code === '42P01' || /audit_leads/.test(msg) && /does not exist/.test(msg);
}

let warnedMissingTable = false;
function warnMissingTable() {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn('[audit-leads] audit_leads table missing; apply supabase/migrations/20261109090000_audit_leads.sql. Leads are not being stored.');
}

/** The lead (and its audit, if still present) already recorded for this email. */
export async function findLeadByEmail(emailNormalized: string) {
  let lead: AuditLeadRow | undefined;
  try {
    [lead] = await db.select().from(auditLeads).where(eq(auditLeads.emailNormalized, emailNormalized)).limit(1);
  } catch (e) {
    if (isMissingLeadsTable(e)) {
      warnMissingTable();
      return null;
    }
    throw e;
  }
  if (!lead) return null;
  const [audit] = lead.auditId
    ? await db.select().from(marketingAudits).where(eq(marketingAudits.id, lead.auditId)).limit(1)
    : [];
  return { lead, audit: audit ?? null };
}

/**
 * Record a lead for a new audit. Returns false when the email was taken by a concurrent
 * request (unique index), so the caller can treat it as "already used".
 */
export async function recordLead(input: {
  email: string;
  emailNormalized: string;
  category: string | null;
  websiteUrl: string;
  host: string;
  auditId: string;
  ipHash: string;
}): Promise<boolean> {
  try {
    return await insertLead(input);
  } catch (e) {
    if (isMissingLeadsTable(e)) {
      warnMissingTable();
      return false;
    }
    throw e;
  }
}

async function insertLead(input: Parameters<typeof recordLead>[0]): Promise<boolean> {
  const rows = await db
    .insert(auditLeads)
    .values({
      email: input.email.trim(),
      emailNormalized: input.emailNormalized,
      category: input.category,
      websiteUrl: input.websiteUrl,
      normalizedHost: input.host,
      auditId: input.auditId,
      clientIpHash: input.ipHash,
    })
    .onConflictDoNothing({ target: auditLeads.emailNormalized })
    .returning({ id: auditLeads.id });
  return rows.length > 0;
}
