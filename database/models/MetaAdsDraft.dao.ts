/**
 * Meta Ads local draft DAO (PR W2.0).
 *
 * Ownership is enforced on every operation via authenticated userId.
 * Currency is stamped from the selected ad_accounts row.
 * Does not call Meta Graph. Does not store access tokens.
 */

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/database/client";
import { metaAdsDrafts } from "@/database/schema";
import { IntegrationDAO } from "@/database/models/Integration.dao";
import {
  isMetaAdsDraftStatus,
  type MetaAdsDraftStatus,
} from "@/lib/ads/meta/draft-status";
import {
  MetaAdsDraftValidationError,
  assertFirstReleaseDraftFields,
  assertNoFabricatedMetaIdsForStatus,
  assertTrustedMetaAdsAccountBinding,
  assertValidDailyBudgetMajor,
  assertValidStatusTransition,
} from "@/lib/ads/meta/draft-validation";
import {
  mergeCreativeMetadata,
  resolveMetaAdsCreativeAsset,
  type ResolveMetaAdsCreativeDeps,
} from "@/lib/ads/meta/resolve-creative-asset";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "23505" ||
    /unique|duplicate/i.test(String(e?.message || ""))
  );
}

export type MetaAdsDraftRow = typeof metaAdsDrafts.$inferSelect;

