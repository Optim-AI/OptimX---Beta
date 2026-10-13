/**
 * Meta Ads creative ownership + URL stamping (PR W2.3C).
 * Run: npx --yes tsx lib/ads/meta/resolve-creative-asset.test.ts
 */
import assert from "assert";
import {
  mergeCreativeMetadata,
  resolveMetaAdsCreativeAsset,
} from "@/lib/ads/meta/resolve-creative-asset";
import { assessMetaAdsCreativeUrl } from "@/lib/ads/meta/creative-url-safety";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import { MetaAdsDraftDAO } from "@/database/models/MetaAdsDraft.dao";
import type { MetaAdsDraftDaoDeps } from "@/database/models/MetaAdsDraft.dao";

const USER = "user-aaa";
const OTHER = "user-bbb";
const IMG = "11111111-1111-4111-8111-111111111111";
const PUBLIC_URL =
  "https://xyzcompany.supabase.co/storage/v1/object/public/campaign-assets/poster-generation/user-aaa/s/g.jpg";
const LOCAL_URL =
  "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/user-aaa/s/g.jpg";

function imageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IMG,
    userId: USER,
    imageUrl: PUBLIC_URL,
    imagePath: "poster-generation/user-aaa/s/g.jpg",
    mediaType: "image",
    source: "poster-generation",
    metadata: {},
    ...overrides,
  } as any;
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
  // URL assessment
  {
    const ok = assessMetaAdsCreativeUrl(PUBLIC_URL);
    assert.strictEqual(ok.metaFetchableViaUrl, true);
    assert.strictEqual(ok.strategy, "meta_url");

    const local = assessMetaAdsCreativeUrl(LOCAL_URL);
    assert.strictEqual(local.metaFetchableViaUrl, false);
    assert.strictEqual(local.strategy, "multipart_local");

    const signed = assessMetaAdsCreativeUrl(
      "https://xyzcompany.supabase.co/storage/v1/object/sign/campaign-assets/x.jpg?token=abc"
    );
    assert.strictEqual(signed.metaFetchableViaUrl, false);

    const priv = assessMetaAdsCreativeUrl("https://192.168.1.10/img.jpg");
    assert.ok(priv.warnings.length > 0 || priv.strategy === "meta_url");
    // literal private IP host → warning
    assert.ok(
      priv.warnings.some((w) => /private|loopback/i.test(w)) ||
        !priv.metaFetchableViaUrl
    );
  }

  // Valid owned image
  {
    const resolved = await resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      sourceImageUrl: PUBLIC_URL,
      deps: { getByIdForUser: async () => imageRow() },
    });
    assert.ok(resolved);
    assert.strictEqual(resolved!.sourceImageId, IMG);
    assert.strictEqual(resolved!.sourceImageUrl, PUBLIC_URL);
    assert.strictEqual(resolved!.metaFetchableViaUrl, true);
    assert.strictEqual(resolved!.storagePath, "poster-generation/user-aaa/s/g.jpg");
  }

  // Client URL ignored when omitted; stamp from row
  {
    const resolved = await resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      sourceImageUrl: null,
      deps: { getByIdForUser: async () => imageRow() },
    });
    assert.strictEqual(resolved!.sourceImageUrl, PUBLIC_URL);
  }

  // Nonexistent / other user
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      deps: { getByIdForUser: async () => null },
    }),
    "creative_not_found"
  );

  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: OTHER,
      sourceImageId: IMG,
      deps: {
        getByIdForUser: async (id, uid) =>
          uid === USER ? imageRow() : null,
      },
    }),
    "creative_not_found"
  );

  // Non-image
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      deps: {
        getByIdForUser: async () => imageRow({ mediaType: "video" }),
      },
    }),
    "creative_not_image"
  );

  // Malformed id
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: "not-a-uuid",
      deps: { getByIdForUser: async () => imageRow() },
    }),
    "invalid_creative_id"
  );

  // URL without id
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: null,
      sourceImageUrl: "https://evil.example/x.jpg",
      deps: { getByIdForUser: async () => imageRow() },
    }),
    "creative_id_required"
  );

  // Client URL mismatch
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      sourceImageUrl: "https://evil.example/hijack.jpg",
      deps: { getByIdForUser: async () => imageRow() },
    }),
    "creative_url_mismatch"
  );

  // Localhost / arbitrary — accepted as stamp from row when ids match library local URL
  {
    const resolved = await resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      sourceImageUrl: LOCAL_URL,
      deps: {
        getByIdForUser: async () => imageRow({ imageUrl: LOCAL_URL }),
      },
    });
    assert.strictEqual(resolved!.sourceImageUrl, LOCAL_URL);
    assert.strictEqual(resolved!.metaFetchableViaUrl, false);
  }

  // Empty canonical URL
  await expectCode(
    resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: IMG,
      deps: {
        getByIdForUser: async () =>
          imageRow({ imageUrl: null, imagePath: null }),
      },
    }),
    "creative_url_unavailable"
  );

  // clear
  {
    const cleared = await resolveMetaAdsCreativeAsset({
      userId: USER,
      sourceImageId: null,
      sourceImageUrl: null,
      deps: { getByIdForUser: async () => imageRow() },
    });
    assert.strictEqual(cleared, null);
    assert.deepStrictEqual(mergeCreativeMetadata({ creative: { x: 1 } }, null), {});
  }

  // DAO stamps creative; rejects foreign asset
  {
    const rows = new Map<string, any>();
    const images = new Map<string, any>([[IMG, imageRow()]]);
    const deps: MetaAdsDraftDaoDeps = {
      findIntegrationById: async () =>
        ({ id: "integ-1", userId: USER, provider: "meta" }) as any,
      findAdAccountById: async () =>
        ({
          id: "acct-1",
          integrationId: "integ-1",
          accountId: "123",
          provider: "meta",
          currency: "USD",
          isSelected: true,
        }) as any,
      insertDraft: async (values) => {
        const row = { ...values } as any;
        rows.set(row.id, row);
        return row;
      },
      updateDraft: async (id, userId, values) => {
        const prev = rows.get(id);
        if (!prev || prev.userId !== userId) return null;
        const next = { ...prev, ...values };
        rows.set(id, next);
        return next;
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
        return next;
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
        return next;
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
        if (String(prev.createAttemptId || "") !== previousAttemptId)
          return null;
        const next = {
          ...prev,
          ...values,
          status: "creating",
          createAttemptId: nextAttemptId,
          updatedAt: new Date().toISOString(),
        };
        rows.set(id, next);
        return next;
      },
      selectByIdForUser: async (id, userId) => {
        const row = rows.get(id);
        if (!row || row.userId !== userId) return null;
        return row;
      },
      selectByUser: async (userId) =>
        [...rows.values()].filter((r) => r.userId === userId),
      selectByIdempotencyKey: async () => null,
      getGeneratedImageByIdForUser: async (id, userId) => {
        const row = images.get(id);
        if (!row || row.userId !== userId) return null;
        return row;
      },
    };

    const created = await MetaAdsDraftDAO.create(
      {
        userId: USER,
        integrationId: "integ-1",
        adAccountId: "acct-1",
        sourceImageId: IMG,
        sourceImageUrl: "https://evil.example/nope.jpg",
      },
      deps
    ).catch((e) => e);
    assert.ok(created instanceof MetaAdsDraftValidationError);
    assert.strictEqual(created.code, "creative_url_mismatch");

    const ok = await MetaAdsDraftDAO.create(
      {
        userId: USER,
        integrationId: "integ-1",
        adAccountId: "acct-1",
        sourceImageId: IMG,
        sourceImageUrl: PUBLIC_URL,
        idempotencyKey: "c1",
      },
      deps
    );
    assert.strictEqual(ok.sourceImageUrl, PUBLIC_URL);
    assert.ok((ok.metadata as any)?.creative?.metaFetchableViaUrl === true);

    // Edit with deleted asset
    images.delete(IMG);
    await expectCode(
      MetaAdsDraftDAO.updateForUser(
        ok.id,
        USER,
        { name: "renamed" },
        deps
      ),
      "creative_not_found"
    );

    // Archive still works without creative re-resolve
    images.set(IMG, imageRow());
    const archived = await MetaAdsDraftDAO.archiveForUser(ok.id, USER, deps);
    assert.strictEqual(archived!.status, "archived");
  }

  console.log("resolve-creative-asset.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
