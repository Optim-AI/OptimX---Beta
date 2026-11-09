/**
 * Test pack lifecycle:
 *  create (product or "Make more like this" from a winning ad) → 3 proposed angles
 *  → edit / swap → credit check → generate 3 angles × 2 formats in the background
 *  → ZIP (images + copy + test plan) → results once the ads are synced back.
 */
import { createHash } from 'crypto';
import { CreditsDAO } from '@/database';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { buildDashboard } from '@/lib/meta-intel/summary';
import { latestInsight } from '@/lib/meta-intel/insights-store';
import type { Insights } from '@/lib/meta-intel/insights-types';
import { generateAdStudioPosterPair } from '@/lib/content-studio/engine-posters';
import { metaLog } from '@/lib/meta/log';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import { proposeAngles, NoAngleSourcesError, type WinnerContext } from './angles';
import { adNamesForPack, extensionFor, slugPart } from './naming';
import { buildTestPlan, testFirstAngleIndex, type TestPlan } from './plan';
import { buildZip, type ZipEntry } from './zip';
import { getUserProduct, guessProductForAd, listUserProducts } from './products';
import * as store from './store';
import { ANGLES_PER_PACK, CREDITS_PER_VARIANT, FORMAT_INFO, PACK_FORMATS, type PackAngle, type PackFormat } from './types';

export const ZIP_BUCKET = 'test-packs';
export const MAX_PACKS_PER_DAY = 10;

export class TestPackError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

async function winnerContext(userId: string, adId: string): Promise<{ ctx: WinnerContext; currency: string | null; avgCpa: number | null } | null> {
  const d = await buildDashboard(userId, 30);
  const ad = d.ads.find((a) => a.adId === adId);
  if (!ad) return null;
  let image: WinnerContext['image'] = null;
  if (ad.thumbnailUrl) {
    try {
      const res = await fetch(ad.thumbnailUrl);
      const type = (res.headers.get('content-type') ?? '').split(';')[0];
      if (res.ok && /^image\/(jpeg|png|webp|gif)$/.test(type)) {
        image = { mediaType: type as 'image/jpeg', data: Buffer.from(await res.arrayBuffer()).toString('base64') };
      }
    } catch { /* image is optional */ }
  }
  return {
    ctx: {
      adId: ad.adId, name: ad.name, headline: ad.headline, primaryText: ad.primaryText, status: ad.score.status, image,
      metrics: { spend: ad.spend, purchases: ad.purchases, revenue: ad.revenue, roas: ad.roas, cost_per_purchase: ad.cpa, ctr_pct: ad.ctr, cost_per_purchase_vs_account_pct: ad.score.cpaVsAvgPct, roas_vs_account_pct: ad.score.roasVsAvgPct },
    },
    currency: d.currency,
    avgCpa: d.averages.cpa,
  };
}

async function insightAngles(userId: string): Promise<unknown[] | null> {
  const conn = await MetaConnectionDAO.getByUser(userId);
  if (!conn) return null;
  const latest = await latestInsight(conn.id, 'succeeded');
  return (latest?.output as Insights | null)?.angles_to_test ?? null;
}

/** Product options for the "which product?" step, with a guess when coming from an ad. */
export async function productOptions(userId: string, fromAdId?: string | null) {
  const products = await listUserProducts(userId);
  let suggested: string | null = null;
  if (fromAdId) {
    const d = await buildDashboard(userId, 30);
    const ad = d.ads.find((a) => a.adId === fromAdId);
    if (ad) suggested = guessProductForAd(products, [ad.name, ad.headline, ad.primaryText].filter(Boolean).join(' '))?.id ?? null;
  }
  return {
    products: products.map((p) => ({ id: p.id, name: p.product.product_name, image: p.product.product_images?.find((u) => /^https?:/.test(u)) ?? null, price: p.product.price })),
    suggested,
  };
}

