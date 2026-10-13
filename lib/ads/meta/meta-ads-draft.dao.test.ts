/**
 * Meta Ads draft DAO + validation (PR W2.0) — mocked deps, no Graph/DB.
 * Run: npx --yes tsx lib/ads/meta/meta-ads-draft.dao.test.ts
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { MetaAdsDraftDAO } from "@/database/models/MetaAdsDraft.dao";
import type { MetaAdsDraftDaoDeps } from "@/database/models/MetaAdsDraft.dao";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import {
  assertNoFabricatedMetaIdsForStatus,
  stampVerifiedDraftCurrency,
} from "@/lib/ads/meta/draft-validation";

const USER = "user-aaa";
const OTHER = "user-bbb";
const INTEG = "integ-1";
const ACCT = "acct-row-1";

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: INTEG,
    userId: USER,
    provider: "meta",
    accessToken: "should-never-be-copied-to-draft",
    ...overrides,
  } as any;
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCT,
    integrationId: INTEG,
    accountId: "123",
    provider: "meta",
    currency: "INR",
    isSelected: true,
    ...overrides,
  } as any;
}

function memStore() {
  const rows = new Map<string, any>();
  const deps: MetaAdsDraftDaoDeps = {
    findIntegrationById: async (id) =>
      id === INTEG ? integration() : null,
    findAdAccountById: async (id) => (id === ACCT ? account() : null),
    insertDraft: async (values) => {
      const row = { ...values } as { id: string; userId: string; [k: string]: unknown };
      rows.set(String(row.id), row);
      return row as any;
    },
    updateDraft: async (id, userId, values) => {
      const prev = rows.get(id);
      if (!prev || prev.userId !== userId) return null;
      const next = { ...prev, ...values };
      rows.set(id, next);
      return next as any;
    },
    claimCreatePaused: async (id, userId, createAttemptId) => {
      const prev = rows.get(id);
      if (!prev || prev.userId !== userId) return null;
      if (!["draft", "failed", "partial_failure"].includes(prev.status)) {
        return null;
      }
      const next = {
        ...prev,
        status: "creating",
        createAttemptId,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
      rows.set(id, next);
      return next as any;
    },
    updateCreatingAttempt: async (id, userId, createAttemptId, values) => {
      const prev = rows.get(id);
      if (!prev || prev.userId !== userId) return null;
      if (prev.status !== "creating") return null;
      if (String(prev.createAttemptId || "") !== createAttemptId) return null;
      const next = {
        ...prev,
        ...values,
        createAttemptId,
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, next);
      return next as any;
    },
    reclaimCreatingAttempt: async (
      id,
      userId,
      previousAttemptId,
      nextAttemptId,
      values
    ) => {
      const prev = rows.get(id);
      if (!prev || prev.userId !== userId) return null;
      if (prev.status !== "creating") return null;
      if (String(prev.createAttemptId || "") !== previousAttemptId) return null;
      const next = {
        ...prev,
        ...values,
        status: "creating",
        createAttemptId: nextAttemptId,
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, next);
      return next as any;
    },
    selectByIdForUser: async (id, userId) => {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return null;
      return row as any;
    },
    selectByUser: async (userId) =>
      [...rows.values()].filter((r) => r.userId === userId) as any,
    selectByIdempotencyKey: async (userId, key) => {
      for (const row of rows.values()) {
        if (row.userId === userId && row.idempotencyKey === key) return row as any;
      }
      return null;
    },
    getGeneratedImageByIdForUser: async () => null,
  };
  return { rows, deps };
}

async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
    throw new Error(`expected ${code}`);
  } catch (e) {
    assert.ok(e instanceof MetaAdsDraftValidationError, String(e));
    assert.strictEqual(e.code, code);
  }
}

async function main() {
  // Schema / migration consistency markers
  {
    const mig = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20261013160000_meta_ads_drafts.sql"
      ),
      "utf8"
    );
    assert.ok(mig.includes("CREATE TABLE IF NOT EXISTS public.meta_ads_drafts"));
    assert.ok(mig.includes("ENABLE ROW LEVEL SECURITY"));
    assert.ok(mig.includes("meta_ads_drafts_select_own"));
    assert.ok(mig.includes("meta_ads_drafts_meta_ids_local_status_check"));
    assert.ok(!mig.includes("access_token"));

    const schema = fs.readFileSync(
      path.join(process.cwd(), "database/schema.ts"),
      "utf8"
    );
    assert.ok(schema.includes('pgTable("meta_ads_drafts"'));
  }

  // Pure validators
  assert.strictEqual(stampVerifiedDraftCurrency("inr"), "INR");
  {
    let threw = false;
    try {
      stampVerifiedDraftCurrency("KWD");
    } catch (e) {
      threw = true;
      assert.strictEqual(
        (e as MetaAdsDraftValidationError).code,
        "unverified_currency"
      );
    }
    assert.ok(threw);
  }
  {
    let threw = false;
    try {
      assertNoFabricatedMetaIdsForStatus("draft", {
        metaCampaignId: "camp_1",
      });
    } catch (e) {
      threw = true;
      assert.strictEqual(
        (e as MetaAdsDraftValidationError).code,
        "meta_ids_not_allowed"
      );
    }
    assert.ok(threw);
  }
  assertNoFabricatedMetaIdsForStatus("created_paused", {
    metaCampaignId: "camp_1",
  });

  // Create + retrieve
  {
    const { deps, rows } = memStore();
    const created = await MetaAdsDraftDAO.create(
      {
        userId: USER,
        integrationId: INTEG,
        adAccountId: ACCT,
        name: "Test",
        objective: "OUTCOME_TRAFFIC",
        dailyBudgetMajor: "10.50",
        primaryText: "Hello",
      },
      deps
    );
    assert.strictEqual(created.status, "draft");
    assert.strictEqual(created.currency, "INR");
    assert.strictEqual(created.userId, USER);
    assert.strictEqual(created.metaCampaignId, null);
    assert.ok(!JSON.stringify(created).includes("should-never-be-copied"));

    const found = await MetaAdsDraftDAO.findByIdForUser(
      created.id,
      USER,
      deps
    );
    assert.ok(found);
    assert.strictEqual(found!.name, "Test");

    // Cross-user access rejected
    const other = await MetaAdsDraftDAO.findByIdForUser(
      created.id,
      OTHER,
      deps
    );
    assert.strictEqual(other, null);

    const listed = await MetaAdsDraftDAO.listByUser(OTHER, 10, deps);
    assert.strictEqual(listed.length, 0);
    assert.strictEqual(rows.size, 1);
  }

  // Unauthenticated
  {
    const { deps } = memStore();
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: "", integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "unauthenticated"
    );
  }

  // Integration belonging to another user
  {
    const { deps } = memStore();
    deps.findIntegrationById = async () => integration({ userId: OTHER });
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: USER, integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "integration_owner_mismatch"
    );
  }

  // Account / integration mismatch
  {
    const { deps } = memStore();
    deps.findAdAccountById = async () =>
      account({ integrationId: "other-integ" });
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: USER, integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "integration_account_mismatch"
    );
  }

  // Unselected account
  {
    const { deps } = memStore();
    deps.findAdAccountById = async () => account({ isSelected: false });
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: USER, integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "account_not_selected"
    );
  }

  // Unsupported / unverified currency from account
  {
    const { deps } = memStore();
    deps.findAdAccountById = async () => account({ currency: "KWD" });
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: USER, integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "unverified_currency"
    );
  }

  // Wrong provider
  {
    const { deps } = memStore();
    deps.findIntegrationById = async () =>
      integration({ provider: "meta-publish" });
    await expectCode(
      MetaAdsDraftDAO.create(
        { userId: USER, integrationId: INTEG, adAccountId: ACCT },
        deps
      ),
      "wrong_provider"
    );
  }

  // Fabricated Meta IDs on create
  {
    const { deps } = memStore();
    await expectCode(
      MetaAdsDraftDAO.create(
        {
          userId: USER,
          integrationId: INTEG,
          adAccountId: ACCT,
          metaCampaignId: "camp_fake",
        } as any,
        deps
      ),
      "meta_ids_not_allowed"
    );
  }

  // Status transition validation + Meta ids on local status
  {
    const { deps } = memStore();
    const created = await MetaAdsDraftDAO.create(
      { userId: USER, integrationId: INTEG, adAccountId: ACCT },
      deps
    );
    await expectCode(
      MetaAdsDraftDAO.updateForUser(
        created.id,
        USER,
        { status: "created_paused" },
        deps
      ),
      "invalid_status_transition"
    );

    await expectCode(
      MetaAdsDraftDAO.updateForUser(
        created.id,
        USER,
        { metaCampaignId: "camp_1" },
        deps
      ),
      "meta_ids_not_allowed"
    );

    // Valid path toward creating + attach ids
    const creating = await MetaAdsDraftDAO.updateForUser(
      created.id,
      USER,
      { status: "creating" },
      deps
    );
    assert.strictEqual(creating!.status, "creating");
    const withIds = await MetaAdsDraftDAO.updateForUser(
      created.id,
      USER,
      {
        status: "created_paused",
        metaCampaignId: "camp_1",
        metaAdsetId: "adset_1",
        createdOnMetaAt: new Date().toISOString(),
      },
      deps
    );
    assert.strictEqual(withIds!.status, "created_paused");
    assert.strictEqual(withIds!.metaCampaignId, "camp_1");
    assert.strictEqual(withIds!.metaAdsetId, "adset_1");
  }

  // Nullable Meta ids remain null for local drafts
  {
    const { deps } = memStore();
    const created = await MetaAdsDraftDAO.create(
      { userId: USER, integrationId: INTEG, adAccountId: ACCT },
      deps
    );
    assert.strictEqual(created.metaCampaignId, null);
    assert.strictEqual(created.metaAdsetId, null);
    assert.strictEqual(created.metaCreativeId, null);
    assert.strictEqual(created.metaAdId, null);
    assert.strictEqual(created.createdOnMetaAt, null);
  }

  // Currency stamp from account (USD), not client
  {
    const { deps } = memStore();
    deps.findAdAccountById = async () => account({ currency: "usd" });
    const created = await MetaAdsDraftDAO.create(
      {
        userId: USER,
        integrationId: INTEG,
        adAccountId: ACCT,
        dailyBudgetMajor: 25,
      },
      deps
    );
    assert.strictEqual(created.currency, "USD");
  }

  // Idempotency: repeated create returns same row
  {
    const { rows, deps } = memStore();
    const a = await MetaAdsDraftDAO.createIdempotent(
      {
        userId: USER,
        integrationId: INTEG,
        adAccountId: ACCT,
        name: "first",
        idempotencyKey: "idem-1",
      },
      deps
    );
    assert.strictEqual(a.created, true);
    const b = await MetaAdsDraftDAO.createIdempotent(
      {
        userId: USER,
        integrationId: INTEG,
        adAccountId: ACCT,
        name: "second",
        idempotencyKey: "idem-1",
      },
      deps
    );
    assert.strictEqual(b.created, false);
    assert.strictEqual(b.draft.id, a.draft.id);
    assert.strictEqual(b.draft.name, "first");
    assert.strictEqual(rows.size, 1);
  }

  // Concurrent race: unique violation → return existing
  {
    const { rows, deps } = memStore();
    let inserts = 0;
    const origInsert = deps.insertDraft;
    deps.insertDraft = async (values) => {
      inserts += 1;
      if (inserts === 1) {
        // Simulate peer winning the race: row already present under same key
        const peer = {
          ...values,
          id: "peer-id",
          name: "peer-won",
        };
        rows.set("peer-id", peer);
        const err: any = new Error("duplicate key");
        err.code = "23505";
        throw err;
      }
      return origInsert(values);
    };
    const result = await MetaAdsDraftDAO.createIdempotent(
      {
        userId: USER,
        integrationId: INTEG,
        adAccountId: ACCT,
        idempotencyKey: "race-key",
      },
      deps
    );
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.draft.id, "peer-id");
    assert.strictEqual(result.draft.name, "peer-won");
  }

  // Archive transition (idempotent re-archive allowed as same-status)
  {
    const { deps } = memStore();
    const created = await MetaAdsDraftDAO.create(
      { userId: USER, integrationId: INTEG, adAccountId: ACCT },
      deps
    );
    const archived = await MetaAdsDraftDAO.archiveForUser(
      created.id,
      USER,
      deps
    );
    assert.strictEqual(archived!.status, "archived");
    const again = await MetaAdsDraftDAO.archiveForUser(created.id, USER, deps);
    assert.strictEqual(again!.status, "archived");
  }

  // Invalid transition: created_paused → creating
  {
    const { deps } = memStore();
    const created = await MetaAdsDraftDAO.create(
      { userId: USER, integrationId: INTEG, adAccountId: ACCT },
      deps
    );
    await MetaAdsDraftDAO.updateForUser(
      created.id,
      USER,
      { status: "creating" },
      deps
    );
    await MetaAdsDraftDAO.updateForUser(
      created.id,
      USER,
      {
        status: "created_paused",
        metaCampaignId: "c1",
        metaAdsetId: "a1",
      },
      deps
    );
    await expectCode(
      MetaAdsDraftDAO.updateForUser(
        created.id,
        USER,
        { status: "creating" },
        deps
      ),
      "invalid_status_transition"
    );
  }

  console.log("meta-ads-draft.dao.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
