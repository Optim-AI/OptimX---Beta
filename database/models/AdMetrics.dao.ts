import { db } from "../client";
import { adMetricsDaily, adPlatformEntities, adSyncRuns } from "@/database/schema";
import { and, asc, eq, gte, lte, desc, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  AggregatedMetrics,
  DailyMetricInput,
  PlatformEntityInput,
} from "@/lib/ads/types";
import {
  deriveMetricRates,
  emptyAggregatedMetrics,
} from "@/lib/ads/types";
import {
  summarizeSpendByCurrency,
  type SpendCurrencyBreakdown,
} from "@/lib/ads/analytics/currency";

/** Metrics reads require an explicit ad_accounts.id — never omit. */
function requireAdAccountId(adAccountId: string): string {
  const id = String(adAccountId || "").trim();
  if (!id) {
    throw new Error("adAccountId is required for metrics account isolation");
  }
  return id;
}

function metricsAccountRangeWhere(
  integrationId: string,
  adAccountId: string,
  since: string,
  until: string,
  entityType: string
): SQL | undefined {
  return and(
    eq(adMetricsDaily.integrationId, integrationId),
    eq(adMetricsDaily.adAccountId, adAccountId),
    eq(adMetricsDaily.entityType, entityType),
    gte(adMetricsDaily.metricDate, since),
    lte(adMetricsDaily.metricDate, until)
  );
}

export class AdPlatformEntityDAO {
  static async upsertMany(
    integrationId: string,
    adAccountId: string | null,
    provider: string,
    entities: PlatformEntityInput[]
  ): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const e of entities) {
      const existing = await db
        .select({ id: adPlatformEntities.id })
        .from(adPlatformEntities)
        .where(
          and(
            eq(adPlatformEntities.integrationId, integrationId),
            eq(adPlatformEntities.entityType, e.entityType),
            eq(adPlatformEntities.externalId, e.externalId)
          )
        )
        .limit(1);

      const payload = {
        adAccountId: adAccountId ?? null,
        provider,
        entityType: e.entityType,
        externalId: e.externalId,
        parentExternalId: e.parentExternalId ?? null,
        name: e.name ?? null,
        status: e.status ?? null,
        objective: e.objective ?? null,
        dailyBudget:
          e.dailyBudget != null ? String(e.dailyBudget) : null,
        lifetimeBudget:
          e.lifetimeBudget != null ? String(e.lifetimeBudget) : null,
        currency: e.currency ?? null,
        raw: (e.raw as any) ?? null,
        metadata: (e.metadata as any) ?? null,
        lastSeenAt: now,
        updatedAt: now,
      };

      if (existing[0]) {
        await db
          .update(adPlatformEntities)
          .set(payload)
          .where(eq(adPlatformEntities.id, existing[0].id));
      } else {
        await db.insert(adPlatformEntities).values({
          id: randomUUID(),
          integrationId,
          ...payload,
          firstSeenAt: now,
          createdAt: now,
        });
      }
      count++;
    }
    return count;
  }

  static async listByIntegration(
    integrationId: string,
    entityType?: string,
    adAccountId?: string | null
  ) {
    const conditions = [
      eq(adPlatformEntities.integrationId, integrationId),
    ];
    if (entityType) {
      conditions.push(eq(adPlatformEntities.entityType, entityType));
    }
    if (adAccountId) {
      conditions.push(eq(adPlatformEntities.adAccountId, adAccountId));
    }

    return db
      .select()
      .from(adPlatformEntities)
      .where(and(...conditions))
      .orderBy(desc(adPlatformEntities.updatedAt));
  }
}