/** Create a draft pack with proposed angles for a product (shared by the UI flow and the Monday brief). */
export async function createPackFor(params: {
  userId: string;
  product: Product;
  winnerAdId?: string | null;
  source: 'product' | 'winner' | 'brief';
  angleCount?: number;
  formats?: PackFormat[];
  deps?: Parameters<typeof proposeAngles>[0]['deps'];
}) {
  const { product } = params;
  if (!product.product_images?.some((u) => /^https?:\/\//.test(u))) throw new TestPackError('This product has no photo to build the ads around.', 400);
  const winner = params.winnerAdId ? await winnerContext(params.userId, params.winnerAdId) : null;
  if (params.winnerAdId && !winner && params.source === 'winner') throw new TestPackError('That ad has no results in the last 30 days.', 404);
  const angleCount = params.angleCount ?? ANGLES_PER_PACK;
  const formats = params.formats ?? PACK_FORMATS;
  let angles: PackAngle[];
  try {
    angles = await proposeAngles({
      userId: params.userId, product, winner: winner?.ctx ?? null, insightAngles: await insightAngles(params.userId),
      count: angleCount, avoid: [], deps: params.deps,
    });
  } catch (err) {
    if (err instanceof NoAngleSourcesError) throw new TestPackError(err.message, 422, 'NO_SOURCES');
    throw err;
  }
  const conn = await MetaConnectionDAO.getByUser(params.userId);
  return store.createPack({
    userId: params.userId,
    connectionId: conn?.id ?? null,
    source: params.source,
    sourceAdMetaId: winner?.ctx.adId ?? null,
    sourceAdSnapshot: winner ? { ...winner.ctx, image: null } : null,
    product,
    productSlug: slugPart(product.product_name, 24),
    angles,
    formats,
    status: 'draft',
    creditsEstimated: angleCount * formats.length * CREDITS_PER_VARIANT,
  });
}

export async function createPack(params: { userId: string; productRef: string; fromAdId?: string | null; deps?: Parameters<typeof proposeAngles>[0]['deps'] }) {
  if ((await store.packsCreatedToday(params.userId)) >= MAX_PACKS_PER_DAY) {
    throw new TestPackError('You’ve started several test packs today. Please finish one before starting another.', 429);
  }
  const product = await getUserProduct(params.userId, params.productRef);
  if (!product) throw new TestPackError('Choose a product first.', 400);
  return createPackFor({ userId: params.userId, product, winnerAdId: params.fromAdId ?? null, source: params.fromAdId ? 'winner' : 'product', deps: params.deps });
}

export async function swapAngle(params: { userId: string; packId: string; index: number; deps?: Parameters<typeof proposeAngles>[0]['deps'] }) {
  const pack = await store.getPack(params.userId, params.packId);
  if (!pack) throw new TestPackError('Test pack not found', 404);
  if (pack.status !== 'draft') throw new TestPackError('This pack has already been generated.', 409);
  const angles = pack.angles as PackAngle[];
  if (params.index < 0 || params.index >= angles.length) throw new TestPackError('Unknown angle', 400);
  const winner = pack.sourceAdMetaId ? await winnerContext(params.userId, pack.sourceAdMetaId) : null;
  const [fresh] = await proposeAngles({
    userId: params.userId, product: pack.product as Product, winner: winner?.ctx ?? null, insightAngles: await insightAngles(params.userId),
    count: 1, avoid: angles.map((a) => a.name), deps: params.deps,
  });
  const next = angles.map((a, i) => (i === params.index ? fresh : a));
  await store.updatePack(pack.id, { angles: next });
  return next;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** User edits: only text fields; source and structure stay as proposed. */
export async function updateAngles(params: { userId: string; packId: string; angles: unknown }) {
  const pack = await store.getPack(params.userId, params.packId);
  if (!pack) throw new TestPackError('Test pack not found', 404);
  if (pack.status !== 'draft') throw new TestPackError('This pack has already been generated.', 409);
  const current = pack.angles as PackAngle[];
  if (!Array.isArray(params.angles) || params.angles.length !== current.length) throw new TestPackError('Expected one entry per angle', 400);
  const next = current.map((a, i) => {
    const e = (params.angles as Record<string, any>[])[i] ?? {};
    const copy = (f: PackFormat) => ({
      primary_text: str(e.copy?.[f]?.primary_text, 500) || a.copy[f].primary_text,
      headline: str(e.copy?.[f]?.headline, 80) || a.copy[f].headline,
    });
    return {
      ...a,
      name: str(e.name, 40) || a.name,
      hook: str(e.hook, 120) || a.hook,
      message: str(e.message, 300) || a.message,
      what_it_tests: str(e.what_it_tests, 200) || a.what_it_tests,
      why_it_might_work: str(e.why_it_might_work, 300) || a.why_it_might_work,
      copy: { feed: copy('feed'), story: copy('story') },
    };
  });
  await store.updatePack(pack.id, { angles: next });
  return next;
}

export async function imageCreditBalance(userId: string): Promise<number> {
  const b = await CreditsDAO.getFullBalance(userId);
  return b?.imageCredits.total ?? 0;
}

/** Validate credits, write the 6 variant rows + test plan, and lock the pack for generation. */
export async function prepareGeneration(userId: string, packId: string): Promise<{ plan: TestPlan }> {
  const pack = await store.getPack(userId, packId);
  if (!pack) throw new TestPackError('Test pack not found', 404);
  const stuck = pack.status === 'generating' && Date.now() - Date.parse(pack.updatedAt) > 75 * 60 * 1000;
  if (!['draft', 'failed', 'partial'].includes(pack.status) && !stuck) throw new TestPackError('This pack is already generating.', 409);
  const angles = pack.angles as PackAngle[];
  const existing = await store.listVariants(pack.id);
  // A retry re-renders the whole angle pair (feed + story share one plan), so count both.
  const anglesToRedo = new Set(existing.filter((v) => v.status !== 'ready').map((v) => v.angleIndex));
  const formats = (pack.formats as PackFormat[] | null)?.length ? (pack.formats as PackFormat[]) : PACK_FORMATS;
  const toMake = pack.status === 'draft' ? angles.length * formats.length : anglesToRedo.size * formats.length;
  const balance = await imageCreditBalance(userId);
  if (balance < toMake * CREDITS_PER_VARIANT) {
    throw new TestPackError(`This pack needs ${toMake} image credits and you have ${balance}.`, 402, 'INSUFFICIENT_CREDITS');
  }

  const product = pack.product as Product;
  const names = adNamesForPack(product.product_name, angles.map((a) => a.name), formats);
  const firstIdx = testFirstAngleIndex(angles.map((a) => a.source));
  let plan = pack.testPlan as TestPlan | null;
  if (pack.status === 'draft') {
    const rows = angles.flatMap((a, ai) => formats.map((f, fi) => ({
      packId: pack.id, userId, position: ai * formats.length + fi, angleIndex: ai, format: f, adName: names[ai][fi],
      hook: a.hook, primaryText: a.copy[f].primary_text, headline: a.copy[f].headline,
      whatItTests: `${a.what_it_tests} · Format: ${FORMAT_INFO[f].tests}`,
      whyItMightWork: a.why_it_might_work, testFirst: ai === firstIdx, status: 'pending',
    })));
    await store.replaceVariants(pack.id, rows);
    let currency: string | null = 'INR';
    let avgCpa: number | null = null;
    try {
      const d = await buildDashboard(userId, 30);
      currency = d.currency ?? 'INR';
      avgCpa = d.averages.cpa;
    } catch { /* not connected: use defaults */ }
    plan = buildTestPlan({ variants: rows.length, currency, avgCpa, adNames: rows.map((r) => r.adName) });
  }
  const claimed = await store.claimForGeneration(userId, pack.id, { testPlan: plan, error: null, creditsEstimated: toMake * CREDITS_PER_VARIANT });
  if (!claimed) throw new TestPackError('This pack is already generating.', 409);
  return { plan: plan! };
}

type PairFn = typeof generateAdStudioPosterPair;

/** Background job: generate every variant that isn't ready yet, one angle at a time (feed then story). */
export async function runPackGeneration(packId: string, deps: { generatePair?: PairFn } = {}) {
  const pack = await store.getPackById(packId);
  if (!pack || pack.status !== 'generating') return { skipped: true };
  const angles = pack.angles as PackAngle[];
  const variants = await store.listVariants(pack.id);
  const generatePair = deps.generatePair ?? generateAdStudioPosterPair;
  const includeStory = ((pack.formats as string[] | null) ?? PACK_FORMATS).includes('story');
  let charged = pack.creditsCharged;

  for (let ai = 0; ai < angles.length; ai++) {
    const pair = variants.filter((v) => v.angleIndex === ai);
    if (pair.every((v) => v.status === 'ready')) continue;
    for (const v of pair) if (v.status !== 'ready') await store.updateVariant(v.id, { status: 'generating', error: null });
    const a = angles[ai];
    try {
      const out = await generatePair({
        userId: pack.userId,
        product: pack.product as Product,
        angle: { title: a.hook, angle: a.name, message: a.message, insight: a.insight, proof: a.proof, audience: a.audience, funnel: 'conversion' },
        includeStory,
      });
      charged += out.creditsCharged;
      for (const v of pair) {
        if (v.status === 'ready') continue;
        const r = out[v.format as PackFormat];
        await store.updateVariant(v.id, r.ok
          ? { status: 'ready', imageUrl: r.imageUrl, sessionId: r.sessionId, error: null }
          : { status: 'failed', sessionId: r.sessionId, error: r.error.slice(0, 300) });
      }
    } catch (err) {
      metaLog.error('test_pack_angle_failed', { packId, angle: ai, message: (err as Error).message });
      for (const v of pair) if (v.status !== 'ready') await store.updateVariant(v.id, { status: 'failed', error: (err as Error).message.slice(0, 300) });
    }
    await store.updatePack(pack.id, { creditsCharged: charged });
  }

  const final = await store.listVariants(pack.id);
  const ready = final.filter((v) => v.status === 'ready').length;
  const status = ready === final.length ? 'ready' : ready > 0 ? 'partial' : 'failed';
  await store.updatePack(pack.id, { status, creditsCharged: charged, error: status === 'failed' ? 'No posters could be made. No credits were charged for failed posters.' : null });
  if (ready > 0) {
    try {
      await buildPackZip(pack.id);
    } catch (err) {
      metaLog.error('test_pack_zip_failed', { packId, message: (err as Error).message });
    }
  }
  metaLog.info('test_pack_generated', { packId, status, ready, charged });
  return { status, ready, charged };
}

function variantText(v: store.TestPackVariantRow, angle: PackAngle | undefined): string {
  return [
    `Ad name: ${v.adName}`,
    `Format: ${FORMAT_INFO[v.format as PackFormat].label}`,
    v.testFirst ? 'TEST FIRST' : '',
    '',
    `Headline:\n${v.headline ?? ''}`,
    '',
    `Primary text:\n${v.primaryText ?? ''}`,
    '',
    `Angle: ${angle?.name ?? ''}`,
    `What it tests: ${v.whatItTests ?? ''}`,
    `Why it might work: ${v.whyItMightWork ?? ''}`,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

/** Build the ZIP (posters named SKX-…, one .txt of copy per poster, the test plan) into private storage. */
export async function buildPackZip(packId: string, deps: { fetchImpl?: typeof fetch } = {}): Promise<string> {
  const pack = await store.getPackById(packId);
  if (!pack) throw new Error('pack not found');
  const variants = (await store.listVariants(pack.id)).filter((v) => v.status === 'ready' && v.imageUrl);
  const angles = pack.angles as PackAngle[];
  const doFetch = deps.fetchImpl ?? fetch;
  const entries: ZipEntry[] = [];
  for (const v of variants) {
    const res = await doFetch(v.imageUrl!);
    if (!res.ok) throw new Error(`image download failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const md5 = createHash('md5').update(buf).digest('hex');
    if (v.imageMd5 !== md5) await store.updateVariant(v.id, { imageMd5: md5 });
    entries.push({ name: `${v.adName}.${extensionFor(res.headers.get('content-type'))}`, data: buf });
    entries.push({ name: `${v.adName}.txt`, data: Buffer.from(variantText(v, angles[v.angleIndex]) + '\n', 'utf8') });
  }
  const plan = pack.testPlan as TestPlan | null;
  if (plan) {
    const text = ['How to run this test', '', ...plan.steps.map((s, i) => `${i + 1}. ${s}`), ''].join('\n');
    entries.push({ name: 'How to run this test.txt', data: Buffer.from(text, 'utf8') });
  }
  const zip = buildZip(entries);
  const path = `${pack.userId}/${pack.id}/SKX-${pack.productSlug}-test-pack.zip`;
  const { supabaseAdmin } = await import('@/auth/supabase/admin');
  const { error } = await supabaseAdmin.storage.from(ZIP_BUCKET).upload(path, zip, { contentType: 'application/zip', upsert: true });
  if (error) throw new Error(`zip upload failed: ${error.message}`);
  await store.updatePack(pack.id, { zipPath: path, zipBuiltAt: new Date().toISOString() });
  return path;
}

export async function zipDownloadUrl(userId: string, packId: string): Promise<string> {
  const pack = await store.getPack(userId, packId);
  if (!pack) throw new TestPackError('Test pack not found', 404);
  if (!['ready', 'partial'].includes(pack.status)) throw new TestPackError('The ads are not ready yet.', 409);
  const path = pack.zipPath ?? (await buildPackZip(pack.id));
  const { supabaseAdmin } = await import('@/auth/supabase/admin');
  const { data, error } = await supabaseAdmin.storage.from(ZIP_BUCKET).createSignedUrl(path, 10 * 60, { download: true });
  if (error || !data?.signedUrl) throw new Error(`signed url failed: ${error?.message}`);
  return data.signedUrl;
}
