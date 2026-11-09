/**
 * Builds (and optionally sends) a user's Monday brief for the last full week:
 *  numbers → content (code) → a draft pack of 5 new feed ads to test (angles + copy,
 *  no images, no credits until the user clicks Make) → email.
 */
import { MetaConnectionDAO, ProfileDAO } from '@/database';
import { buildDashboard } from '@/lib/meta-intel/summary';
import { metaLog } from '@/lib/meta/log';
import { getUserBrand } from '@/lib/brand-kit/server';
import { createAdProject, claimNextRound, AdStudioError } from '@/lib/ad-studio/service';
import { enqueueRound } from '@/lib/ad-studio/enqueue';
import { listUserProducts, guessProductForAd } from '@/lib/test-packs/products';
import { buildBriefContent, type BriefContent } from './content';
import { briefWeekFor } from './week';
import { deliverBrief, type BriefChannel, type DeliveryResult } from './deliver';
import * as store from './store';

export const BRIEF_PACK_ANGLES = 5;

/** Start a poster project with 5 free drafts for the brief (paid only if the owner keeps them). */
export async function startBriefPosters(input: { userId: string; scanId: string; productName: string; winnerAdId: string | null }): Promise<string> {
  const project = await createAdProject({
    userId: input.userId, scanId: input.scanId, productName: input.productName, goal: 'sell_more', formats: ['feed_4x5'],
    fromAdId: input.winnerAdId, source: 'brief',
  });
  const { round, size } = await claimNextRound(input.userId, project.id, { maxSize: BRIEF_PACK_ANGLES });
  await enqueueRound({ projectId: project.id, round, size });
  return project.id;
}

type Deps = {
  startPosters?: typeof startBriefPosters;
  send?: Parameters<typeof deliverBrief>[3] extends infer D ? (D extends { send?: infer S } ? S : never) : never;
  now?: Date;
};

export type BriefRunResult =
  | { status: 'skipped'; reason: 'not_connected' | 'no_ad_account' | 'already_built' }
  | { status: 'ready'; briefId: string; delivery: DeliveryResult[] }
  | { status: 'failed'; briefId: string; error: string };

async function recipient(userId: string): Promise<{ email: string | null; brandName: string | null }> {
  const [profile, brand] = await Promise.all([ProfileDAO.get(userId).catch(() => null), getUserBrand(userId).catch(() => ({ snapshot: null }))]);
  let email = profile?.email ?? null;
  if (!email) {
    try {
      const { supabaseAdmin } = await import('@/auth/supabase/admin');
      email = (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email ?? null;
    } catch { /* no email available */ }
  }
  return { email, brandName: brand.snapshot?.name ?? null };
}

/** Product for the brief pack: the one the top winning ad is about, else the first scanned product. */
async function pickProduct(userId: string, adText: string | null) {
  const products = await listUserProducts(userId);
  if (!products.length) return null;
  return (adText ? guessProductForAd(products, adText) : null) ?? products[0];
}

export async function runWeeklyBrief(params: {
  userId: string;
  trigger: 'schedule' | 'manual';
  send: boolean;
  channels?: BriefChannel[];
  deps?: Deps;
}): Promise<BriefRunResult> {
  const conn = await MetaConnectionDAO.getByUser(params.userId);
  if (!conn || conn.status !== 'active') return { status: 'skipped', reason: 'not_connected' };
  const account = (await MetaConnectionDAO.listAssets(params.userId)).find((a) => a.kind === 'ad_account' && a.selected);
  if (!account) return { status: 'skipped', reason: 'no_ad_account' };

  const week = briefWeekFor(account.timezoneName, params.deps?.now);
  const row = await store.claimWeek({
    connectionId: conn.id, userId: params.userId, weekStart: week.start, weekEnd: week.end,
    trigger: params.trigger, rebuild: params.trigger === 'manual',
  });
  if (!row) return { status: 'skipped', reason: 'already_built' };

  try {
    const d = await buildDashboard(params.userId, 7, { until: week.end });
    const content: BriefContent = buildBriefContent(d, week);

    // Keep what this week already has when rebuilding; otherwise start 5 free poster drafts.
    if (row.posterProjectId) {
      content.pack = { id: row.posterProjectId, ads: BRIEF_PACK_ANGLES, kind: 'posters' };
    } else if (row.packId) {
      content.pack = { id: row.packId, ads: BRIEF_PACK_ANGLES, kind: 'test_pack' };
    } else if (d.dataState !== 'empty') {
      const top = d.ads.find((a) => a.adId === content.winners[0]?.adId) ?? null;
      const product = await pickProduct(params.userId, top ? [top.name, top.headline, top.primaryText].filter(Boolean).join(' ') : null);
      if (!product) {
        content.packNote = 'Scan your website in Ad Studio so SkalX can prepare new ads for you next week.';
      } else {
        try {
          const [scanId] = product.id.split(':');
          const projectId = await (params.deps?.startPosters ?? startBriefPosters)({
            userId: params.userId, scanId, productName: product.product.product_name, winnerAdId: top?.adId ?? null,
          });
          content.pack = { id: projectId, ads: BRIEF_PACK_ANGLES, kind: 'posters' };
        } catch (err) {
          content.packNote = err instanceof AdStudioError ? err.message : 'New ads couldn’t be prepared this week.';
          metaLog.warn('brief_pack_failed', { userId: params.userId, message: (err as Error).message });
        }
      }
    }

    await store.updateBrief(row.id, {
      status: 'ready', content,
      posterProjectId: content.pack?.kind === 'posters' ? content.pack.id : row.posterProjectId ?? null,
      packId: content.pack?.kind === 'test_pack' ? content.pack.id : row.packId ?? null,
    });

    const delivery: DeliveryResult[] = [];
    if (params.send) {
      const to = await recipient(params.userId);
      for (const channel of params.channels ?? ['email']) {
        if (channel === 'email' && !conn.briefEmailEnabled && params.trigger === 'schedule') {
          delivery.push({ channel, status: 'skipped', reason: 'opted_out', at: new Date().toISOString() });
          continue;
        }
        delivery.push(await deliverBrief(channel, content, to, { send: params.deps?.send }));
      }
      const record = Object.fromEntries(delivery.map((x) => [x.channel, x]));
      await store.updateBrief(row.id, { delivery: { ...(row.delivery as object), ...record } });
    }
    metaLog.info('brief_ready', { userId: params.userId, week: week.start, pack: !!content.pack, delivery: delivery.map((x) => `${x.channel}:${x.status}`) });
    return { status: 'ready', briefId: row.id, delivery };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await store.updateBrief(row.id, { status: 'failed', error: message });
    metaLog.error('brief_failed', { userId: params.userId, message });
    return { status: 'failed', briefId: row.id, error: message };
  }
}
