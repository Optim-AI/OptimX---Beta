import { db } from "../client";
import { adAccounts } from "@/database/schema";
import { and, eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { DiscoveredAdAccount } from "@/lib/ads/types";

type AdAccount = typeof adAccounts.$inferSelect;

export class AdAccountDAO {
  static async listByIntegration(integrationId: string): Promise<AdAccount[]> {
    return db
      .select()
      .from(adAccounts)
      .where(eq(adAccounts.integrationId, integrationId))
      .orderBy(desc(adAccounts.createdAt));
  }

  static async findSelected(integrationId: string): Promise<AdAccount | null> {
    const rows = await db
      .select()
      .from(adAccounts)
      .where(
        and(
          eq(adAccounts.integrationId, integrationId),
          eq(adAccounts.isSelected, true)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  static async findByExternalId(
    integrationId: string,
    accountId: string
  ): Promise<AdAccount | null> {
    const rows = await db
      .select()
      .from(adAccounts)
      .where(
        and(
          eq(adAccounts.integrationId, integrationId),
          eq(adAccounts.accountId, accountId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  static async upsertDiscovered(
    integrationId: string,
    provider: string,
    accounts: DiscoveredAdAccount[]
  ): Promise<AdAccount[]> {
    const results: AdAccount[] = [];
    for (const a of accounts) {
      const accountId = String(a.accountId).replace(/^act_/, "");
      const existing = await this.findByExternalId(integrationId, accountId);
      if (existing) {
        const [updated] = await db
          .update(adAccounts)
          .set({
            provider,
            name: a.name ?? existing.name,
            currency: a.currency ?? existing.currency,
            timezone: a.timezone ?? existing.timezone,
            status: a.status ?? existing.status,
            accountRaw: (a.raw as any) ?? existing.accountRaw,
            metadata: (a.metadata as any) ?? existing.metadata,
          })
          .where(eq(adAccounts.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db
          .insert(adAccounts)
          .values({
            id: randomUUID(),
            integrationId,
            accountId,
            provider,
            name: a.name ?? null,
            currency: a.currency ?? null,
            timezone: a.timezone ?? null,
            status: a.status ?? null,
            isSelected: false,
            accountRaw: (a.raw as any) ?? null,
            metadata: (a.metadata as any) ?? null,
          })
          .returning();
        results.push(created);
      }
    }
    return results;
  }

  static async selectAccount(
    integrationId: string,
    accountId: string
  ): Promise<AdAccount | null> {
    const normalized = String(accountId).replace(/^act_/, "");
    const target = await this.findByExternalId(integrationId, normalized);
    if (!target) return null;

    // Clear previous selection
    await db
      .update(adAccounts)
      .set({ isSelected: false })
      .where(eq(adAccounts.integrationId, integrationId));

    const [updated] = await db
      .update(adAccounts)
      .set({ isSelected: true })
      .where(eq(adAccounts.id, target.id))
      .returning();

    return updated;
  }

  static async deleteByIntegration(integrationId: string): Promise<void> {
    await db
      .delete(adAccounts)
      .where(eq(adAccounts.integrationId, integrationId));
  }

  static async markSynced(id: string): Promise<void> {
    await db
      .update(adAccounts)
      .set({ lastSyncedAt: new Date().toISOString() })
      .where(eq(adAccounts.id, id));
  }
}
