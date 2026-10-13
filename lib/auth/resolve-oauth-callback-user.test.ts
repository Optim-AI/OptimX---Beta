/**
 * Run: npx --yes tsx lib/auth/resolve-oauth-callback-user.test.ts
 */
import assert from "assert";
import { encodeState } from "@/auth/helpers";
import { resolveOAuthCallbackUser } from "@/lib/auth/resolve-oauth-callback-user";

const PREV_FALLBACK = process.env.SUPABASE_INTEGRATION_USER_ID;

async function main() {
  // Even if env is set, resolver must never use it
  process.env.SUPABASE_INTEGRATION_USER_ID = "env-fallback-user-SHOULD-NOT-BIND";

  const users = new Map<string, string>([
    ["token_user_a", "user_a"],
    ["token_user_b", "user_b"],
  ]);

  const deps = {
    getUserByAccessToken: async (accessToken: string) => {
      const userId = users.get(accessToken) ?? null;
      return { userId, errorMessage: userId ? null : "invalid" };
    },
  };

  // Missing state
  const missingState = await resolveOAuthCallbackUser(
    { state: null, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!missingState.ok);
  assert.strictEqual((missingState as any).code, "missing_state");

  // Invalid / corrupted state (replay-like garbage)
  const badState = await resolveOAuthCallbackUser(
    { state: "not-valid-base64-json!!!", expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!badState.ok);
  assert.strictEqual((badState as any).code, "invalid_state");

  // State without bound session token `t`
  const noTokenState = encodeState({ r: "nonce1", p: "meta" });
  const missingTok = await resolveOAuthCallbackUser(
    { state: noTokenState, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!missingTok.ok);
  assert.strictEqual((missingTok as any).code, "missing_supabase_token");
  // Env fallback must not rescue this
  assert.notStrictEqual((missingTok as any).userId, "env-fallback-user-SHOULD-NOT-BIND");

  // Invalid / expired token in state
  const expiredState = encodeState({
    r: "nonce2",
    p: "meta",
    t: "expired_token",
  });
  const invalidTok = await resolveOAuthCallbackUser(
    { state: expiredState, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!invalidTok.ok);
  assert.strictEqual((invalidTok as any).status, 401);
  assert.strictEqual((invalidTok as any).code, "invalid_supabase_token");

  // Provider mismatch (ownership / CSRF surface: wrong start entry)
  const wrongProviderState = encodeState({
    r: "nonce3",
    p: "meta-instagram",
    t: "token_user_a",
  });
  const mismatch = await resolveOAuthCallbackUser(
    { state: wrongProviderState, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!mismatch.ok);
  assert.strictEqual((mismatch as any).code, "provider_mismatch");

  // Successful Ads callback identity
  const adsState = encodeState({
    r: "nonce_ads",
    p: "meta",
    t: "token_user_a",
  });
  const adsOk = await resolveOAuthCallbackUser(
    { state: adsState, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(adsOk.ok);
  if (adsOk.ok) {
    assert.strictEqual(adsOk.userId, "user_a");
    assert.strictEqual(adsOk.stateProvider, "meta");
    assert.strictEqual(adsOk.stateNonce, "nonce_ads");
    assert.strictEqual(adsOk.source, "oauth_state");
    assert.notStrictEqual(adsOk.userId, process.env.SUPABASE_INTEGRATION_USER_ID);
  }

  // Successful meta-publish
  const publishState = encodeState({
    r: "nonce_pub",
    p: "meta-publish",
    t: "token_user_b",
  });
  const pubOk = await resolveOAuthCallbackUser(
    { state: publishState, expectedStateProvider: "meta-publish" },
    deps
  );
  assert.ok(pubOk.ok);
  if (pubOk.ok) {
    assert.strictEqual(pubOk.userId, "user_b");
    assert.strictEqual(pubOk.stateProvider, "meta-publish");
  }

  // Successful meta-instagram
  const igState = encodeState({
    r: "nonce_ig",
    p: "meta-instagram",
    t: "token_user_a",
  });
  const igOk = await resolveOAuthCallbackUser(
    { state: igState, expectedStateProvider: "meta-instagram" },
    deps
  );
  assert.ok(igOk.ok);
  if (igOk.ok) assert.strictEqual(igOk.userId, "user_a");

  // Legacy start without `p` — expectedStateProvider omitted
  const legacyState = encodeState({ r: "legacy", t: "token_user_b" });
  const legacyOk = await resolveOAuthCallbackUser({ state: legacyState }, deps);
  assert.ok(legacyOk.ok);
  if (legacyOk.ok) {
    assert.strictEqual(legacyOk.userId, "user_b");
    assert.strictEqual(legacyOk.stateProvider, null);
  }

  // Bearer secondary path when state has nonce+provider but token only in header
  // (state still required; missing t uses Authorization)
  const headerOnlyState = encodeState({ r: "hdr", p: "meta" });
  const headerOk = await resolveOAuthCallbackUser(
    {
      state: headerOnlyState,
      authorizationHeader: "Bearer token_user_a",
      expectedStateProvider: "meta",
    },
    deps
  );
  assert.ok(headerOk.ok);
  if (headerOk.ok) {
    assert.strictEqual(headerOk.userId, "user_a");
    assert.strictEqual(headerOk.source, "authorization_header");
  }

  // Replayed / tampered: change provider in a copied payload should fail expected check
  const tampered = encodeState({
    r: "nonce_ads",
    p: "meta-publish",
    t: "token_user_a",
  });
  const tamperedFail = await resolveOAuthCallbackUser(
    { state: tampered, expectedStateProvider: "meta" },
    deps
  );
  assert.ok(!tamperedFail.ok);
  assert.strictEqual((tamperedFail as any).code, "provider_mismatch");

  // Confirm env was set during all failures/successes and never became the userId
  assert.strictEqual(
    process.env.SUPABASE_INTEGRATION_USER_ID,
    "env-fallback-user-SHOULD-NOT-BIND"
  );

  console.log("resolve-oauth-callback-user.test: PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    if (PREV_FALLBACK === undefined) {
      delete process.env.SUPABASE_INTEGRATION_USER_ID;
    } else {
      process.env.SUPABASE_INTEGRATION_USER_ID = PREV_FALLBACK;
    }
  });
