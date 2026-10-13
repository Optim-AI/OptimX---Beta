/**
 * Run: npx --yes tsx lib/ads/meta/create-paused-gates.test.ts
 */
import assert from "assert";
import {
  decideMetaAdsCreatePausedWriteAccess,
  isMetaAdImagesContractApproved,
  isMetaAdsCreatePausedGraphWritesEnabled,
} from "@/lib/ads/meta/create-paused-gates";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

{
  assert.strictEqual(
    isMetaAdImagesContractApproved({}),
    false,
    "adimages contract default denied"
  );
  assert.strictEqual(
    isMetaAdsCreatePausedGraphWritesEnabled({}),
    false,
    "graph writes default denied"
  );
}

{
  const r = decideMetaAdsCreatePausedWriteAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, "adimages_contract_unapproved");
}

{
  const r = decideMetaAdsCreatePausedWriteAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, "graph_writes_disabled");
}

{
  const r = decideMetaAdsCreatePausedWriteAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
    META_ADS_CREATE_PAUSED_GRAPH_WRITES: "true",
  });
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.code, "ok");
}

{
  const r = decideMetaAdsCreatePausedWriteAccess(USER, {
    META_ADS_CREATE_ENABLED: "false",
    META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
    META_ADS_CREATE_PAUSED_GRAPH_WRITES: "true",
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, "not_entitled");
}

{
  const r = decideMetaAdsCreatePausedWriteAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_CREATE_USER_ALLOWLIST: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
    META_ADS_CREATE_PAUSED_GRAPH_WRITES: "true",
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, "not_entitled");
}

console.log("create-paused-gates.test.ts: ok");
