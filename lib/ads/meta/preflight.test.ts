/**
 * Meta Ads create preflight (PR W2.1).
 * Run: npx --yes tsx lib/ads/meta/preflight.test.ts
 */
import assert from "assert";
import { buildMetaAdsCreatePreflight } from "@/lib/ads/meta/preflight";

const USER = "user-1";
const envOn = { META_ADS_CREATE_ENABLED: "true" };

function base() {
  return {
    userId: USER,
    integration: {
      id: "integ-1",
      healthStatus: "healthy",
      pageId: "page-99",
    },
    selectedAccount: {
      id: "acct-row",
      accountId: "123456",
      name: "Acme",
      currency: "INR",
    },
    env: envOn,
  };
}

{
  const p = buildMetaAdsCreatePreflight(base());
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.canCreateLocalDraft, true);
  assert.strictEqual(p.canCreateOnMeta, true);
  assert.strictEqual(p.entitled.entitled, true);
  assert.strictEqual(p.integration.healthy, true);
  assert.strictEqual(p.selectedAccount.currency, "INR");
  assert.strictEqual(p.selectedAccount.currencySupported, true);
  assert.strictEqual(p.selectedAccount.currencyOffset, 100);
  assert.strictEqual(p.blockers.length, 0);
  assert.ok(!("accessToken" in (p.integration as object)));
}

{
  const p = buildMetaAdsCreatePreflight({
    ...base(),
    env: {},
  });
  assert.strictEqual(p.canCreateLocalDraft, false);
  assert.ok(p.blockers.some((b) => b.code === "not_entitled"));
}

{
  const p = buildMetaAdsCreatePreflight({
    ...base(),
    integration: null,
    selectedAccount: null,
  });
  assert.strictEqual(p.canCreateLocalDraft, false);
  assert.ok(p.blockers.some((b) => b.code === "no_integration"));
  assert.ok(p.blockers.some((b) => b.code === "no_selected_account"));
}

{
  const p = buildMetaAdsCreatePreflight({
    ...base(),
    integration: {
      id: "integ-1",
      healthStatus: "expired",
      pageId: "page-99",
    },
  });
  assert.strictEqual(p.integration.healthy, false);
  assert.ok(p.blockers.some((b) => b.code === "integration_disconnected"));
  assert.strictEqual(p.canCreateLocalDraft, false);
}

{
  const p = buildMetaAdsCreatePreflight({
    ...base(),
    selectedAccount: {
      id: "acct-row",
      accountId: "123",
      name: "X",
      currency: "KWD",
    },
  });
  assert.strictEqual(p.selectedAccount.currencySupported, false);
  assert.ok(p.blockers.some((b) => b.code === "unverified_currency"));
}

{
  const p = buildMetaAdsCreatePreflight({
    ...base(),
    integration: {
      id: "integ-1",
      healthStatus: "healthy",
      pageId: null,
    },
  });
  assert.strictEqual(p.canCreateLocalDraft, true);
  assert.strictEqual(p.canCreateOnMeta, false);
  assert.ok(p.blockers.some((b) => b.code === "page_not_bound"));
}

{
  const p = buildMetaAdsCreatePreflight(base());
  // Must not claim Meta campaign was created
  assert.ok(!("metaCampaignId" in p));
  assert.ok(!("campaignCreated" in p));
}

console.log("preflight.test.ts: ok");
