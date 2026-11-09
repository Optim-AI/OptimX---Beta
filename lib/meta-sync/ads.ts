/**
 * Ads side of a sync for one ad account: account info, structure (campaigns, ad sets, ads),
 * daily ad-level insights, back-fill of objects only seen in insights, creatives.
 */
import { graphCall, graphGetAll } from '@/lib/meta/graph';
import { normalizeInsight, type RawInsightRow } from './metrics';
import { chunkRange, daysBetween } from './dates';
import * as store from './store';
import { bump, recordError, type SyncContext } from './context';
import { metaAds, metaAdsets, metaCampaigns, metaCreatives } from '@/database/schema';

export const INSIGHT_FIELDS = [
  'ad_id', 'adset_id', 'campaign_id', 'account_currency', 'date_start', 'date_stop',
  'spend', 'impressions', 'reach', 'frequency', 'clicks', 'inline_link_clicks', 'ctr', 'cpc', 'cpm',
  'actions', 'action_values', 'purchase_roas',
].join(',');

const CAMPAIGN_FIELDS = 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time';
const ADSET_FIELDS = 'id,name,campaign_id,status,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,created_time,updated_time';
const AD_FIELDS = 'id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time,creative{id}';
const CREATIVE_FIELDS = 'id,name,title,body,image_hash,image_url,thumbnail_url,object_type,call_to_action_type,video_id,object_story_spec,asset_feed_spec';

/** Ranges longer than this use an async report job. */
const ASYNC_THRESHOLD_DAYS = 14;
const ASYNC_POLL_MS = 5_000;
const ASYNC_MAX_POLLS = 120; // ~10 minutes

const act = (id: string) => `act_${id}`;

export type AccountInfo = { currency: string | null; timezoneName: string | null };

export async function refreshAccount(ctx: SyncContext, adAccountId: string): Promise<AccountInfo> {
  const a = await graphCall<{ name?: string; currency?: string; timezone_name?: string; account_status?: number }>(
    act(adAccountId), ctx.token, { fields: 'name,currency,timezone_name,account_status' }, ctx.graph,
  );
  await store.updateAccountInfo(ctx.connectionId, adAccountId, {
    name: a.name, currency: a.currency, timezoneName: a.timezone_name, accountStatus: a.account_status,
  });
  return { currency: a.currency ?? null, timezoneName: a.timezone_name ?? null };
}

export async function syncStructure(ctx: SyncContext, adAccountId: string) {
  const campaigns = await graphGetAll<Record<string, any>>(`${act(adAccountId)}/campaigns`, ctx.token, { fields: CAMPAIGN_FIELDS }, ctx.graph);
  bump(ctx, 'campaigns', await store.upsertCampaigns(ctx.connectionId, adAccountId, campaigns));
  const adsets = await graphGetAll<Record<string, any>>(`${act(adAccountId)}/adsets`, ctx.token, { fields: ADSET_FIELDS }, ctx.graph);
  bump(ctx, 'adsets', await store.upsertAdsets(ctx.connectionId, adAccountId, adsets));
  const ads = await graphGetAll<Record<string, any>>(`${act(adAccountId)}/ads`, ctx.token, { fields: AD_FIELDS }, ctx.graph);
  bump(ctx, 'ads', await store.upsertAds(ctx.connectionId, adAccountId, ads));
}

/** Fetch objects by id (?ids=a,b,c), 50 at a time. */
async function fetchByIds(ctx: SyncContext, ids: string[], fields: string, extra: Record<string, string> = {}) {
  const out: Record<string, any>[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    try {
      const res = await graphCall<Record<string, any>>('', ctx.token, { ids: part.join(','), fields, ...extra }, ctx.graph);
      out.push(...Object.values(res ?? {}).filter((v) => v && typeof v === 'object' && v.id));
    } catch (err) {
      recordError(ctx, 'fetch_by_ids', err);
    }
  }
  return out;
}

async function runAsyncReport(ctx: SyncContext, adAccountId: string, since: string, until: string): Promise<RawInsightRow[]> {
  const params = {
    level: 'ad', time_increment: 1, fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
  };
  const started = await graphCall<{ report_run_id?: string }>(`${act(adAccountId)}/insights`, ctx.token, params, { ...ctx.graph, method: 'POST' });
  const reportId = started.report_run_id;
  if (!reportId) throw new Error('Meta did not return a report_run_id');
  const sleep = ctx.graph.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let i = 0; i < ASYNC_MAX_POLLS; i++) {
    const st = await graphCall<{ async_status?: string; async_percent_completion?: number }>(reportId, ctx.token, { fields: 'async_status,async_percent_completion' }, ctx.graph);
    if (st.async_status === 'Job Completed') {
      return graphGetAll<RawInsightRow>(`${reportId}/insights`, ctx.token, { limit: 500 }, { ...ctx.graph, maxPages: 400 });
    }
    if (st.async_status === 'Job Failed' || st.async_status === 'Job Skipped') {
      throw new Error(`Async insights report ${st.async_status}`);
    }
    await sleep(ASYNC_POLL_MS);
  }
  throw new Error('Async insights report timed out');
}

async function fetchInsightsDirect(ctx: SyncContext, adAccountId: string, since: string, until: string): Promise<RawInsightRow[]> {
  const rows: RawInsightRow[] = [];
  for (const w of chunkRange(since, until, 7)) {
    rows.push(...await graphGetAll<RawInsightRow>(`${act(adAccountId)}/insights`, ctx.token, {
      level: 'ad', time_increment: 1, fields: INSIGHT_FIELDS, time_range: JSON.stringify(w), limit: 500,
    }, { ...ctx.graph, maxPages: 200 }));
  }
  return rows;
}