export class AdMetricsDAO {
  static async upsertDaily(
    integrationId: string,
    adAccountId: string,
    provider: string,
    rows: DailyMetricInput[]
  ): Promise<number> {
    const accountId = requireAdAccountId(adAccountId);
    let count = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      // Grain includes ad_account_id so accounts never overwrite each other
      const existing = await db
        .select({ id: adMetricsDaily.id })
        .from(adMetricsDaily)
        .where(
          and(
            eq(adMetricsDaily.integrationId, integrationId),
            eq(adMetricsDaily.adAccountId, accountId),
            eq(adMetricsDaily.entityType, r.entityType),
            eq(adMetricsDaily.entityExternalId, r.entityExternalId),
            eq(adMetricsDaily.metricDate, r.metricDate)
          )
        )
        .limit(1);

      const payload = {
        adAccountId: accountId,
        provider,
        entityType: r.entityType,
        entityExternalId: r.entityExternalId,
        metricDate: r.metricDate,
        spend: String(r.spend ?? 0),
        impressions: Math.round(r.impressions ?? 0),
        reach: Math.round(r.reach ?? 0),
        frequency: r.frequency != null ? String(r.frequency) : null,
        clicks: Math.round(r.clicks ?? 0),
        ctr: r.ctr != null ? String(r.ctr) : null,
        cpc: r.cpc != null ? String(r.cpc) : null,
        cpm: r.cpm != null ? String(r.cpm) : null,
        conversions: String(r.conversions ?? 0),
        conversionValue: String(r.conversionValue ?? 0),
        cpa: r.cpa != null ? String(r.cpa) : null,
        cpl: r.cpl != null ? String(r.cpl) : null,
        roas: r.roas != null ? String(r.roas) : null,
        currency: r.currency ?? null,
        raw: (r.raw as any) ?? null,
        updatedAt: now,
      };

      if (existing[0]) {
        await db
          .update(adMetricsDaily)
          .set(payload)
          .where(eq(adMetricsDaily.id, existing[0].id));
      } else {
        await db.insert(adMetricsDaily).values({
          id: randomUUID(),
          integrationId,
          ...payload,
          createdAt: now,
        });
      }
      count++;
    }
    return count;
  }

  static async aggregateRange(
    integrationId: string,
    adAccountId: string,
    since: string,
    until: string,
    entityType: string = "account"
  ): Promise<AggregatedMetrics> {
    const withCoverage = await this.aggregateRangeWithCoverage(
      integrationId,
      adAccountId,
      since,
      until,
      entityType
    );
    const {
      rowCount: _rowCount,
      currency: _currency,
      mixedCurrency: _mixed,
      spendByCurrency: _byCcy,
      ...metrics
    } = withCoverage;
    return metrics;
  }

  /**
   * Aggregate with rowCount so callers can distinguish actual zeros
   * (rows present, values 0) from an empty range (no rows → unknown).
   * Scoped to one ad_accounts.id — never sums sibling accounts.
   */
  static async aggregateRangeWithCoverage(
    integrationId: string,
    adAccountId: string,
    since: string,
    until: string,
    entityType: string = "account"
  ): Promise<
    AggregatedMetrics & {
      rowCount: number;
      currency: string | null;
      mixedCurrency: boolean;
      spendByCurrency: Record<string, number>;
    }
  > {
    const accountId = requireAdAccountId(adAccountId);
    const rows = await db
      .select()
      .from(adMetricsDaily)
      .where(
        metricsAccountRangeWhere(
          integrationId,
          accountId,
          since,
          until,
          entityType
        )
      );

    const spendSummary: SpendCurrencyBreakdown = summarizeSpendByCurrency(rows);
    const agg = emptyAggregatedMetrics();
    for (const r of rows) {
      // Only fold spend into a single total when currencies are not mixed
      if (!spendSummary.mixedCurrency) {
        agg.spend += Number(r.spend || 0);
      }
      agg.impressions += Number(r.impressions || 0);
      agg.reach += Number(r.reach || 0);
      agg.clicks += Number(r.clicks || 0);
      agg.conversions += Number(r.conversions || 0);
      // conversionValue is currency-denominated — same mixed-currency guard
      if (!spendSummary.mixedCurrency) {
        agg.conversionValue += Number(r.conversionValue || 0);
      }
    }
    const derived = deriveMetricRates(agg);
    // Money rates are meaningless when currencies are mixed
    if (spendSummary.mixedCurrency) {
      derived.spend = 0;
      derived.conversionValue = 0;
      derived.cpc = null;
      derived.cpm = null;
      derived.cpa = null;
      derived.cpl = null;
      derived.roas = null;
    } else if (spendSummary.totalSpend != null) {
      derived.spend = spendSummary.totalSpend;
    }
    return {
      ...derived,
      rowCount: rows.length,
      currency: spendSummary.currency,
      mixedCurrency: spendSummary.mixedCurrency,
      spendByCurrency: spendSummary.spendByCurrency,
    };
  }

  /** Account-level daily rows for one selected ad account. */
  static async listAccountDaily(
    integrationId: string,
    adAccountId: string,
    since: string,
    until: string
  ) {
    const accountId = requireAdAccountId(adAccountId);
    return db
      .select({
        metricDate: adMetricsDaily.metricDate,
        spend: adMetricsDaily.spend,
        impressions: adMetricsDaily.impressions,
        reach: adMetricsDaily.reach,
        clicks: adMetricsDaily.clicks,
        conversions: adMetricsDaily.conversions,
        currency: adMetricsDaily.currency,
        adAccountId: adMetricsDaily.adAccountId,
      })
      .from(adMetricsDaily)
      .where(
        metricsAccountRangeWhere(
          integrationId,
          accountId,
          since,
          until,
          "account"
        )
      )
      .orderBy(asc(adMetricsDaily.metricDate));
  }

  static async listCampaignMetrics(
    integrationId: string,
    adAccountId: string,
    since: string,
    until: string
  ) {
    const accountId = requireAdAccountId(adAccountId);
    return db
      .select()
      .from(adMetricsDaily)
      .where(
        metricsAccountRangeWhere(
          integrationId,
          accountId,
          since,
          until,
          "campaign"
        )
      )
      .orderBy(desc(adMetricsDaily.metricDate));
  }

  /** True when the selected ad account has any stamped warehouse rows. */
  static async hasData(
    integrationId: string,
    adAccountId: string
  ): Promise<boolean> {
    const accountId = requireAdAccountId(adAccountId);
    const rows = await db
      .select({ id: adMetricsDaily.id })
      .from(adMetricsDaily)
      .where(
        and(
          eq(adMetricsDaily.integrationId, integrationId),
          eq(adMetricsDaily.adAccountId, accountId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }
}

export class AdSyncRunDAO {
  static async start(input: {
    integrationId: string;
    adAccountId?: string | null;
    provider: string;
    triggerSource?: string;
    sinceDate?: string;
    untilDate?: string;
  }) {
    const [row] = await db
      .insert(adSyncRuns)
      .values({
        id: randomUUID(),
        integrationId: input.integrationId,
        adAccountId: input.adAccountId ?? null,
        provider: input.provider,
        triggerSource: input.triggerSource ?? "manual",
        status: "running",
        sinceDate: input.sinceDate ?? null,
        untilDate: input.untilDate ?? null,
        startedAt: new Date().toISOString(),
      })
      .returning();
    return row;
  }

  static async finish(
    id: string,
    data: {
      status: "success" | "partial" | "error";
      entitiesUpserted?: number;
      metricsUpserted?: number;
      errorMessage?: string | null;
      details?: unknown;
    }
  ) {
    const [row] = await db
      .update(adSyncRuns)
      .set({
        status: data.status,
        finishedAt: new Date().toISOString(),
        entitiesUpserted: data.entitiesUpserted ?? 0,
        metricsUpserted: data.metricsUpserted ?? 0,
        errorMessage: data.errorMessage ?? null,
        details: (data.details as any) ?? null,
      })
      .where(eq(adSyncRuns.id, id))
      .returning();
    return row;
  }

  static async listRecent(integrationId: string, limit = 10) {
    return db
      .select()
      .from(adSyncRuns)
      .where(eq(adSyncRuns.integrationId, integrationId))
      .orderBy(desc(adSyncRuns.startedAt))
      .limit(limit);
  }
}
