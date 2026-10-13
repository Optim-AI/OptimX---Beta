/**
 * Meta Ads draft HTTP helpers + route contracts (PR W2.1).
 * Run: npx --yes tsx lib/ads/meta/draft-api.w21.test.ts
 *
 * No live Meta Graph calls. Handlers exercise auth/entitlement via mocks.
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import type { NextApiResponse } from "next";
import {
  META_ADS_DRAFT_MAX_BODY_BYTES,
  assertBodySize,
  assertDraftEditable,
  assertMetaAdsCreateEntitled,
  assertNoForbiddenClientFields,
  MetaAdsDraftApiError,
  pickDraftContentFields,
  sendMetaAdsDraftError,
  serializeMetaAdsDraft,
} from "@/lib/ads/meta/draft-api";
import { decideMetaAdsCreateAccess } from "@/lib/ads/meta/create-access";
import { resolveTrustedMetaDraftBinding } from "@/lib/ads/meta/resolve-draft-binding";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";

type MockRes = NextApiResponse & {
  statusCode: number;
  body: unknown;
};

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as MockRes;
}

// --- helpers ---
{
  assert.throws(
    () =>
      assertBodySize({
        headers: { "content-length": String(META_ADS_DRAFT_MAX_BODY_BYTES + 1) },
      }),
    (e: unknown) =>
      e instanceof MetaAdsDraftApiError && e.code === "body_too_large"
  );
}

{
  assert.throws(
    () => assertNoForbiddenClientFields({ metaCampaignId: "x" }),
    (e: unknown) =>
      e instanceof MetaAdsDraftApiError && e.code === "meta_ids_not_allowed"
  );
  assert.throws(
    () => assertNoForbiddenClientFields({ status: "created_paused" }),
    (e: unknown) => e instanceof MetaAdsDraftApiError
  );
  assert.throws(
    () => assertNoForbiddenClientFields({ currency: "USD" }),
    (e: unknown) => e instanceof MetaAdsDraftApiError
  );
  assert.throws(
    () => assertNoForbiddenClientFields({ userId: "other" }),
    (e: unknown) => e instanceof MetaAdsDraftApiError
  );
  assert.doesNotThrow(() =>
    assertNoForbiddenClientFields({ name: "ok", dailyBudgetMajor: 10 })
  );
}

{
  assert.doesNotThrow(() => assertDraftEditable("draft"));
  assert.doesNotThrow(() => assertDraftEditable("failed"));
  assert.throws(
    () => assertDraftEditable("creating"),
    (e: unknown) =>
      e instanceof MetaAdsDraftApiError &&
      e.code === "invalid_status_transition"
  );
  assert.throws(() => assertDraftEditable("archived"), (e: unknown) =>
    e instanceof MetaAdsDraftApiError
  );
}

{
  const prev = process.env.META_ADS_CREATE_ENABLED;
  delete process.env.META_ADS_CREATE_ENABLED;
  assert.throws(
    () => assertMetaAdsCreateEntitled("u1"),
    (e: unknown) =>
      e instanceof MetaAdsDraftApiError && e.code === "not_entitled" && e.httpStatus === 403
  );
  process.env.META_ADS_CREATE_ENABLED = "true";
  assert.doesNotThrow(() => assertMetaAdsCreateEntitled("u1"));
  if (prev === undefined) delete process.env.META_ADS_CREATE_ENABLED;
  else process.env.META_ADS_CREATE_ENABLED = prev;
}

{
  const serialized = serializeMetaAdsDraft({
    id: "d1",
    userId: "u1",
    integrationId: "i1",
    adAccountId: "a1",
    status: "draft",
    name: "n",
    objective: null,
    dailyBudgetMajor: "10",
    currency: "USD",
    scheduleStart: null,
    scheduleEnd: null,
    targeting: {},
    placements: {},
    sourceImageId: null,
    sourceImageUrl: null,
    primaryText: null,
    headline: null,
    destinationUrl: null,
    callToAction: null,
    metaCampaignId: null,
    metaAdsetId: null,
    metaCreativeId: null,
    metaAdId: null,
    idempotencyKey: "k",
    createAttemptId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: "t",
    updatedAt: "t",
    createdOnMetaAt: null,
    metadata: {},
  } as any);
  assert.strictEqual(serialized.onMeta, false);
  assert.ok(!("accessToken" in serialized));
  assert.ok(!("userId" in serialized));
}

{
  const fields = pickDraftContentFields({
    name: "x",
    metaCampaignId: "should-not-appear-in-pick",
  } as any);
  assert.strictEqual(fields.name, "x");
  assert.ok(!("metaCampaignId" in fields));
}

{
  const res = mockRes();
  sendMetaAdsDraftError(
    res,
    new MetaAdsDraftValidationError("account_not_selected", "no account")
  );
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, {
    ok: false,
    error: "account_not_selected",
    message: "no account",
  });
}

{
  const res = mockRes();
  sendMetaAdsDraftError(res, new Error("boom secret stack"));
  assert.strictEqual(res.statusCode, 500);
  const body = res.body as { error: string; message: string };
  assert.strictEqual(body.error, "server_error");
  assert.ok(!String(body.message).includes("boom"));
}

async function main() {
  // --- resolveTrustedMetaDraftBinding ---
  await assert.rejects(
    () =>
      resolveTrustedMetaDraftBinding("u1", {
        findIntegrationByUserAndProvider: async () => null,
        findSelectedAdAccount: async () => null,
      }),
    (e: unknown) =>
      e instanceof MetaAdsDraftValidationError &&
      e.code === "integration_account_mismatch"
  );

  await assert.rejects(
    () =>
      resolveTrustedMetaDraftBinding("u1", {
        findIntegrationByUserAndProvider: async () =>
          ({
            id: "i1",
            userId: "u1",
            provider: "meta",
            healthStatus: "revoked",
          }) as any,
        findSelectedAdAccount: async () => null,
      }),
    (e: unknown) =>
      e instanceof MetaAdsDraftValidationError &&
      e.code === "integration_account_mismatch"
  );

  await assert.rejects(
    () =>
      resolveTrustedMetaDraftBinding("u1", {
        findIntegrationByUserAndProvider: async () =>
          ({
            id: "i1",
            userId: "u1",
            provider: "meta",
            healthStatus: "healthy",
          }) as any,
        findSelectedAdAccount: async () => null,
      }),
    (e: unknown) =>
      e instanceof MetaAdsDraftValidationError &&
      e.code === "account_not_selected"
  );

  const ok = await resolveTrustedMetaDraftBinding("u1", {
    findIntegrationByUserAndProvider: async () =>
      ({
        id: "i1",
        userId: "u1",
        provider: "meta",
        healthStatus: "healthy",
        pageId: "p1",
      }) as any,
    findSelectedAdAccount: async () =>
      ({
        id: "acct",
        accountId: "999",
        currency: "USD",
        isSelected: true,
      }) as any,
  });
  assert.strictEqual(ok.integration.id, "i1");
  assert.strictEqual(ok.selectedAccount.id, "acct");

  // --- route source contracts (no Graph, auth, entitlement) ---
  const routes = [
    "pages/api/ads/meta/preflight.ts",
    "pages/api/ads/meta/drafts/index.ts",
    "pages/api/ads/meta/drafts/[id].ts",
    "pages/api/ads/meta/drafts/[id]/archive.ts",
  ];
  for (const rel of routes) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.ok(src.includes("getUserIdFromRequest"), rel);
    assert.ok(!src.includes("graph.facebook.com"), rel);
    assert.ok(!src.includes("metaGraphPost"), rel);
    assert.ok(!src.includes("loadMetaAdsWriteContext"), rel);
    if (rel.includes("drafts")) {
      assert.ok(src.includes("assertMetaAdsCreateEntitled"), rel);
    }
    assert.ok(!/\baccessToken\b/.test(src), `${rel} must not mention accessToken`);
  }

  const draftCreate = fs.readFileSync(
    path.join(process.cwd(), "pages/api/ads/meta/drafts/index.ts"),
    "utf8"
  );
  assert.ok(draftCreate.includes("resolveTrustedMetaDraftBinding"));
  assert.ok(draftCreate.includes("createIdempotent"));
  assert.ok(!draftCreate.includes("req.body.userId"));
  assert.ok(!draftCreate.includes("req.body.integrationId"));

  const preflight = fs.readFileSync(
    path.join(process.cwd(), "pages/api/ads/meta/preflight.ts"),
    "utf8"
  );
  assert.ok(preflight.includes("buildMetaAdsCreatePreflight"));
  assert.ok(preflight.includes("findSelected"));

  // Entitlement is independent of Analytics decision helper
  const access = decideMetaAdsCreateAccess("u", {});
  assert.strictEqual(access.entitled, false);

  console.log("draft-api.w21.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});