export type MetaAdsDraftCreateInput = {
  /** Verified server auth subject — never from body alone. */
  userId: string;
  integrationId: string;
  /** Internal `ad_accounts.id` UUID */
  adAccountId: string;
  name?: string | null;
  objective?: string | null;
  /** Major currency units (e.g. 10.50) */
  dailyBudgetMajor?: number | string | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  targeting?: Record<string, unknown> | null;
  placements?: Record<string, unknown> | null;
  sourceImageId?: string | null;
  sourceImageUrl?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  destinationUrl?: string | null;
  callToAction?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MetaAdsDraftUpdateInput = {
  name?: string | null;
  objective?: string | null;
  dailyBudgetMajor?: number | string | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  targeting?: Record<string, unknown> | null;
  placements?: Record<string, unknown> | null;
  sourceImageId?: string | null;
  sourceImageUrl?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  destinationUrl?: string | null;
  callToAction?: string | null;
  status?: MetaAdsDraftStatus;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  idempotencyKey?: string | null;
  createAttemptId?: string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * Meta object ids — only accepted when transitioning/staying in
   * creating | created_paused | partial_failure. Callers must not pass these
   * for local drafts.
   */
  metaCampaignId?: string | null;
  metaAdsetId?: string | null;
  metaCreativeId?: string | null;
  metaAdId?: string | null;
  createdOnMetaAt?: string | null;
};

export type MetaAdsDraftDaoDeps = {
  findIntegrationById: (
    id: string
  ) => Promise<Awaited<ReturnType<typeof IntegrationDAO.findById>>>;
  findAdAccountById: (
    id: string
  ) => Promise<(typeof import("@/database/schema").adAccounts.$inferSelect) | null>;
  insertDraft: (values: Record<string, unknown>) => Promise<MetaAdsDraftRow>;
  updateDraft: (
    id: string,
    userId: string,
    values: Record<string, unknown>
  ) => Promise<MetaAdsDraftRow | null>;
  /**
   * Conditional claim: only transitions from draft|failed|partial_failure → creating.
   * Returns null when no row matched (concurrent claim or ineligible status).
   */
  claimCreatePaused: (
    id: string,
    userId: string,
    createAttemptId: string
  ) => Promise<MetaAdsDraftRow | null>;
  /**
   * Attempt-bound progress write (PR W2.5.1).
   * Requires status=creating AND create_attempt_id match. Returns null on conflict.
   */
  updateCreatingAttempt: (
    id: string,
    userId: string,
    createAttemptId: string,
    values: Record<string, unknown>
  ) => Promise<MetaAdsDraftRow | null>;
  /**
   * Reclaim expired creating attempt: status=creating AND create_attempt_id=previous.
   * Caller must verify lease expiry + no unresolved uncertain step first.
   */
  reclaimCreatingAttempt: (
    id: string,
    userId: string,
    previousAttemptId: string,
    nextAttemptId: string,
    values: Record<string, unknown>
  ) => Promise<MetaAdsDraftRow | null>;
  selectByIdForUser: (
    id: string,
    userId: string
  ) => Promise<MetaAdsDraftRow | null>;
  selectByUser: (userId: string, limit: number) => Promise<MetaAdsDraftRow[]>;
  selectByIdempotencyKey: (
    userId: string,
    idempotencyKey: string
  ) => Promise<MetaAdsDraftRow | null>;
  getGeneratedImageByIdForUser: ResolveMetaAdsCreativeDeps["getByIdForUser"];
};

async function findAdAccountByIdDefault(id: string) {
  const { adAccounts } = await import("@/database/schema");
  const rows = await db
    .select()
    .from(adAccounts)
    .where(eq(adAccounts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

const defaultDeps: MetaAdsDraftDaoDeps = {
  findIntegrationById: (id) => IntegrationDAO.findById(id),
  findAdAccountById: findAdAccountByIdDefault,
  insertDraft: async (values) => {
    const [row] = await db
      .insert(metaAdsDrafts)
      .values(values as any)
      .returning();
    return row;
  },
  updateDraft: async (id, userId, values) => {
    const [row] = await db
      .update(metaAdsDrafts)
      .set(values as any)
      .where(and(eq(metaAdsDrafts.id, id), eq(metaAdsDrafts.userId, userId)))
      .returning();
    return row ?? null;
  },
  claimCreatePaused: async (id, userId, createAttemptId) => {
    const now = new Date().toISOString();
    const [row] = await db
      .update(metaAdsDrafts)
      .set({
        status: "creating",
        createAttemptId,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: now,
      } as any)
      .where(
        and(
          eq(metaAdsDrafts.id, id),
          eq(metaAdsDrafts.userId, userId),
          inArray(metaAdsDrafts.status, ["draft", "failed", "partial_failure"])
        )
      )
      .returning();
    return row ?? null;
  },
  updateCreatingAttempt: async (id, userId, createAttemptId, values) => {
    const [row] = await db
      .update(metaAdsDrafts)
      .set({
        ...values,
        // Never allow callers to silently change attempt ownership via values.
        createAttemptId,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(
        and(
          eq(metaAdsDrafts.id, id),
          eq(metaAdsDrafts.userId, userId),
          eq(metaAdsDrafts.status, "creating"),
          eq(metaAdsDrafts.createAttemptId, createAttemptId)
        )
      )
      .returning();
    return row ?? null;
  },
  reclaimCreatingAttempt: async (
    id,
    userId,
    previousAttemptId,
    nextAttemptId,
    values
  ) => {
    const [row] = await db
      .update(metaAdsDrafts)
      .set({
        ...values,
        status: "creating",
        createAttemptId: nextAttemptId,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(
        and(
          eq(metaAdsDrafts.id, id),
          eq(metaAdsDrafts.userId, userId),
          eq(metaAdsDrafts.status, "creating"),
          eq(metaAdsDrafts.createAttemptId, previousAttemptId)
        )
      )
      .returning();
    return row ?? null;
  },
  selectByIdForUser: async (id, userId) => {
    const rows = await db
      .select()
      .from(metaAdsDrafts)
      .where(and(eq(metaAdsDrafts.id, id), eq(metaAdsDrafts.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },
  selectByUser: async (userId, limit) => {
    return db
      .select()
      .from(metaAdsDrafts)
      .where(eq(metaAdsDrafts.userId, userId))
      .orderBy(desc(metaAdsDrafts.createdAt))
      .limit(limit);
  },
  selectByIdempotencyKey: async (userId, idempotencyKey) => {
    const rows = await db
      .select()
      .from(metaAdsDrafts)
      .where(
        and(
          eq(metaAdsDrafts.userId, userId),
          eq(metaAdsDrafts.idempotencyKey, idempotencyKey),
          isNotNull(metaAdsDrafts.idempotencyKey)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  },
  getGeneratedImageByIdForUser: (id, userId) =>
    GeneratedImageDAO.getByIdForUser(id, userId),
};

function requireUserId(userId: string | null | undefined): string {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) {
    throw new MetaAdsDraftValidationError(
      "unauthenticated",
      "Authenticated user is required for Meta Ads draft operations."
    );
  }
  return id;
}

function budgetToStorage(
  major: number | string | null | undefined
): string | null {
  if (major == null || major === "") return null;
  assertValidDailyBudgetMajor(major);
  return String(major);
}

async function resolveBinding(
  userId: string,
  integrationId: string,
  adAccountId: string,
  deps: MetaAdsDraftDaoDeps
): Promise<{ currency: string }> {
  const integration = await deps.findIntegrationById(integrationId);
  if (!integration) {
    throw new MetaAdsDraftValidationError(
      "integration_account_mismatch",
      "Meta Ads integration not found."
    );
  }
  const account = await deps.findAdAccountById(adAccountId);
  if (!account) {
    throw new MetaAdsDraftValidationError(
      "integration_account_mismatch",
      "Ad account not found."
    );
  }
  return assertTrustedMetaAdsAccountBinding({
    userId,
    integrationId,
    integrationUserId: String(integration.userId),
    integrationProvider: String(integration.provider),
    adAccountId,
    adAccountIntegrationId: String(account.integrationId),
    adAccountProvider: account.provider,
    isSelected: Boolean(account.isSelected),
    currency: account.currency,
  });
}

export type MetaAdsDraftCreateResult = {
  draft: MetaAdsDraftRow;
  /** false when an existing row was returned for the same (user, idempotency_key). */
  created: boolean;
};

export class MetaAdsDraftDAO {
  static async create(
    input: MetaAdsDraftCreateInput,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow> {
    const result = await this.createIdempotent(input, deps);
    return result.draft;
  }

  /**
   * Create a local draft. When `idempotencyKey` is set, concurrent/repeated
   * creates for the same user+key return the existing row (DB unique index
   * `uq_meta_ads_drafts_user_idempotency` + race-safe 23505 handling).
   */
  static async createIdempotent(
    input: MetaAdsDraftCreateInput,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftCreateResult> {
    const d = { ...defaultDeps, ...deps };
    const userId = requireUserId(input.userId);

    // Reject fabricated Meta ids on create — local drafts only.
    assertNoFabricatedMetaIdsForStatus("draft", {
      metaCampaignId: (input as any).metaCampaignId,
      metaAdsetId: (input as any).metaAdsetId,
      metaCreativeId: (input as any).metaCreativeId,
      metaAdId: (input as any).metaAdId,
    });

    assertFirstReleaseDraftFields({
      objective: input.objective,
      callToAction: input.callToAction,
      destinationUrl: input.destinationUrl,
      targeting: input.targeting,
      placements: input.placements,
      scheduleStart: input.scheduleStart,
      scheduleEnd: input.scheduleEnd,
    });

    const key =
      typeof input.idempotencyKey === "string" && input.idempotencyKey.trim()
        ? input.idempotencyKey.trim()
        : null;

    if (key) {
      const existing = await d.selectByIdempotencyKey(userId, key);
      if (existing) return { draft: existing, created: false };
    }

    const { currency } = await resolveBinding(
      userId,
      input.integrationId,
      input.adAccountId,
      d
    );

    const creative = await resolveMetaAdsCreativeAsset({
      userId,
      sourceImageId: input.sourceImageId,
      sourceImageUrl: input.sourceImageUrl,
      deps: { getByIdForUser: d.getGeneratedImageByIdForUser },
    });

    const now = new Date().toISOString();
    const values = {
      id: randomUUID(),
      userId,
      integrationId: input.integrationId,
      adAccountId: input.adAccountId,
      status: "draft",
      name: input.name ?? null,
      objective: input.objective ?? null,
      dailyBudgetMajor: budgetToStorage(input.dailyBudgetMajor),
      currency,
      scheduleStart: input.scheduleStart ?? null,
      scheduleEnd: input.scheduleEnd ?? null,
      targeting: input.targeting ?? {},
      placements: input.placements ?? {},
      sourceImageId: creative?.sourceImageId ?? null,
      sourceImageUrl: creative?.sourceImageUrl ?? null,
      primaryText: input.primaryText ?? null,
      headline: input.headline ?? null,
      destinationUrl: input.destinationUrl ?? null,
      callToAction: input.callToAction ?? null,
      metaCampaignId: null,
      metaAdsetId: null,
      metaCreativeId: null,
      metaAdId: null,
      idempotencyKey: key,
      createAttemptId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
      createdOnMetaAt: null,
      metadata: mergeCreativeMetadata(input.metadata, creative),
    };

    try {
      const draft = await d.insertDraft(values);
      return { draft, created: true };
    } catch (error) {
      if (key && isUniqueViolation(error)) {
        const raced = await d.selectByIdempotencyKey(userId, key);
        if (raced) return { draft: raced, created: false };
      }
      throw error;
    }
  }

  static async archiveForUser(
    id: string,
    userId: string,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    return this.updateForUser(id, userId, { status: "archived" }, deps);
  }

  /**
   * Atomically claim a draft for create-paused orchestration (PR W2.5).
   * Eligible: draft | failed | partial_failure. Concurrent second claim → null.
   * Does not clear existing Meta object ids (resume-safe).
   */
  static async claimForCreatePaused(
    id: string,
    userId: string,
    deps: Partial<MetaAdsDraftDaoDeps> = {},
    createAttemptId: string = randomUUID()
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    return d.claimCreatePaused(id, uid, createAttemptId);
  }

  /**
   * Persist create-paused progress bound to an active creating attempt (W2.5.1).
   * Atomic: id + userId + status=creating + create_attempt_id must match.
   * Returns null on ownership conflict (stale worker must stop).
   * Never clears Meta ids unless the patch explicitly sets them.
   */
  static async persistCreatePausedProgress(
    id: string,
    userId: string,
    patch: {
      /** Required — binds the write to this attempt. */
      createAttemptId: string;
      status?: MetaAdsDraftStatus;
      lastErrorCode?: string | null;
      lastErrorMessage?: string | null;
      metaCampaignId?: string | null;
      metaAdsetId?: string | null;
      metaCreativeId?: string | null;
      metaAdId?: string | null;
      createdOnMetaAt?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    const attemptId = String(patch.createAttemptId || "").trim();
    if (!attemptId) {
      throw new MetaAdsDraftValidationError(
        "invalid_status",
        "createAttemptId is required for create-paused progress writes."
      );
    }

    const existing = await d.selectByIdForUser(id, uid);
    if (!existing) return null;

    if (existing.status !== "creating") {
      return null;
    }
    if (String(existing.createAttemptId || "") !== attemptId) {
      return null;
    }

    const nextStatus = patch.status ?? (existing.status as MetaAdsDraftStatus);
    if (patch.status) {
      assertValidStatusTransition(
        existing.status as MetaAdsDraftStatus,
        patch.status
      );
    }

    const metaIds = {
      metaCampaignId:
        patch.metaCampaignId !== undefined
          ? patch.metaCampaignId
          : existing.metaCampaignId,
      metaAdsetId:
        patch.metaAdsetId !== undefined
          ? patch.metaAdsetId
          : existing.metaAdsetId,
      metaCreativeId:
        patch.metaCreativeId !== undefined
          ? patch.metaCreativeId
          : existing.metaCreativeId,
      metaAdId:
        patch.metaAdId !== undefined ? patch.metaAdId : existing.metaAdId,
    };
    assertNoFabricatedMetaIdsForStatus(nextStatus, metaIds);

    const values: Record<string, unknown> = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.lastErrorCode !== undefined)
      values.lastErrorCode = patch.lastErrorCode;
    if (patch.lastErrorMessage !== undefined)
      values.lastErrorMessage = patch.lastErrorMessage;
    if (patch.metaCampaignId !== undefined)
      values.metaCampaignId = patch.metaCampaignId;
    if (patch.metaAdsetId !== undefined) values.metaAdsetId = patch.metaAdsetId;
    if (patch.metaCreativeId !== undefined)
      values.metaCreativeId = patch.metaCreativeId;
    if (patch.metaAdId !== undefined) values.metaAdId = patch.metaAdId;
    if (patch.createdOnMetaAt !== undefined)
      values.createdOnMetaAt = patch.createdOnMetaAt;
    if (patch.metadata !== undefined) values.metadata = patch.metadata ?? {};

    return d.updateCreatingAttempt(id, uid, attemptId, values);
  }

  /**
   * Atomically take over a stale creating attempt (lease already verified by caller).
   * Preserves Meta ids; replaces create_attempt_id.
   */
  static async reclaimStaleCreatingAttempt(
    id: string,
    userId: string,
    previousAttemptId: string,
    nextAttemptId: string,
    metadata: Record<string, unknown>,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    const prev = String(previousAttemptId || "").trim();
    const next = String(nextAttemptId || "").trim();
    if (!prev || !next) return null;
    return d.reclaimCreatingAttempt(id, uid, prev, next, {
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata,
    });
  }

  /**
   * Operator / resume path for partial_failure rows (not creating).
   * Used after uncertain-image resolution — does not require creating+attempt.
   * Still ownership-scoped to userId + id.
   */
  static async persistPartialFailureResolution(
    id: string,
    userId: string,
    patch: {
      lastErrorCode?: string | null;
      lastErrorMessage?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: MetaAdsDraftStatus;
    },
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    const existing = await d.selectByIdForUser(id, uid);
    if (!existing) return null;
    if (existing.status !== "partial_failure" && existing.status !== "failed") {
      return null;
    }
    const nextStatus = patch.status ?? (existing.status as MetaAdsDraftStatus);
    if (patch.status) {
      assertValidStatusTransition(
        existing.status as MetaAdsDraftStatus,
        patch.status
      );
    }
    assertNoFabricatedMetaIdsForStatus(nextStatus, {
      metaCampaignId: existing.metaCampaignId,
      metaAdsetId: existing.metaAdsetId,
      metaCreativeId: existing.metaCreativeId,
      metaAdId: existing.metaAdId,
    });
    const values: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.lastErrorCode !== undefined)
      values.lastErrorCode = patch.lastErrorCode;
    if (patch.lastErrorMessage !== undefined)
      values.lastErrorMessage = patch.lastErrorMessage;
    if (patch.metadata !== undefined) values.metadata = patch.metadata ?? {};
    return d.updateDraft(id, uid, values);
  }

  static async findByIdForUser(
    id: string,
    userId: string,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    return d.selectByIdForUser(id, uid);
  }

  static async listByUser(
    userId: string,
    limit = 50,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow[]> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    return d.selectByUser(uid, limit);
  }

  static async updateForUser(
    id: string,
    userId: string,
    patch: MetaAdsDraftUpdateInput,
    deps: Partial<MetaAdsDraftDaoDeps> = {}
  ): Promise<MetaAdsDraftRow | null> {
    const d = { ...defaultDeps, ...deps };
    const uid = requireUserId(userId);
    const existing = await d.selectByIdForUser(id, uid);
    if (!existing) return null;

    if (!isMetaAdsDraftStatus(existing.status)) {
      throw new MetaAdsDraftValidationError(
        "invalid_status",
        `Stored draft status "${existing.status}" is invalid.`
      );
    }

    const nextStatus = patch.status ?? (existing.status as MetaAdsDraftStatus);
    if (patch.status) {
      assertValidStatusTransition(existing.status as MetaAdsDraftStatus, patch.status);
    }

    const metaIds = {
      metaCampaignId:
        patch.metaCampaignId !== undefined
          ? patch.metaCampaignId
          : existing.metaCampaignId,
      metaAdsetId:
        patch.metaAdsetId !== undefined ? patch.metaAdsetId : existing.metaAdsetId,
      metaCreativeId:
        patch.metaCreativeId !== undefined
          ? patch.metaCreativeId
          : existing.metaCreativeId,
      metaAdId: patch.metaAdId !== undefined ? patch.metaAdId : existing.metaAdId,
    };
    assertNoFabricatedMetaIdsForStatus(nextStatus, metaIds);

    assertFirstReleaseDraftFields({
      objective: patch.objective !== undefined ? patch.objective : existing.objective,
      callToAction:
        patch.callToAction !== undefined
          ? patch.callToAction
          : existing.callToAction,
      destinationUrl:
        patch.destinationUrl !== undefined
          ? patch.destinationUrl
          : existing.destinationUrl,
      targeting:
        patch.targeting !== undefined ? patch.targeting : existing.targeting,
      placements:
        patch.placements !== undefined ? patch.placements : existing.placements,
      scheduleStart:
        patch.scheduleStart !== undefined
          ? patch.scheduleStart
          : existing.scheduleStart,
      scheduleEnd:
        patch.scheduleEnd !== undefined
          ? patch.scheduleEnd
          : existing.scheduleEnd,
    });

    // Client cannot change ownership / account binding silently via update.
    // Re-stamp currency only if we ever support account switch (not in W2.0).

    const values: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.name !== undefined) values.name = patch.name;
    if (patch.objective !== undefined) values.objective = patch.objective;
    if (patch.dailyBudgetMajor !== undefined) {
      values.dailyBudgetMajor = budgetToStorage(patch.dailyBudgetMajor);
    }
    if (patch.scheduleStart !== undefined) values.scheduleStart = patch.scheduleStart;
    if (patch.scheduleEnd !== undefined) values.scheduleEnd = patch.scheduleEnd;
    if (patch.targeting !== undefined) values.targeting = patch.targeting ?? {};
    if (patch.placements !== undefined) values.placements = patch.placements ?? {};
    if (patch.primaryText !== undefined) values.primaryText = patch.primaryText;
    if (patch.headline !== undefined) values.headline = patch.headline;
    if (patch.destinationUrl !== undefined)
      values.destinationUrl = patch.destinationUrl;
    if (patch.callToAction !== undefined) values.callToAction = patch.callToAction;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.lastErrorCode !== undefined) values.lastErrorCode = patch.lastErrorCode;
    if (patch.lastErrorMessage !== undefined)
      values.lastErrorMessage = patch.lastErrorMessage;
    if (patch.idempotencyKey !== undefined)
      values.idempotencyKey = patch.idempotencyKey;
    if (patch.createAttemptId !== undefined)
      values.createAttemptId = patch.createAttemptId;
    if (patch.metaCampaignId !== undefined)
      values.metaCampaignId = patch.metaCampaignId;
    if (patch.metaAdsetId !== undefined) values.metaAdsetId = patch.metaAdsetId;
    if (patch.metaCreativeId !== undefined)
      values.metaCreativeId = patch.metaCreativeId;
    if (patch.metaAdId !== undefined) values.metaAdId = patch.metaAdId;
    if (patch.createdOnMetaAt !== undefined)
      values.createdOnMetaAt = patch.createdOnMetaAt;

    // Archive-only: do not re-resolve creative (status transition alone).
    const archiveOnly =
      patch.status === "archived" &&
      patch.sourceImageId === undefined &&
      patch.sourceImageUrl === undefined &&
      patch.name === undefined &&
      patch.objective === undefined &&
      patch.dailyBudgetMajor === undefined &&
      patch.primaryText === undefined &&
      patch.headline === undefined &&
      patch.destinationUrl === undefined &&
      patch.callToAction === undefined &&
      patch.targeting === undefined &&
      patch.placements === undefined &&
      patch.scheduleStart === undefined &&
      patch.scheduleEnd === undefined &&
      patch.metadata === undefined;

    if (!archiveOnly) {
      const clearingCreative =
        patch.sourceImageId === null &&
        (patch.sourceImageUrl === null || patch.sourceImageUrl === undefined);

      if (clearingCreative) {
        values.sourceImageId = null;
        values.sourceImageUrl = null;
        const baseMeta =
          patch.metadata !== undefined
            ? patch.metadata
            : ((existing.metadata as Record<string, unknown>) ?? {});
        values.metadata = mergeCreativeMetadata(baseMeta, null);
      } else {
        const idForResolve =
          patch.sourceImageId !== undefined
            ? patch.sourceImageId
            : existing.sourceImageId;
        const urlHint =
          patch.sourceImageUrl !== undefined ? patch.sourceImageUrl : null;
        // Re-validate existing creative on content edits so deleted assets block save.
        if (idForResolve || urlHint) {
          const creative = await resolveMetaAdsCreativeAsset({
            userId: uid,
            sourceImageId: idForResolve,
            sourceImageUrl: urlHint,
            deps: { getByIdForUser: d.getGeneratedImageByIdForUser },
          });
          values.sourceImageId = creative?.sourceImageId ?? null;
          values.sourceImageUrl = creative?.sourceImageUrl ?? null;
          const baseMeta =
            patch.metadata !== undefined
              ? patch.metadata
              : ((existing.metadata as Record<string, unknown>) ?? {});
          values.metadata = mergeCreativeMetadata(baseMeta, creative);
        } else if (patch.metadata !== undefined) {
          values.metadata = patch.metadata ?? {};
        }
      }
    } else if (patch.metadata !== undefined) {
      values.metadata = patch.metadata ?? {};
    }

    // Never accept client currency overrides on update
    if ((patch as { currency?: unknown }).currency !== undefined) {
      throw new MetaAdsDraftValidationError(
        "missing_currency",
        "Draft currency is stamped from the selected ad account and cannot be overridden."
      );
    }

    return d.updateDraft(id, uid, values);
  }
}
