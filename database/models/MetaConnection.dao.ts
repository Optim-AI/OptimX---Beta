// database/models/MetaConnection.dao.ts
// Meta Intelligence connections + assets. Every query is scoped by userId
// except the callback lookups by Meta user id (data deletion / deauthorize).
import { db } from '../client';
import { metaAssets, metaConnections, metaDeletionRequests } from '@/database/schema';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

export type MetaConnectionRow = typeof metaConnections.$inferSelect;
export type MetaAssetRow = typeof metaAssets.$inferSelect;
export type MetaDeletionRequestRow = typeof metaDeletionRequests.$inferSelect;
export type MetaAssetKind = 'ad_account' | 'page' | 'ig_account';
export type MetaConnectionStatus = 'pending' | 'active' | 'expired' | 'revoked' | 'error';

export type MetaAssetInput = {
  kind: MetaAssetKind;
  metaId: string;
  name: string | null;
  parentMetaId?: string | null;
  currency?: string | null;
  timezoneName?: string | null;
  accountStatus?: number | null;
  pageTokenEnc?: string | null;
  metadata?: Record<string, unknown>;
};

export type MetaConnectionUpsert = {
  userId: string;
  brandKitId: string | null;
  metaUserId: string | null;
  metaUserName: string | null;
  businessId: string | null;
  businessName: string | null;
  tokenEnc: string;
  tokenType: 'system_user' | 'user';
  scopes: string[];
  tokenExpiresAt: string | null;
  dataAccessExpiresAt: string | null;
};

const now = () => new Date().toISOString();

export class MetaConnectionDAO {
  static async getByUser(userId: string): Promise<MetaConnectionRow | null> {
    const [row] = await db.select().from(metaConnections).where(eq(metaConnections.userId, userId)).limit(1);
    return row ?? null;
  }

  static async findByMetaUserId(metaUserId: string): Promise<MetaConnectionRow[]> {
    return db.select().from(metaConnections).where(eq(metaConnections.metaUserId, metaUserId));
  }

