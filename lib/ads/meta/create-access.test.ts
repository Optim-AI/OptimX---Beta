/**
 * Meta Ads create entitlement gate (PR W2.1).
 * Run: npx --yes tsx lib/ads/meta/create-access.test.ts
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  META_ADS_CREATE_FEATURE,
  decideMetaAdsCreateAccess,
} from "@/lib/ads/meta/create-access";

const USER = "11111111-1111-1111-1111-111111111111";

{
  const denied = decideMetaAdsCreateAccess(USER, {});
  assert.strictEqual(denied.entitled, false);
  assert.strictEqual(denied.comingSoon, true);
  assert.strictEqual(denied.gate, "env_disabled");
  assert.strictEqual(denied.feature, META_ADS_CREATE_FEATURE);
}

{
  const denied = decideMetaAdsCreateAccess(USER, {
    META_ADS_CREATE_ENABLED: "false",
  });
  assert.strictEqual(denied.entitled, false);
  assert.strictEqual(denied.gate, "env_disabled");
}

{
  const ok = decideMetaAdsCreateAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
  });
  assert.strictEqual(ok.entitled, true);
  assert.strictEqual(ok.comingSoon, false);
  assert.strictEqual(ok.gate, "env_enabled");
}

{
  const denied = decideMetaAdsCreateAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_CREATE_USER_ALLOWLIST: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  });
  assert.strictEqual(denied.entitled, false);
  assert.strictEqual(denied.gate, "allowlist_miss");
}

{
  const ok = decideMetaAdsCreateAccess(USER, {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_CREATE_USER_ALLOWLIST: `${USER},bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`,
  });
  assert.strictEqual(ok.entitled, true);
  assert.strictEqual(ok.gate, "allowlist");
}

// Must not treat Analytics / create_campaigns as Meta Ads create
{
  const featureSrc = fs.readFileSync(
    path.join(process.cwd(), "lib/features/feature.service.ts"),
    "utf8"
  );
  assert.ok(featureSrc.includes("create_campaigns"));
  assert.ok(featureSrc.includes("basic_analytics"));
  assert.ok(
    !featureSrc.includes("meta_ads_create"),
    "plan FeatureKey must not silently include meta_ads_create yet"
  );

  const accessSrc = fs.readFileSync(
    path.join(process.cwd(), "lib/ads/meta/create-access.ts"),
    "utf8"
  );
  // Gate must not import Analytics / creative plan helpers
  assert.ok(!accessSrc.includes("from \"@/lib/features"));
  assert.ok(!accessSrc.includes("decideBasicAnalyticsAccess"));
  assert.ok(!accessSrc.includes("FeatureService"));
  assert.ok(accessSrc.includes("META_ADS_CREATE_ENABLED"));
}

console.log("create-access.test.ts: ok");
