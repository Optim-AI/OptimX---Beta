import { db } from "../client";
import { adMetricsDaily, adPlatformEntities, adSyncRuns } from "@/database/schema";
import { and, asc, eq, gte, lte, desc } from "drizzle-orm";
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
    entityType?: string
  ) {
    const conditions = entityType
      ? and(
          eq(adPlatformEntities.integrationId, integrationId),
          eq(adPlatformEntities.entityType, entityType)
        )
      : eq(adPlatformEntities.integrationId, integrationId);

    return db
      .select()
      .from(adPlatformEntities)
      .where(conditions)
      .orderBy(desc(adPlatformEntities.updatedAt));
  }
}

export class AdMetricsDAO {
  static async upsertDaily(
    integrationId: string,
    adAccountId: string | null,
    provider: string,
    rows: DailyMetricInput[]
  ): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      const existing = await db
        .select({ id: adMetricsDaily.id })
        .from(adMetricsDaily)
        .where(
          and(
            eq(adMetricsDaily.integrationId, integrationId),
            eq(adMetricsDaily.entityType, r.entityType),
            eq(adMetricsDaily.entityExternalId, r.entityExternalId),
            eq(adMetricsDaily.metricDate, r.metricDate)
          )
        )
        .limit(1);

      const payload = {
        adAccountId: adAccountId ?? null,
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
    since: string,
    until: string,
    entityType: string = "account"
  ): Promise<AggregatedMetrics> {
    const rows = await db
      .select()
      .from(adMetricsDaily)
      .where(
        and(
          eq(adMetricsDaily.integrationId, integrationId),
          eq(adMetricsDaily.entityType, entityType),
          gte(adMetricsDaily.metricDate, since),
          lte(adMetricsDaily.metricDate, until)
        )
      );

    const agg = emptyAggregatedMetrics();
    for (const r of rows) {
      agg.spend += Number(r.spend || 0);
      agg.impressions += Number(r.impressions || 0);
      agg.reach += Number(r.reach || 0);
      agg.clicks += Number(r.clicks || 0);
      agg.conversions += Number(r.conversions || 0);
      agg.conversionValue += Number(r.conversionValue || 0);
    }
    return deriveMetricRates(agg);
  }

  /** Account-level daily rows for a range. Callers sum rows that share a date. */
  static async listAccountDaily(integrationId: string, since: string, until: string) {
    return db
      .select({
        metricDate: adMetricsDaily.metricDate,
        spend: adMetricsDaily.spend,
        impressions: adMetricsDaily.impressions,
        reach: adMetricsDaily.reach,
        clicks: adMetricsDaily.clicks,
        conversions: adMetricsDaily.conversions,
      })
      .from(adMetricsDaily)
      .where(
        and(
          eq(adMetricsDaily.integrationId, integrationId),
          eq(adMetricsDaily.entityType, "account"),
          gte(adMetricsDaily.metricDate, since),
          lte(adMetricsDaily.metricDate, until)
        )
      )
      .orderBy(asc(adMetricsDaily.metricDate));
  }

  static async listCampaignMetrics(
    integrationId: string,
    since: string,
    until: string
  ) {
    return db
      .select()
      .from(adMetricsDaily)
      .where(
        and(
          eq(adMetricsDaily.integrationId, integrationId),
          eq(adMetricsDaily.entityType, "campaign"),
          gte(adMetricsDaily.metricDate, since),
          lte(adMetricsDaily.metricDate, until)
        )
      )
      .orderBy(desc(adMetricsDaily.metricDate));
  }

  static async hasData(integrationId: string): Promise<boolean> {
    const rows = await db
      .select({ id: adMetricsDaily.id })
      .from(adMetricsDaily)
      .where(eq(adMetricsDaily.integrationId, integrationId))
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
