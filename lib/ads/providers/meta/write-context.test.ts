/**
 * Meta Ads write-context safeguards.
 * Run: npx --yes tsx lib/ads/providers/meta/write-context.test.ts
 */
import assert from "assert";
import type { AdsProviderContext } from "@/lib/ads/providers/types";
import {
  MetaAdsWriteContextError,
  assertMetaAdsPageBoundForCreative,
  assertMetaAdsWriteProvider,
  resolveMetaAdsWriteContext,
} from "@/lib/ads/providers/meta/write-context";

function baseCtx(
  overrides: Partial<AdsProviderContext> & { provider?: string } = {}
): AdsProviderContext & { provider?: string } {
  return {
    userId: "user-1",
    integrationId: "int-1",
    accessToken: "tok",
    selectedAccountId: "123456789",
    accountCurrency: "INR",
    provider: "meta",
    ...overrides,
  };
}

{
  const w = resolveMetaAdsWriteContext(baseCtx());
  assert.strictEqual(w.provider, "meta");
  assert.strictEqual(w.accountExternalId, "123456789");
  assert.strictEqual(w.actId, "act_123456789");
  assert.strictEqual(w.currency, "INR");
  assert.strictEqual(w.currencyOffset, 100);
  assert.strictEqual(w.currencyExponent, 2);
}

{
  const w = resolveMetaAdsWriteContext(
    baseCtx({ selectedAccountId: "act_999", accountCurrency: "jpy" })
  );
  assert.strictEqual(w.accountExternalId, "999");
  assert.strictEqual(w.currency, "JPY");
  assert.strictEqual(w.currencyOffset, 1);
  assert.strictEqual(w.currencyExponent, 0);
}

{
  const w = resolveMetaAdsWriteContext(
    baseCtx({ accountCurrency: "IDR" })
  );
  assert.strictEqual(w.currencyOffset, 1);
  assert.strictEqual(w.currencyExponent, 0);
}

function expectCode(
  fn: () => void,
  code: MetaAdsWriteContextError["code"]
) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    assert.ok(e instanceof MetaAdsWriteContextError);
    assert.strictEqual((e as MetaAdsWriteContextError).code, code);
  }
  assert.ok(threw, `expected ${code}`);
}

expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ selectedAccountId: null })),
  "no_selected_account"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ selectedAccountId: "" })),
  "no_selected_account"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ accountCurrency: null })),
  "missing_currency"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ accountCurrency: "XXX" })),
  "unverified_currency"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ accountCurrency: "KWD" })),
  "unverified_currency"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ accessToken: "" })),
  "missing_user_access_token"
);

{
  const w = resolveMetaAdsWriteContext(baseCtx(), {
    pageId: "page-1",
    pageAccessToken: "PAGE_TOK",
  });
  assert.strictEqual(w.userAccessToken, "tok");
  assert.strictEqual(w.accessToken, "tok");
  assert.strictEqual(w.pageId, "page-1");
  assert.strictEqual(w.pageAccessToken, "PAGE_TOK");
}

{
  const unbound = resolveMetaAdsWriteContext(baseCtx(), { pageId: null });
  expectCode(
    () => assertMetaAdsPageBoundForCreative(unbound),
    "missing_page_binding"
  );
  const bound = resolveMetaAdsWriteContext(baseCtx(), { pageId: "p1" });
  assertMetaAdsPageBoundForCreative(bound);
}
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: "meta-publish" })),
  "organic_provider"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: "meta-instagram" })),
  "organic_provider"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: "google" })),
  "wrong_provider"
);

// Explicit provider required — no default to "meta"
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: undefined })),
  "missing_provider"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: null as any })),
  "missing_provider"
);
expectCode(
  () => resolveMetaAdsWriteContext(baseCtx({ provider: "  " })),
  "missing_provider"
);
{
  const { provider: _omit, ...rest } = baseCtx();
  expectCode(
    () => resolveMetaAdsWriteContext(rest as AdsProviderContext),
    "missing_provider"
  );
}

expectCode(() => assertMetaAdsWriteProvider("meta-publish"), "organic_provider");
expectCode(() => assertMetaAdsWriteProvider(undefined), "missing_provider");
expectCode(() => assertMetaAdsWriteProvider(null), "missing_provider");
assertMetaAdsWriteProvider("meta");

console.log("write-context.test.ts: ok");
