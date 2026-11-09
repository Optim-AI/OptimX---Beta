/**
 * Kept posters as a ready-to-upload pack: images named SKX-…, a .txt of copy per poster,
 * and "How to run this test.txt". Built into private storage, downloaded via a signed link.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { buildTestPlan, type TestPlan } from '@/lib/test-packs/plan';
import { buildZip, type ZipEntry } from '@/lib/test-packs/zip';
import { extensionFor } from '@/lib/test-packs/naming';
import { AD_FORMATS, type AdFormat } from './options';
import { draftWhy, type DraftAngle } from './why';
import { AdStudioError, publishPending } from './service';
import * as store from './store';

export const ZIP_BUCKET = 'test-packs';

/** Currency + 30-day average cost per purchase from the user's synced Meta data (if any). */
export async function accountBasis(userId: string): Promise<{ currency: string; avgCpa: number | null }> {
  const conn = await MetaConnectionDAO.getByUser(userId).catch(() => null);
  if (!conn) return { currency: 'INR', avgCpa: null };
  const assets = await MetaConnectionDAO.listAssets(userId);
  const currency = assets.find((a) => a.kind === 'ad_account' && a.selected)?.currency ?? 'INR';
  const r = (await db.execute(sql`
    select case when sum(purchases) > 0 then sum(spend) / sum(purchases) end as cpa
    from meta_ad_insights_daily where connection_id = ${conn.id} and date >= current_date - 30`)) as unknown as { rows: { cpa: string | null }[] };
  const cpa = r.rows[0]?.cpa;
  return { currency, avgCpa: cpa != null ? Number(cpa) : null };
}

export async function testPlanFor(userId: string, adNames: string[]): Promise<TestPlan | null> {
  if (!adNames.length) return null;
  const { currency, avgCpa } = await accountBasis(userId);
  return buildTestPlan({ variants: adNames.length, currency, avgCpa, adNames, hasTestFirst: false });
}

function copyText(d: store.DraftRow): string {
  const why = draftWhy(d.angle as DraftAngle);
  return [
    `Ad name: ${d.adName}`,
    `Size: ${AD_FORMATS[d.format as AdFormat]?.label ?? d.format} (${AD_FORMATS[d.format as AdFormat]?.aspect ?? ''})`,
    '',
    `Headline:\n${d.headline ?? ''}`,
    '',
    `Primary text:\n${d.primaryText ?? ''}`,
    '',
    `Who it's for: ${why.forWho}`,
    why.whatItTests ? `What it tests: ${why.whatItTests}` : '',
    why.whyItMightWork ? `Why it might work: ${why.whyItMightWork}` : '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') + '\n';
}

export async function keptZipUrl(userId: string, projectId: string, deps: { fetchImpl?: typeof fetch } = {}): Promise<string> {
  const project = await store.getProject(userId, projectId);
  if (!project) throw new AdStudioError('Not found', 404);
  await publishPending(userId, projectId);
  const kept = (await store.listDrafts(projectId)).filter((d) => d.kept && d.finalUrl && d.adName);
  if (!kept.length) throw new AdStudioError('Keep at least one poster first.', 409);

  const doFetch = deps.fetchImpl ?? fetch;
  const entries: ZipEntry[] = [];
  for (const d of kept) {
    const res = await doFetch(d.finalUrl!);
    if (!res.ok) throw new Error(`Could not read ${d.adName} (${res.status})`);
    entries.push({ name: `${d.adName}.${extensionFor(res.headers.get('content-type'))}`, data: Buffer.from(await res.arrayBuffer()) });
    entries.push({ name: `${d.adName}.txt`, data: Buffer.from(copyText(d), 'utf8') });
  }
  const plan = await testPlanFor(userId, kept.map((d) => d.adName!));
  if (plan) entries.push({ name: 'How to run this test.txt', data: Buffer.from(['How to run this test', '', ...plan.steps.map((s, i) => `${i + 1}. ${s}`), ''].join('\n'), 'utf8') });

  const path = `${userId}/posters/${projectId}/SKX-${project.productSlug}-ads.zip`;
  const { supabaseAdmin } = await import('@/auth/supabase/admin');
  const up = await supabaseAdmin.storage.from(ZIP_BUCKET).upload(path, buildZip(entries), { contentType: 'application/zip', upsert: true });
  if (up.error) throw new Error(`ZIP upload failed: ${up.error.message}`);
  const signed = await supabaseAdmin.storage.from(ZIP_BUCKET).createSignedUrl(path, 10 * 60, { download: true });
  if (signed.error || !signed.data?.signedUrl) throw new Error(`ZIP link failed: ${signed.error?.message}`);
  return signed.data.signedUrl;
}
