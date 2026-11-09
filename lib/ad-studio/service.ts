/**
 * Ad Studio poster flow (Part 1, backend):
 *   project (product + goal + formats + optional direction)
 *   → round: research 8 angles for that goal → 8 DRAFT posters (free, private, watermarked previews)
 *   → keep: charge 1 image credit per kept poster, atomically, then publish the full image
 *   → another round with feedback (capped per product per day)
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/database/client';
import { adStudioDrafts } from '@/database/schema';
import { CreditsDAO } from '@/database';
import { ContentStudioScanDAO } from '@/database/models/ContentStudioScan.dao';
import { getUserBrand } from '@/lib/brand-kit/server';
import { getBrandResearch } from '@/lib/research/store';
import { buildProductStrategy, type StrategyAngle, type StrategyProductInput } from '@/lib/research/product-strategy';
import { renderAdStudioDraft } from '@/lib/content-studio/engine-posters';
import { slugPart } from '@/lib/test-packs/naming';
import { metaLog } from '@/lib/meta/log';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import { AD_FORMATS, AD_GOALS, isAdFormat, isAdGoal, type AdFormat, type AdGoal } from './options';
import { MIN_CREDITS_TO_START, nextRoundSize, draftsLeftToday } from './limits';
import { draftWhy, toDraftAngle, type DraftAngle } from './why';
import { storeDraftImage, previewPathFor, signedPreviewUrls, publishKeptDraft } from './storage';
import * as store from './store';
import { skxAdName, writeCopy, fallbackCopy } from './kept';

export class AdStudioError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

const RENDER_CONCURRENCY = 4;

/** "Make more like this": what the winning ad said and how it did, for the research step. */
async function winnerBrief(userId: string, adId: string): Promise<string | null> {
  try {
    const { buildDashboard } = await import('@/lib/meta-intel/summary');
    const ad = (await buildDashboard(userId, 30)).ads.find((a) => a.adId === adId);
    if (!ad) return null;
    const results = [ad.roas !== null && `ROAS ${ad.roas}`, ad.cpa !== null && `cost per purchase ${ad.cpa}`, ad.ctr !== null && `click rate ${ad.ctr}%`].filter(Boolean).join(', ');
    return `Build on this winning ad (keep what made it work, try new ways to say it): "${ad.name ?? ''}"${ad.headline ? `, headline "${ad.headline}"` : ''}${ad.primaryText ? `, text "${ad.primaryText.slice(0, 200)}"` : ''}${results ? ` — last 30 days: ${results}` : ''}.`;
  } catch {
    return null;
  }
}

async function imageCredits(userId: string) {
  return (await CreditsDAO.getFullBalance(userId))?.imageCredits.total ?? 0;
}

async function findProduct(userId: string, scanId: string, productName: string) {
  const scan = await ContentStudioScanDAO.getByIdAndUser(scanId, userId);
  const products = Array.isArray(scan?.products) ? (scan!.products as Product[]) : [];
  const product = products.find((p) => p.product_name?.trim().toLowerCase() === productName.trim().toLowerCase()) ?? null;
  return { product, website: scan?.url ?? null };
}