export async function syncInsights(ctx: SyncContext, adAccountId: string, range: { since: string; until: string }, account: AccountInfo) {
  let raw: RawInsightRow[];
  if (daysBetween(range.since, range.until) + 1 > ASYNC_THRESHOLD_DAYS) {
    try {
      raw = await runAsyncReport(ctx, adAccountId, range.since, range.until);
      bump(ctx, 'async_reports');
    } catch (err) {
      // Fall back to small synchronous windows.
      recordError(ctx, 'insights_async_fallback', err, adAccountId);
      raw = await fetchInsightsDirect(ctx, adAccountId, range.since, range.until);
    }
  } else {
    raw = await fetchInsightsDirect(ctx, adAccountId, range.since, range.until);
  }
  const rows = raw.map((r) => normalizeInsight(r, account.currency)).filter((r): r is NonNullable<typeof r> => !!r);
  const { written, changed } = await store.upsertInsights(ctx.connectionId, adAccountId, rows);
  bump(ctx, 'insight_rows', written);
  if (changed > 0) ctx.dataChanged = true;
  bump(ctx, 'insight_rows_changed', changed);
  return rows;
}

/** Ads / ad sets / campaigns that appear in insights but not in the default edges (archived, deleted). */
export async function backfillFromInsights(ctx: SyncContext, adAccountId: string, rows: { adMetaId: string; adsetMetaId: string | null; campaignMetaId: string | null }[]) {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const adIds = uniq(rows.map((r) => r.adMetaId));
  const haveAds = await store.existingMetaIds(metaAds, ctx.connectionId, adIds);
  const missingAds = adIds.filter((id) => !haveAds.has(id));
  if (missingAds.length) bump(ctx, 'ads', await store.upsertAds(ctx.connectionId, adAccountId, await fetchByIds(ctx, missingAds, AD_FIELDS)));

  const adsetIds = uniq(rows.map((r) => r.adsetMetaId));
  const haveAdsets = await store.existingMetaIds(metaAdsets, ctx.connectionId, adsetIds);
  const missingAdsets = adsetIds.filter((id) => !haveAdsets.has(id));
  if (missingAdsets.length) bump(ctx, 'adsets', await store.upsertAdsets(ctx.connectionId, adAccountId, await fetchByIds(ctx, missingAdsets, ADSET_FIELDS)));

  const campIds = uniq(rows.map((r) => r.campaignMetaId));
  const haveCamps = await store.existingMetaIds(metaCampaigns, ctx.connectionId, campIds);
  const missingCamps = campIds.filter((id) => !haveCamps.has(id));
  if (missingCamps.length) bump(ctx, 'campaigns', await store.upsertCampaigns(ctx.connectionId, adAccountId, await fetchByIds(ctx, missingCamps, CAMPAIGN_FIELDS)));
}

/** Primary text / headline live in different places for link, video and dynamic creatives. */
export function extractCopy(c: Record<string, any>): { title: string | null; body: string | null; imageUrl: string | null } {
  const story = c.object_story_spec ?? {};
  const link = story.link_data ?? {};
  const video = story.video_data ?? {};
  const feed = c.asset_feed_spec ?? {};
  return {
    title: c.title ?? link.name ?? video.title ?? feed.titles?.[0]?.text ?? null,
    body: c.body ?? link.message ?? video.message ?? feed.bodies?.[0]?.text ?? null,
    imageUrl: c.image_url ?? link.picture ?? video.image_url ?? c.thumbnail_url ?? null,
  };
}

export async function syncCreatives(ctx: SyncContext, adAccountId: string, creativeIds: string[]) {
  const have = await store.existingMetaIds(metaCreatives, ctx.connectionId, creativeIds);
  // Creatives are immutable on Meta once created, so only new ones are fetched.
  const ids = creativeIds.filter((id) => !have.has(id));
  if (!ids.length) return;
  const nodes = await fetchByIds(ctx, ids, CREATIVE_FIELDS, { thumbnail_width: '600', thumbnail_height: '600' });

  // Prefer the original upload (adimages by hash) over the creative's image_url / thumbnail.
  const hashes = [...new Set(nodes.map((n) => n.image_hash).filter(Boolean))] as string[];
  const fullByHash = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += 50) {
    try {
      const imgs = await graphGetAll<{ hash?: string; url?: string }>(`${act(adAccountId)}/adimages`, ctx.token, {
        hashes: JSON.stringify(hashes.slice(i, i + 50)), fields: 'hash,url',
      }, ctx.graph);
      imgs.forEach((im) => im.hash && im.url && fullByHash.set(im.hash, im.url));
    } catch (err) {
      recordError(ctx, 'adimages', err, adAccountId);
    }
  }

  const rows: store.CreativeRow[] = nodes.map((n) => {
    const copy = extractCopy(n);
    return {
      metaId: String(n.id), name: n.name ?? null, objectType: n.object_type ?? null, title: copy.title, body: copy.body,
      callToActionType: n.call_to_action_type ?? n.object_story_spec?.link_data?.call_to_action?.type ?? null,
      imageHash: n.image_hash ?? null, videoId: n.video_id ?? n.object_story_spec?.video_data?.video_id ?? null,
      sourceImageUrl: (n.image_hash && fullByHash.get(n.image_hash)) || copy.imageUrl, raw: n,
    };
  });
  bump(ctx, 'creatives', await store.upsertCreatives(ctx.connectionId, adAccountId, rows));
}
