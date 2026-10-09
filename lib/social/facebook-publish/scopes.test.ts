/**
 * Facebook Page publishing OAuth scopes (separate from Meta Ads).
 * Run: npx --yes tsx lib/social/facebook-publish/scopes.test.ts
 */
import assert from "assert";
import {
  META_PUBLISH_SCOPES,
  META_PUBLISH_REQUIRED_SCOPES,
  META_PUBLISH_PROVIDER,
  META_PUBLISH_ONLY_SCOPES,
  getMetaPublishRedirectUri,
  buildMetaPublishOAuthDialogUrl,
} from "@/lib/social/facebook-publish/scopes";
import {
  META_ADS_SCOPES,
  META_ADS_EXCLUDED_SCOPES,
  buildMetaAdsOAuthDialogUrl,
} from "@/lib/ads/providers/meta/client";

assert.strictEqual(META_PUBLISH_PROVIDER, "meta-publish");

assert.deepStrictEqual(
  [...META_PUBLISH_REQUIRED_SCOPES].sort(),
  ["pages_manage_posts", "pages_show_list"].sort(),
  "hard requirements are discovery + publish only"
);

assert.ok(META_PUBLISH_SCOPES.includes("pages_read_engagement"));
assert.ok(
  !(META_PUBLISH_SCOPES as readonly string[]).includes("pages_read_user_content")
);
assert.ok(
  !(META_PUBLISH_SCOPES as readonly string[]).includes("instagram_content_publish")
);
assert.ok(!(META_PUBLISH_SCOPES as readonly string[]).includes("ads_management"));

for (const scope of META_PUBLISH_ONLY_SCOPES) {
  assert.ok((META_ADS_EXCLUDED_SCOPES as readonly string[]).includes(scope));
  assert.ok(!(META_ADS_SCOPES as readonly string[]).includes(scope));
}

assert.strictEqual(
  getMetaPublishRedirectUri("http://localhost:3000"),
  "http://localhost:3000/api/social/facebook/oauth/callback"
);

const scopedUrl = buildMetaPublishOAuthDialogUrl({
  appId: "app123",
  state: "st",
  version: "23.0",
  redirectUri: "http://localhost:3000/api/social/facebook/oauth/callback",
  configId: null,
});
assert.ok(scopedUrl.includes("scope="));
assert.ok(!scopedUrl.includes("config_id="));
assert.ok(scopedUrl.includes("pages_manage_posts"));
assert.ok(scopedUrl.includes("pages_show_list"));
assert.ok(scopedUrl.includes("pages_read_engagement"));
assert.ok(!scopedUrl.includes("pages_read_user_content"));

const configUrl = buildMetaPublishOAuthDialogUrl({
  appId: "app123",
  state: "st",
  version: "23.0",
  redirectUri: "http://localhost:3000/api/social/facebook/oauth/callback",
  configId: "4424949301090772",
});
assert.ok(configUrl.includes("config_id=4424949301090772"));
assert.ok(
  !configUrl.includes("scope="),
  "FLB config_id must not also send classic scope="
);
assert.ok(configUrl.includes("override_default_response_type=true"));
assert.ok(configUrl.includes("response_type=code"));

// Env-driven config id path (without leaking value into assertions beyond presence)
const prev = process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID;
process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID = "env_cfg_1";
const envUrl = buildMetaPublishOAuthDialogUrl({
  appId: "app123",
  state: "st",
  version: "23.0",
  redirectUri: "http://localhost:3000/api/social/facebook/oauth/callback",
});
assert.ok(envUrl.includes("config_id=env_cfg_1"));
assert.ok(!envUrl.includes("scope="));
if (prev === undefined) delete process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID;
else process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID = prev;

const adsUrl = buildMetaAdsOAuthDialogUrl({
  appId: "123",
  state: "abc",
  redirectUri: "http://localhost:3000/api/meta/oauth/callback",
  version: "23.0",
  configId: null,
});
assert.ok(adsUrl.includes("ads_read"));
assert.ok(!adsUrl.includes("pages_manage_posts"));

console.log("facebook-publish scopes.test: PASS");
