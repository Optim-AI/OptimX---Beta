/**
 * Meta Ads token column contract (PR W2.3B).
 * Run: npx --yes tsx lib/ads/providers/meta/token-contract.test.ts
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  mapMetaAdsStoredTokens,
  preferMetaAdsUserTokenForGraph,
} from "@/lib/ads/providers/meta/token-contract";

const PAGE = "PAGE_TOKEN_abc";
const USER = "USER_TOKEN_xyz";

{
  const m = mapMetaAdsStoredTokens({
    accessToken: PAGE,
    refreshToken: USER,
  });
  assert.strictEqual(m.pageAccessToken, PAGE);
  assert.strictEqual(m.userAccessToken, USER);
}

{
  const m = mapMetaAdsStoredTokens({
    accessToken: "  ",
    refreshToken: null,
  });
  assert.strictEqual(m.pageAccessToken, null);
  assert.strictEqual(m.userAccessToken, null);
}

{
  assert.strictEqual(
    preferMetaAdsUserTokenForGraph({
      provider: "meta",
      accessToken: PAGE,
      refreshToken: USER,
    }),
    USER
  );
  assert.strictEqual(
    preferMetaAdsUserTokenForGraph({
      provider: "meta",
      accessToken: PAGE,
      refreshToken: null,
    }),
    PAGE,
    "fallback only when user token absent"
  );
  assert.strictEqual(
    preferMetaAdsUserTokenForGraph({
      provider: "google-ads",
      accessToken: "g-access",
      refreshToken: "g-refresh",
    }),
    "g-access"
  );
}

// Finalize + store contract markers
{
  const finalize = fs.readFileSync(
    path.join(process.cwd(), "pages/api/meta/oauth/finalize.ts"),
    "utf8"
  );
  assert.ok(finalize.includes("userAccessToken: session.userAccessToken"));
  assert.ok(finalize.includes("pageAccessToken: selectedPage.access_token"));
  assert.ok(finalize.includes("pageId: selectedPage.id"));

  const store = fs.readFileSync(
    path.join(process.cwd(), "integrations/store.ts"),
    "utf8"
  );
  assert.ok(store.includes("page token in access_token"));
  assert.ok(store.includes("user token in refresh_token"));
  assert.ok(store.includes("pageAccessToken: revealed.accessToken"));
  assert.ok(store.includes("userAccessToken: revealed.refreshToken"));

  const loader = fs.readFileSync(
    path.join(process.cwd(), "lib/ads/providers/meta/load-write-context.ts"),
    "utf8"
  );
  assert.ok(loader.includes("mapMetaAdsStoredTokens"));
  assert.ok(loader.includes("typed.userAccessToken"));
  assert.ok(loader.includes("missing_user_access_token"));

  // Sync prefers Meta user token
  const runner = fs.readFileSync(
    path.join(process.cwd(), "lib/ads/sync/runner.ts"),
    "utf8"
  );
  assert.ok(runner.includes('provider === "meta"'));
  assert.ok(runner.includes("refreshToken || accessToken"));
}

console.log("token-contract.test.ts: ok");