export async function createAdProject(params: {
  userId: string;
  scanId: string;
  productName: string;
  goal: unknown;
  offer?: unknown;
  formats: unknown;
  direction?: unknown;
  fromAdId?: string | null;
  source?: 'ad_studio' | 'winner' | 'brief';
}) {
  if (!isAdGoal(params.goal)) throw new AdStudioError('Choose a goal.');
  const goal = params.goal as AdGoal;
  const formats = (Array.isArray(params.formats) ? params.formats : []).filter(isAdFormat) as AdFormat[];
  if (!formats.length) throw new AdStudioError('Choose where the ads will run.');
  const offer = typeof params.offer === 'string' ? params.offer.trim().slice(0, 300) : '';
  if (AD_GOALS[goal].needsOffer && !offer) throw new AdStudioError('Tell us the offer (for example “20% off this week” or “Buy 2, get 1 free”).');
  const direction = typeof params.direction === 'string' ? params.direction.trim().slice(0, 1000) : '';

  const { product, website } = await findProduct(params.userId, params.scanId, params.productName);
  if (!product) throw new AdStudioError('We couldn’t find that product. Scan your website again in Ad Studio.', 404);
  if (!product.product_images?.some((u) => /^https?:\/\//.test(u))) throw new AdStudioError('This product has no photo to build the posters around.');

  if (AD_GOALS[goal].needsReviews) {
    const research = await getBrandResearch(params.userId, website).catch(() => null);
    const hasReviews = !!research && ((research.reputation?.ratings?.length ?? 0) > 0 || (research.customer_voice?.their_words?.length ?? 0) > 0);
    if (!hasReviews) throw new AdStudioError('We haven’t found real customer reviews yet, so we can’t make review ads without inventing them. Pick another goal, or run Brand Research first.', 422, 'NO_REVIEWS');
  }
  if ((await imageCredits(params.userId)) < MIN_CREDITS_TO_START) {
    throw new AdStudioError('You need at least 1 image credit to start. You only pay for the posters you keep.', 402, 'INSUFFICIENT_CREDITS');
  }

  return store.createProject({
    userId: params.userId,
    scanId: params.scanId,
    product,
    productSlug: slugPart(product.product_name, 24),
    goal,
    offerDetails: offer || null,
    formats,
    direction: direction || null,
    source: params.source ?? (params.fromAdId ? 'winner' : 'ad_studio'),
    sourceAdMetaId: params.fromAdId ?? null,
    status: 'ready', // nothing running yet; startRound moves it on
  });
}

/** Check the daily cap, lock the project, and return the size of the round to draw. */
export async function claimNextRound(userId: string, projectId: string, opts: { maxSize?: number } = {}): Promise<{ round: number; size: number }> {
  const project = await store.getProject(userId, projectId);
  if (!project) throw new AdStudioError('Not found', 404);
  const size = Math.min(opts.maxSize ?? Infinity, nextRoundSize(await store.draftsLast24h(userId, project.productSlug)));
  if (size === 0) throw new AdStudioError('You’ve made the most free drafts for this product today. Keep the ones you like, or come back tomorrow for more.', 429, 'DAILY_LIMIT');
  if ((await imageCredits(userId)) < MIN_CREDITS_TO_START) throw new AdStudioError('You need at least 1 image credit to make more drafts.', 402, 'INSUFFICIENT_CREDITS');
  const claimed = await store.claimRound(userId, projectId);
  if (!claimed) throw new AdStudioError('Your posters are still being made.', 409, 'BUSY');
  return { round: claimed.rounds, size };
}

type ResearchFn = (input: Parameters<typeof buildProductStrategy>[0]) => Promise<{ angles: StrategyAngle[]; brief: unknown }>;
type RenderFn = typeof renderAdStudioDraft;

const defaultResearch: ResearchFn = async (input) => {
  const { strategy } = await buildProductStrategy(input);
  return { angles: strategy.angles, brief: strategy.campaign_strategy.brief };
};

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/** Background job: research this round's angles, then draw one draft per angle (no charge). */
export async function runRound(params: {
  projectId: string;
  round: number;
  size: number;
  feedback?: string | null;
  deps?: { research?: ResearchFn; render?: RenderFn };
}) {
  const project = await store.getProjectById(params.projectId);
  if (!project) return { skipped: true };
  const product = project.product as Product;
  const goal = AD_GOALS[project.goal as AdGoal];
  const primary = AD_FORMATS[(project.formats[0] as AdFormat) ?? 'feed_4x5'];
  const previous = await store.listDrafts(project.id);

  try {
    const [{ snapshot }, scan] = await Promise.all([
      getUserBrand(project.userId).catch(() => ({ snapshot: null })),
      project.scanId ? ContentStudioScanDAO.getByIdAndUser(project.scanId, project.userId).catch(() => null) : Promise.resolve(null),
    ]);
    const brandResearch = await getBrandResearch(project.userId, scan?.url ?? null).catch(() => null);
    const winner = project.sourceAdMetaId ? await winnerBrief(project.userId, project.sourceAdMetaId) : null;
    const direction = [project.direction, params.feedback].filter(Boolean).join(' | ');
    const research = await (params.deps?.research ?? defaultResearch)({
      product: product as StrategyProductInput,
      brand: { name: snapshot?.name, tone: snapshot?.brand_tone?.join(', ') || snapshot?.tone, industry: snapshot?.industry, targetAudience: snapshot?.audience, website: scan?.url ?? undefined },
      brandResearch,
      angleCount: params.size,
      focus: {
        goal: goal.focus,
        offer: project.offerDetails,
        direction: [direction, winner].filter(Boolean).join(' | ') || null,
        avoidAngles: [...new Set(previous.map((d) => (d.angle as DraftAngle).angle).filter(Boolean))],
      },
    });
    const angles = research.angles.slice(0, params.size).map((a) => toDraftAngle(a as unknown as Record<string, unknown>));
    if (!angles.length) throw new Error('Research returned no angles');

    await store.updateProject(project.id, { status: 'drawing', research: research.brief as object });
    const drafts = await store.insertDrafts(angles.map((angle, i) => ({
      projectId: project.id, userId: project.userId, round: params.round, position: i,
      format: project.formats[0] ?? 'feed_4x5', angle, status: 'pending',
    })));

    const extra = [
      project.offerDetails && `The offer to feature, exactly as given: ${project.offerDetails}.`,
      direction && `The owner asked for: ${direction}`,
    ].filter(Boolean).join('\n');
    await mapLimit(drafts, RENDER_CONCURRENCY, async (d) => {
      const a = d.angle as DraftAngle;
      await store.updateDraft(d.id, { status: 'drawing' });
      const out = await (params.deps?.render ?? renderAdStudioDraft)({
        userId: project.userId,
        product,
        angle: { title: a.title, angle: a.angle, message: a.message, insight: a.insight, proof: a.proof, audience: a.audience, funnel: a.funnel },
        adGoal: goal.engineGoal,
        aspectRatio: primary.aspect,
        extraInstruction: extra || null,
        storeImage: storeDraftImage,
      });
      await store.updateDraft(d.id, out.ok
        ? { status: 'ready', sessionId: out.sessionId, storagePath: out.storagePath, previewPath: previewPathFor(out.storagePath), error: null }
        : { status: 'failed', sessionId: out.sessionId, error: out.error.slice(0, 300) });
    });

    const fresh = (await store.listDrafts(project.id)).filter((d) => d.round === params.round);
    const ready = fresh.filter((d) => d.status === 'ready').length;
    await store.updateProject(project.id, { status: ready ? 'ready' : 'failed', error: ready ? null : 'None of the posters came out right. Try again — nothing was charged.' });
    metaLog.info('ad_studio_round_done', { projectId: project.id, round: params.round, ready, of: fresh.length });
    return { ready, total: fresh.length };
  } catch (err) {
    await store.updateProject(project.id, { status: 'failed', error: 'We couldn’t finish the research for this round. Try again — nothing was charged.' });
    metaLog.error('ad_studio_round_failed', { projectId: project.id, message: (err as Error).message });
    return { ready: 0, total: 0, error: (err as Error).message };
  }
}

/**
 * Keep drafts: charge 1 image credit per newly kept draft, in ONE transaction with marking them
 * kept (so a double click or a race can't charge twice), then publish the full images.
 */
export async function keepDrafts(userId: string, projectId: string, draftIds: string[], deps: { copyClient?: Parameters<typeof writeCopy>[0]['deps'] } = {}) {
  const ids = [...new Set(draftIds.filter((x) => /^[0-9a-f-]{36}$/.test(x)))];
  if (!ids.length) throw new AdStudioError('Choose at least one poster to keep.');
  const project = await store.getProject(userId, projectId);
  if (!project) throw new AdStudioError('Not found', 404);

  const charged = await db.transaction(async (tx) => {
    const rows = await tx.select({ id: adStudioDrafts.id }).from(adStudioDrafts)
      .where(and(eq(adStudioDrafts.projectId, projectId), eq(adStudioDrafts.userId, userId), inArray(adStudioDrafts.id, ids), eq(adStudioDrafts.status, 'ready'), eq(adStudioDrafts.kept, false)))
      .for('update');
    if (!rows.length) return 0;
    const pay = await CreditsDAO.deductImageCreditsInTransaction(tx, { userId, amount: rows.length, source: 'ad_studio_keep', metadata: { projectId, draftIds: rows.map((r) => r.id) } });
    if (!pay.success) throw new AdStudioError(`Keeping ${rows.length} poster${rows.length > 1 ? 's' : ''} needs ${rows.length} image credit${rows.length > 1 ? 's' : ''}. Keep fewer or get more credits.`, 402, 'INSUFFICIENT_CREDITS');
    await tx.update(adStudioDrafts).set({ kept: true, keptAt: new Date().toISOString(), creditsCharged: 1, updatedAt: new Date().toISOString() })
      .where(inArray(adStudioDrafts.id, rows.map((r) => r.id)));
    return rows.length;
  });

  await publishPending(userId, projectId, deps);
  metaLog.info('ad_studio_kept', { userId, projectId, charged });
  return { charged };
}

/**
 * Finish kept drafts that aren't ready to run yet (also retried on view/download):
 * publish the full image, give it an SKX- name, and write its copy.
 */
export async function publishPending(userId: string, projectId: string, deps: { copyClient?: Parameters<typeof writeCopy>[0]['deps'] } = {}) {
  const all = await store.listDrafts(projectId);
  const pending = all.filter((d) => d.userId === userId && d.kept && (!d.finalUrl || !d.adName) && d.storagePath);
  if (!pending.length) return;
  const project = await store.getProjectById(projectId);
  if (!project) return;
  const taken = new Set(all.map((d) => d.adName?.toLowerCase()).filter((x): x is string => !!x));
  const product = project.product as Product;
  const needCopy = pending.filter((d) => !d.adName);
  const brand = needCopy.length ? await getUserBrand(userId).catch(() => ({ snapshot: null })) : { snapshot: null };
  const copy = await writeCopy({
    product, offer: project.offerDetails, brandName: brand.snapshot?.name ?? null,
    items: needCopy.map((d) => ({ id: d.id, angle: d.angle as DraftAngle, format: d.format })), deps: deps.copyClient,
  });
  for (const d of pending) {
    try {
      const patch: Partial<store.DraftRow> = {};
      if (!d.finalUrl) {
        const { url, path, md5 } = await publishKeptDraft(userId, d.storagePath!);
        Object.assign(patch, { finalUrl: url, finalPath: path, imageMd5: md5 });
      }
      if (!d.adName) {
        const name = skxAdName(product.product_name, (d.angle as DraftAngle).angle, d.format, taken);
        taken.add(name.toLowerCase());
        const c = copy.get(d.id) ?? fallbackCopy(d.angle as DraftAngle);
        Object.assign(patch, { adName: name, headline: c.headline, primaryText: c.primaryText });
      }
      await store.updateDraft(d.id, patch);
    } catch (err) {
      metaLog.error('ad_studio_publish_failed', { draftId: d.id, message: (err as Error).message });
    }
  }
}

export async function projectView(userId: string, projectId: string) {
  const project = await store.getProject(userId, projectId);
  if (!project) throw new AdStudioError('Not found', 404);
  if ((await store.listDrafts(project.id)).some((d) => d.kept && (!d.finalUrl || !d.adName))) await publishPending(userId, project.id);
  const drafts = await store.listDrafts(project.id);
  const keptNames = drafts.filter((d) => d.kept && d.adName).map((d) => d.adName!);
  const [{ posterResults }, { testPlanFor }] = await Promise.all([import('./results'), import('./download')]);
  const [results, testPlan] = keptNames.length
    ? await Promise.all([posterResults(userId, project.id).catch(() => null), testPlanFor(userId, keptNames).catch(() => null)])
    : [null, null];
  const previews = await signedPreviewUrls(drafts.filter((d) => d.status === 'ready' && d.previewPath && !d.kept).map((d) => d.previewPath!));
  const [balance, used, brand] = await Promise.all([imageCredits(userId), store.draftsLast24h(userId, project.productSlug), getUserBrand(userId).catch(() => ({ snapshot: null }))]);
  return {
    project: {
      id: project.id, status: project.status, goal: project.goal, goalLabel: AD_GOALS[project.goal as AdGoal]?.label ?? project.goal,
      formats: project.formats, offer: project.offerDetails, direction: project.direction, rounds: project.rounds, error: project.error,
      product: { name: (project.product as Product).product_name, image: (project.product as Product).product_images?.[0] ?? null },
      brandName: brand.snapshot?.name ?? null,
      working: drafts.some((d) => d.status === 'drawing' || d.status === 'pending'),
    },
    drafts: drafts.map((d) => ({
      id: d.id, round: d.round, position: d.position, format: d.format, kind: d.kind, parentId: d.parentDraftId, status: d.status, error: d.error,
      message: (d.angle as DraftAngle).message || (d.angle as DraftAngle).title || '',
      // The full image is only ever exposed once kept (and paid for).
      imageUrl: d.kept ? d.finalUrl : d.previewPath ? previews.get(d.previewPath) ?? null : null,
      kept: d.kept,
      adName: d.adName, headline: d.headline, primaryText: d.primaryText, matchedAdId: d.matchedAdMetaId,
      angleName: (d.angle as DraftAngle).angle,
      why: draftWhy(d.angle as DraftAngle),
    })),
    credits: balance,
    results,
    testPlan,
    draftsLeftToday: draftsLeftToday(used),
    nextRoundSize: nextRoundSize(used),
  };
}
