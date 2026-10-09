/**
 * Meta Ads OAuth scope / redirect helpers.
 * Run: npx --yes tsx lib/ads/providers/meta/oauth-scopes.test.ts
 */
import assert from "assert";
import {
  META_ADS_SCOPES,
  META_ADS_EXCLUDED_SCOPES,
  getMetaOAuthRedirectUri,
  buildMetaAdsOAuthDialogUrl,
} from "@/lib/ads/providers/meta/client";

const SKALX_ADS_FLB_PERMISSIONS = [
  "ads_read",
  "ads_management",
  "business_management",
  "leads_retrieval",
  "pages_manage_ads",
  "pages_show_list",
  "pages_read_engagement",
  "pages_messaging",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
] as const;

assert.deepStrictEqual(
  [...META_ADS_SCOPES].sort(),
  [...SKALX_ADS_FLB_PERMISSIONS].sort(),
  "META_ADS_SCOPES must match SkalX Ads FLB configuration"
);

for (const excluded of META_ADS_EXCLUDED_SCOPES) {
  assert.ok(
    !(META_ADS_SCOPES as readonly string[]).includes(excluded),
    `META_ADS_SCOPES must not include ${excluded}`
  );
}

assert.strictEqual(
  getMetaOAuthRedirectUri("http://localhost:3000"),
  "http://localhost:3000/api/meta/oauth/callback"
);
assert.strictEqual(
  getMetaOAuthRedirectUri("http://localhost:3000/"),
  "http://localhost:3000/api/meta/oauth/callback",
  "trailing slash on app URL must be normalized"
);

const scopedUrl = buildMetaAdsOAuthDialogUrl({
  appId: "123",
  state: "abc",
  redirectUri: "http://localhost:3000/api/meta/oauth/callback",
  version: "23.0",
  configId: null,
});
assert.ok(scopedUrl.includes("scope="), "without config_id, URL must use scope");
assert.ok(!scopedUrl.includes("config_id="), "without config_id, URL must not set config_id");
assert.ok(
  !scopedUrl.includes("instagram_basic"),
  "OAuth URL must not request instagram_basic"
);
assert.ok(
  !scopedUrl.includes("pages_manage_posts"),
  "OAuth URL must not request pages_manage_posts"
);
assert.ok(scopedUrl.includes("ads_read"), "OAuth URL must request ads_read");

const configUrl = buildMetaAdsOAuthDialogUrl({
  appId: "123",
  state: "abc",
  redirectUri: "http://localhost:3000/api/meta/oauth/callback",
  version: "23.0",
  configId: "999888777",
});
assert.ok(configUrl.includes("config_id=999888777"), "with config_id, URL must pass it");
assert.ok(!configUrl.includes("scope="), "with config_id, scope must be omitted");

console.log("meta oauth-scopes.test: PASS");