  /**
   * Insert or refresh the user's connection after OAuth.
   * A reconnect keeps the row id (and so the linked assets) and becomes active again
   * if a selection already exists; a first connect stays `pending` until the picker is saved.
   */
  static async upsertFromConnect(input: MetaConnectionUpsert): Promise<MetaConnectionRow> {
    const values = {
      ...input,
      status: 'pending' as MetaConnectionStatus,
      lastError: null,
      lastCheckedAt: now(),
      connectedAt: now(),
      updatedAt: now(),
    };
    const [row] = await db
      .insert(metaConnections)
      .values(values)
      .onConflictDoUpdate({
        target: metaConnections.userId,
        set: {
          brandKitId: sql`coalesce(excluded.brand_kit_id, ${metaConnections.brandKitId})`,
          metaUserId: values.metaUserId,
          metaUserName: values.metaUserName,
          businessId: values.businessId,
          businessName: values.businessName,
          tokenEnc: values.tokenEnc,
          tokenType: values.tokenType,
          scopes: values.scopes,
          tokenExpiresAt: values.tokenExpiresAt,
          dataAccessExpiresAt: values.dataAccessExpiresAt,
          status: 'pending',
          lastError: null,
          lastCheckedAt: values.lastCheckedAt,
          connectedAt: values.connectedAt,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    return row;
  }

  /** Replace the discovered asset list, keeping `selected` on assets that are still visible. */
  static async replaceAssets(connectionId: string, userId: string, assets: MetaAssetInput[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const a of assets) {
        await tx
          .insert(metaAssets)
          .values({
            connectionId,
            userId,
            kind: a.kind,
            metaId: a.metaId,
            name: a.name,
            parentMetaId: a.parentMetaId ?? null,
            currency: a.currency ?? null,
            timezoneName: a.timezoneName ?? null,
            accountStatus: a.accountStatus ?? null,
            pageTokenEnc: a.pageTokenEnc ?? null,
            metadata: a.metadata ?? {},
          })
          .onConflictDoUpdate({
            target: [metaAssets.connectionId, metaAssets.kind, metaAssets.metaId],
            set: {
              name: a.name,
              parentMetaId: a.parentMetaId ?? null,
              currency: a.currency ?? null,
              timezoneName: a.timezoneName ?? null,
              accountStatus: a.accountStatus ?? null,
              pageTokenEnc: a.pageTokenEnc ?? null,
              metadata: a.metadata ?? {},
              updatedAt: now(),
            },
          });
      }
      const keepKeys = assets.map((a) => `${a.kind}:${a.metaId}`);
      const stale = keepKeys.length
        ? and(
            eq(metaAssets.connectionId, connectionId),
            notInArray(sql<string>`${metaAssets.kind} || ':' || ${metaAssets.metaId}`, keepKeys),
          )
        : eq(metaAssets.connectionId, connectionId);
      await tx.delete(metaAssets).where(stale);
    });
  }

  static async listAssets(userId: string): Promise<MetaAssetRow[]> {
    return db.select().from(metaAssets).where(eq(metaAssets.userId, userId));
  }

  /** Save the picker choice and mark the connection active. Ids must belong to this user's connection. */
  static async saveSelection(
    userId: string,
    selection: { adAccountIds: string[]; pageId: string | null; igAccountId: string | null },
  ): Promise<MetaConnectionRow | null> {
    const conn = await this.getByUser(userId);
    if (!conn) return null;
    const chosen = [
      ...selection.adAccountIds.map((id) => ({ kind: 'ad_account', id })),
      ...(selection.pageId ? [{ kind: 'page', id: selection.pageId }] : []),
      ...(selection.igAccountId ? [{ kind: 'ig_account', id: selection.igAccountId }] : []),
    ];
    await db.transaction(async (tx) => {
      await tx
        .update(metaAssets)
        .set({ selected: false, updatedAt: now() })
        .where(eq(metaAssets.connectionId, conn.id));
      for (const c of chosen) {
        await tx
          .update(metaAssets)
          .set({ selected: true, updatedAt: now() })
          .where(and(eq(metaAssets.connectionId, conn.id), eq(metaAssets.kind, c.kind), eq(metaAssets.metaId, c.id)));
      }
    });
    const [row] = await db
      .update(metaConnections)
      .set({ status: 'active', lastError: null, updatedAt: now() })
      .where(eq(metaConnections.id, conn.id))
      .returning();
    return row ?? null;
  }

  static async updateHealth(
    connectionId: string,
    patch: { status?: MetaConnectionStatus; lastError?: string | null; tokenExpiresAt?: string | null; dataAccessExpiresAt?: string | null; scopes?: string[] },
  ): Promise<void> {
    await db
      .update(metaConnections)
      .set({ ...patch, lastCheckedAt: now(), updatedAt: now() })
      .where(eq(metaConnections.id, connectionId));
  }

  /** Drop the stored token but keep the row (deauthorize). */
  static async revokeTokens(connectionIds: string[]): Promise<void> {
    if (!connectionIds.length) return;
    await db.transaction(async (tx) => {
      await tx
        .update(metaConnections)
        .set({ tokenEnc: '', status: 'revoked', lastError: 'Access was removed in Facebook settings', updatedAt: now() })
        .where(inArray(metaConnections.id, connectionIds));
      await tx.update(metaAssets).set({ pageTokenEnc: null }).where(inArray(metaAssets.connectionId, connectionIds));
    });
  }

  /** Deletes the connection; assets (and Phase 2 synced tables) cascade. */
  static async deleteConnections(connectionIds: string[]): Promise<number> {
    if (!connectionIds.length) return 0;
    const rows = await db.delete(metaConnections).where(inArray(metaConnections.id, connectionIds)).returning({ id: metaConnections.id });
    return rows.length;
  }

  static async createDeletionRequest(input: {
    confirmationCode: string;
    source: 'meta_callback' | 'deauthorize' | 'user_disconnect';
    metaUserId: string | null;
    userId: string | null;
  }): Promise<MetaDeletionRequestRow> {
    const [row] = await db.insert(metaDeletionRequests).values(input).returning();
    return row;
  }

  static async finishDeletionRequest(
    id: string,
    status: 'completed' | 'no_data' | 'failed',
    details: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(metaDeletionRequests)
      .set({ status, details, completedAt: now() })
      .where(eq(metaDeletionRequests.id, id));
  }

  static async getDeletionRequestByCode(code: string): Promise<MetaDeletionRequestRow | null> {
    const [row] = await db
      .select()
      .from(metaDeletionRequests)
      .where(eq(metaDeletionRequests.confirmationCode, code))
      .limit(1);
    return row ?? null;
  }
}
