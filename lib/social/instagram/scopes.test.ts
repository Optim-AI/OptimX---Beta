/**
 * Run: npx --yes tsx lib/social/instagram/scopes.test.ts
 */
import assert from "assert";
import {
  META_INSTAGRAM_PROVIDER,
  META_INSTAGRAM_SCOPES,
  META_INSTAGRAM_REQUIRED_SCOPES,
  META_INSTAGRAM_LOGIN_SCOPES_NOT_USED,
  buildMetaInstagramOAuthDialogUrl,
  getMetaInstagramRedirectUri,
} from "@/lib/social/instagram/scopes";
import { META_PUBLISH_PROVIDER, META_PUBLISH_SCOPES } from "@/lib/social/facebook-publish/scopes";
import { META_ADS_SCOPES } from "@/lib/ads/providers/meta/client";

assert.strictEqual(META_INSTAGRAM_PROVIDER, "meta-instagram");
assert.notStrictEqual(META_INSTAGRAM_PROVIDER, META_PUBLISH_PROVIDER);
assert.notStrictEqual(META_INSTAGRAM_PROVIDER, "meta");

assert.ok(META_INSTAGRAM_REQUIRED_SCOPES.includes("instagram_content_publish"));
assert.ok(META_INSTAGRAM_SCOPES.includes("instagram_manage_comments"));
assert.ok(META_INSTAGRAM_SCOPES.includes("pages_show_list"));

// Isolation: Ads / FB publish must not gain Instagram publish scopes
for (const s of ["instagram_basic", "instagram_content_publish"] as const) {
  assert.ok(
    !(META_ADS_SCOPES as readonly string[]).includes(s),
    `Ads scopes must not include ${s}`
  );
  assert.ok(
    !(META_PUBLISH_SCOPES as readonly string[]).includes(s),
    `Facebook publish scopes must not include ${s}`
  );
}

// Facebook Login path must not request Instagram Login (instagram_business_*) names
for (const s of META_INSTAGRAM_LOGIN_SCOPES_NOT_USED) {
  assert.ok(
    !(META_INSTAGRAM_SCOPES as readonly string[]).includes(s as any),
    `FLB Facebook Login scopes must not include Instagram Login scope ${s}`
  );
}

assert.strictEqual(
  getMetaInstagramRedirectUri("http://localhost:3000"),
  "http://localhost:3000/api/social/instagram/oauth/callback"
);

const redirectUri = "http://localhost:3000/api/social/instagram/oauth/callback";

// Default: missing config_id must throw (prevents Invalid Scopes on FLB)
assert.throws(
  () =>
    buildMetaInstagramOAuthDialogUrl({
      appId: "app",
      state: "st",
      redirectUri,
      configId: null,
    }),
  /FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID is required/
);

// With config_id: Facebook dialog, no scope=
const configured = buildMetaInstagramOAuthDialogUrl({
  appId: "app",
  state: "st",
  redirectUri,
  version: "23.0",
  configId: "cfg_ig_1",
});
assert.strictEqual(configured.mode, "config_id");
assert.strictEqual(configured.host, "www.facebook.com");
assert.ok(configured.url.startsWith("https://www.facebook.com/v23.0/dialog/oauth"));
assert.ok(configured.url.includes("config_id=cfg_ig_1"));
assert.ok(configured.url.includes("override_default_response_type=true"));
assert.ok(configured.url.includes("response_type=code"));
assert.ok(!configured.url.includes("scope="));
assert.ok(!configured.hasScopeParam);
assert.ok(configured.hasConfigIdParam);

// Classic scope only when explicitly allowed (non-FLB escape hatch)
const scoped = buildMetaInstagramOAuthDialogUrl({
  appId: "app",
  state: "st",
  redirectUri,
  configId: null,
  allowClassicScope: true,
});
assert.strictEqual(scoped.mode, "classic_scope");
assert.ok(scoped.url.includes("scope="));
assert.ok(scoped.url.includes("instagram_content_publish"));
assert.ok(!scoped.url.includes("config_id="));
assert.ok(!scoped.url.includes("instagram_business_basic"));

console.log("instagram scopes.test: PASS");
