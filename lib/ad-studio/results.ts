/**
 * Results loop for kept posters: find each poster's live Meta ad (by its SKX- name, or by the
 * image fingerprint), only among ads created after the poster was kept, and show real results.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { deriveKpis, emptySums, type Kpis, type Sums } from '@/lib/meta-intel/kpis';
import { minSpendThreshold, SCORING } from '@/lib/meta-intel/scoring';
import * as store from './store';

export type PosterResult = Kpis & { impressions: number; adStatus: string | null; enoughData: boolean };
export type PosterResults = { connected: boolean; currency: string | null; byDraft: Record<string, PosterResult | null>; leaderDraftId: string | null };

async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  return ((await db.execute(q)) as unknown as { rows: T[] }).rows;
}

export async function posterResults(userId: string, projectId: string): Promise<PosterResults> {
  const conn = await MetaConnectionDAO.getByUser(userId).catch(() => null);
  if (!conn) return { connected: false, currency: null, byDraft: {}, leaderDraftId: null };
  const kept = (await store.listDrafts(projectId)).filter((d) => d.userId === userId && d.kept && d.adName && d.keptAt);
  if (!kept.length) return { connected: true, currency: null, byDraft: {}, leaderDraftId: null };

  for (const d of kept) {
    if (d.matchedAdMetaId) continue;
    const since = d.keptAt!;
    const byName = await rows<{ meta_id: string }>(sql`
      select meta_id from meta_ads
      where connection_id = ${conn.id} and lower(name) like ${d.adName!.toLowerCase() + '%'}
        and coalesce(created_time, synced_at) >= ${since}::timestamptz
      order by created_time desc nulls last limit 1`);
    let match: { id: string; by: 'name' | 'image' } | null = byName[0] ? { id: byName[0].meta_id, by: 'name' } : null;
    if (!match && d.imageMd5) {
      const byImage = await rows<{ meta_id: string }>(sql`
        select a.meta_id from meta_ads a
        join meta_creatives c on c.connection_id = a.connection_id and c.meta_id = a.creative_meta_id
        where a.connection_id = ${conn.id} and (c.stored_md5 = ${d.imageMd5} or lower(c.image_hash) = ${d.imageMd5})
          and coalesce(a.created_time, a.synced_at) >= ${since}::timestamptz
        limit 1`);
      if (byImage[0]) match = { id: byImage[0].meta_id, by: 'image' };
    }
    if (match) {
      await store.updateDraft(d.id, { matchedAdMetaId: match.id, matchedBy: match.by, matchedAt: new Date().toISOString() });
      d.matchedAdMetaId = match.id;
    }
  }

  const assets = await MetaConnectionDAO.listAssets(userId);
  const currency = assets.find((a) => a.kind === 'ad_account' && a.selected)?.currency ?? null;
  const matched = kept.filter((d) => d.matchedAdMetaId);
  const metrics = new Map<string, Record<string, unknown>>();
  if (matched.length) {
    const ids = sql.join(matched.map((d) => sql`${d.matchedAdMetaId}`), sql`, `);
    const r = await rows(sql`
      select i.ad_meta_id, coalesce(sum(i.spend),0) spend,
        coalesce(sum(coalesce(i.revenue, case when i.roas_source = 'meta' then i.roas * i.spend end)),0) revenue,
        count(coalesce(i.revenue, case when i.roas_source = 'meta' then i.roas * i.spend end)) revenue_rows,
        coalesce(sum(i.purchases),0) purchases, count(i.purchases) purchase_rows,
        coalesce(sum(i.clicks),0) clicks, coalesce(sum(i.impressions),0) impressions, max(a.effective_status) status
      from meta_ad_insights_daily i
      left join meta_ads a on a.connection_id = i.connection_id and a.meta_id = i.ad_meta_id
      where i.connection_id = ${conn.id} and i.ad_meta_id in (${ids})
      group by i.ad_meta_id`);
    r.forEach((x) => metrics.set(String(x.ad_meta_id), x));
  }
  const [acct] = await rows<{ cpa: string | null }>(sql`
    select case when sum(purchases) > 0 then sum(spend) / sum(purchases) end as cpa
    from meta_ad_insights_daily where connection_id = ${conn.id} and date >= current_date - 30`);
  const minSpend = minSpendThreshold(currency, acct?.cpa != null ? Number(acct.cpa) : null);

  const byDraft: PosterResults['byDraft'] = {};
  for (const d of kept) {
    if (!d.matchedAdMetaId) { byDraft[d.id] = null; continue; }
    const m = metrics.get(d.matchedAdMetaId);
    const s: Sums = m ? { spend: Number(m.spend), revenue: Number(m.revenue), revenueRows: Number(m.revenue_rows), purchases: Number(m.purchases), purchaseRows: Number(m.purchase_rows), clicks: Number(m.clicks), impressions: Number(m.impressions) } : emptySums();
    byDraft[d.id] = { ...deriveKpis(s), impressions: s.impressions, adStatus: (m?.status as string) ?? null, enoughData: s.spend >= minSpend && s.impressions >= SCORING.MIN_IMPRESSIONS };
  }
  const judged = kept.filter((d) => byDraft[d.id]?.enoughData);
  let leader: string | null = null;
  if (judged.length >= 2) {
    const useRoas = judged.every((d) => byDraft[d.id]!.roas !== null);
    leader = [...judged].sort((a, b) => useRoas ? byDraft[b.id]!.roas! - byDraft[a.id]!.roas! : (byDraft[a.id]!.cpa ?? Infinity) - (byDraft[b.id]!.cpa ?? Infinity))[0].id;
  }
  return { connected: true, currency, byDraft, leaderDraftId: leader };
}
