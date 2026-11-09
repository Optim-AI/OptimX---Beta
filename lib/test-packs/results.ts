/**
 * Results loop: finds the synced Meta ad for each variant (by SKX- name, or by image
 * fingerprint) and shows its real results since the pack was created.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { deriveKpis, emptySums, type Kpis, type Sums } from '@/lib/meta-intel/kpis';
import { minSpendThreshold } from '@/lib/meta-intel/scoring';
import * as store from './store';
import type { TestPackRow, TestPackVariantRow } from './store';

export type VariantResult = Kpis & { impressions: number; clicks: number; adStatus: string | null; enoughData: boolean };

export type PackResults = {
  connected: boolean;
  currency: string | null;
  minSpend: number;
  byVariant: Record<string, VariantResult | null>;
  leaderVariantId: string | null;
};

async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  return ((await db.execute(q)) as unknown as { rows: T[] }).rows;
}

/**
 * Find matches for variants not yet matched and remember them. Only ads created after the
 * pack count (an older ad with a similar name can't be one of these variants).
 */
async function matchVariants(connectionId: string, packCreatedAt: string, variants: TestPackVariantRow[]) {
  for (const v of variants) {
    if (v.matchedAdMetaId || v.status !== 'ready') continue;
    const byName = await rows<{ meta_id: string }>(sql`
      select meta_id from meta_ads
      where connection_id = ${connectionId} and lower(name) like ${v.adName.toLowerCase() + '%'}
        and coalesce(created_time, synced_at) >= ${packCreatedAt}::timestamptz
      order by created_time desc nulls last limit 1`);
    let match: { id: string; by: 'name' | 'image' } | null = byName[0] ? { id: byName[0].meta_id, by: 'name' } : null;
    if (!match && v.imageMd5) {
      const byImage = await rows<{ meta_id: string }>(sql`
        select a.meta_id from meta_ads a
        join meta_creatives c on c.connection_id = a.connection_id and c.meta_id = a.creative_meta_id
        where a.connection_id = ${connectionId} and (c.stored_md5 = ${v.imageMd5} or lower(c.image_hash) = ${v.imageMd5})
          and coalesce(a.created_time, a.synced_at) >= ${packCreatedAt}::timestamptz
        limit 1`);
      if (byImage[0]) match = { id: byImage[0].meta_id, by: 'image' };
    }
    if (match) {
      await store.updateVariant(v.id, { matchedAdMetaId: match.id, matchedBy: match.by, matchedAt: new Date().toISOString() });
      v.matchedAdMetaId = match.id;
      v.matchedBy = match.by;
    }
  }
}

export async function packResults(userId: string, pack: TestPackRow, variants: TestPackVariantRow[]): Promise<PackResults> {
  const conn = await MetaConnectionDAO.getByUser(userId);
  const empty: PackResults = { connected: false, currency: null, minSpend: 0, byVariant: {}, leaderVariantId: null };
  if (!conn) return empty;
  await matchVariants(conn.id, pack.createdAt, variants);
  const assets = await MetaConnectionDAO.listAssets(userId);
  const currency = assets.find((a) => a.kind === 'ad_account' && a.selected)?.currency ?? null;
  const since = pack.createdAt.slice(0, 10);

  const matched = variants.filter((v) => v.matchedAdMetaId);
  const metrics = new Map<string, Record<string, unknown>>();
  if (matched.length) {
    const ids = sql.join(matched.map((v) => sql`${v.matchedAdMetaId}`), sql`, `);
    const r = await rows(sql`
      select i.ad_meta_id, coalesce(sum(i.spend),0) spend,
        coalesce(sum(coalesce(i.revenue, case when i.roas_source = 'meta' then i.roas * i.spend end)),0) revenue,
        count(coalesce(i.revenue, case when i.roas_source = 'meta' then i.roas * i.spend end)) revenue_rows,
        coalesce(sum(i.purchases),0) purchases, count(i.purchases) purchase_rows,
        coalesce(sum(i.clicks),0) clicks, coalesce(sum(i.impressions),0) impressions,
        max(a.effective_status) status
      from meta_ad_insights_daily i
      left join meta_ads a on a.connection_id = i.connection_id and a.meta_id = i.ad_meta_id
      where i.connection_id = ${conn.id} and i.ad_meta_id in (${ids}) and i.date >= ${since}::date
      group by i.ad_meta_id`);
    r.forEach((x) => metrics.set(String(x.ad_meta_id), x));
  }

  // Minimum spend uses the account's 30-day CPA, like ad scoring.
  const [acct] = await rows<{ cpa: number | null }>(sql`
    select case when sum(purchases) > 0 then sum(spend) / sum(purchases) end as cpa
    from meta_ad_insights_daily where connection_id = ${conn.id} and date >= current_date - 30`);
  const minSpend = minSpendThreshold(currency, acct?.cpa != null ? Number(acct.cpa) : null);

  const byVariant: PackResults['byVariant'] = {};
  for (const v of variants) {
    const m = v.matchedAdMetaId ? metrics.get(v.matchedAdMetaId) : null;
    if (!v.matchedAdMetaId) { byVariant[v.id] = null; continue; }
    const s: Sums = m ? {
      spend: Number(m.spend), revenue: Number(m.revenue), revenueRows: Number(m.revenue_rows), purchases: Number(m.purchases),
      purchaseRows: Number(m.purchase_rows), clicks: Number(m.clicks), impressions: Number(m.impressions),
    } : emptySums();
    byVariant[v.id] = { ...deriveKpis(s), impressions: s.impressions, clicks: s.clicks, adStatus: (m?.status as string) ?? null, enoughData: s.spend >= minSpend && s.impressions >= 1000 };
  }

  // Leader: among variants with enough data, best ROAS (or lowest cost per purchase when ROAS is unknown).
  const judged = variants.filter((v) => byVariant[v.id]?.enoughData);
  let leader: string | null = null;
  if (judged.length >= 2) {
    const useRoas = judged.every((v) => byVariant[v.id]!.roas !== null);
    const sorted = [...judged].sort((a, b) => useRoas
      ? byVariant[b.id]!.roas! - byVariant[a.id]!.roas!
      : (byVariant[a.id]!.cpa ?? Infinity) - (byVariant[b.id]!.cpa ?? Infinity));
    leader = sorted[0].id;
  }
  return { connected: true, currency, minSpend, byVariant, leaderVariantId: leader };
}
