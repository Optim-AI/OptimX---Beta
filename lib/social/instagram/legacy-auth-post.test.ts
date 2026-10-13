/**
 * Run: npx --yes tsx lib/social/instagram/legacy-auth-post.test.ts
 */
import assert from "assert";
import { META_INSTAGRAM_PROVIDER } from "@/lib/social/instagram/scopes";
import {
  executeLegacyInstagramImagePost,
  isAdsOrWrongPublishProvider,
  legacyInstagramOrganicProvider,
  resolveLegacyInstagramOrganicCreds,
  sanitizeLegacyPostClientPayload,
} from "@/lib/social/instagram/legacy-auth-post";

assert.strictEqual(legacyInstagramOrganicProvider(), META_INSTAGRAM_PROVIDER);
assert.strictEqual(legacyInstagramOrganicProvider(), "meta-instagram");
assert.ok(isAdsOrWrongPublishProvider("meta"));
assert.ok(isAdsOrWrongPublishProvider("meta-publish"));
assert.ok(!isAdsOrWrongPublishProvider("meta-instagram"));

async function main() {
  // Unauthenticated
  const unauth = resolveLegacyInstagramOrganicCreds({
    userId: null,
    integration: {
      provider: "meta-instagram",
      igUserId: "ig1",
      pageAccessToken: "tok",
    },
  });
  assert.ok(!unauth.ok);
  assert.strictEqual((unauth as any).status, 401);
  assert.strictEqual((unauth as any).code, "unauthorized");

  // Missing integration for user
  const missing = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: null,
  });
  assert.ok(!missing.ok);
  assert.strictEqual((missing as any).status, 404);
  assert.strictEqual((missing as any).code, "not_connected");

  // Ads provider must never be accepted
  const ads = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: {
      provider: "meta",
      user_id: "user_a",
      igUserId: "ig_ads",
      pageAccessToken: "ads_tok",
    },
  });
  assert.ok(!ads.ok);
  assert.strictEqual((ads as any).code, "wrong_provider");

  // Cross-user row rejected
  const cross = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: {
      provider: "meta-instagram",
      user_id: "user_b",
      igUserId: "ig1",
      pageAccessToken: "tok",
    },
  });
  assert.ok(!cross.ok);
  assert.strictEqual((cross as any).status, 403);
  assert.strictEqual((cross as any).code, "forbidden");

  // Incomplete organic connection
  const incomplete = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: {
      provider: "meta-instagram",
      user_id: "user_a",
      igUserId: null,
      pageAccessToken: "tok",
    },
  });
  assert.ok(!incomplete.ok);
  assert.strictEqual((incomplete as any).code, "incomplete_connection");

  // Happy path resolve
  const ok = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: {
      provider: "meta-instagram",
      user_id: "user_a",
      igUserId: "ig_100",
      pageAccessToken: "page_tok",
      pageId: "page_1",
    },
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.strictEqual(ok.creds.provider, "meta-instagram");
    assert.strictEqual(ok.creds.igUserId, "ig_100");
    assert.strictEqual(ok.creds.userId, "user_a");
  }

  // Provider isolation: storage lookup must request organic provider only
  let requestedProvider: string | null = null;
  const simulatedHandlerLookup = (userId: string) => {
    requestedProvider = legacyInstagramOrganicProvider();
    assert.notStrictEqual(requestedProvider, "meta");
    return {
      provider: requestedProvider,
      user_id: userId,
      igUserId: "ig_100",
      pageAccessToken: "page_tok",
      pageId: "page_1",
    };
  };
  const row = simulatedHandlerLookup("user_a");
  assert.strictEqual(requestedProvider, "meta-instagram");
  const resolved = resolveLegacyInstagramOrganicCreds({
    userId: "user_a",
    integration: row,
  });
  assert.ok(resolved.ok);

  // Successful authenticated publish (mocked Graph)
  let createTok: string | null = null;
  let publishTok: string | null = null;
  let fbCalled = false;
  if (!resolved.ok) throw new Error("expected resolve ok");

  const published = await executeLegacyInstagramImagePost(
    {
      creds: resolved.creds,
      imageUrl: "https://cdn.example/a.jpg",
      caption: "Hello",
      alsoPostToFacebook: true,
    },
    {
      createMediaContainer: async (input) => {
        createTok = input.accessToken;
        assert.strictEqual(input.igUserId, "ig_100");
        assert.strictEqual(input.imageUrl, "https://cdn.example/a.jpg");
        return { id: "container_1" };
      },
      publishMedia: async (input) => {
        publishTok = input.accessToken;
        assert.strictEqual(input.creationId, "container_1");
        return { id: "media_9" };
      },
      createFacebookPhoto: async (input) => {
        fbCalled = true;
        assert.strictEqual(input.pageId, "page_1");
        return { id: "fb_photo", access_token: "SHOULD_STRIP" };
      },
    }
  );
  assert.ok(published.ok);
  if (published.ok) {
    assert.strictEqual(published.creationId, "container_1");
    assert.strictEqual(published.mediaId, "media_9");
    assert.ok(fbCalled);
    assert.strictEqual(createTok, "page_tok");
    assert.strictEqual(publishTok, "page_tok");
    const fb = published.facebookPost as any;
    assert.ok(fb && fb.id === "fb_photo");
    assert.ok(!("access_token" in fb));
  }

  // Graph create error — no token leakage in message helper path
  const failCreate = await executeLegacyInstagramImagePost(
    {
      creds: resolved.creds,
      imageUrl: "https://cdn.example/a.jpg",
    },
    {
      createMediaContainer: async () => ({
        error: { message: "Unsupported get request", code: 100 },
      }),
      publishMedia: async () => {
        throw new Error("should not publish");
      },
    }
  );
  assert.ok(!failCreate.ok);
  assert.strictEqual((failCreate as any).code, "graph_create_failed");

  // Sanitize strips tokens
  const cleaned = sanitizeLegacyPostClientPayload({
    id: "x",
    access_token: "secret",
    nested: { pageAccessToken: "secret2", ok: true },
  }) as any;
  assert.strictEqual(cleaned.id, "x");
  assert.ok(!("access_token" in cleaned));
  assert.ok(!("pageAccessToken" in cleaned.nested));
  assert.strictEqual(cleaned.nested.ok, true);

  console.log("instagram legacy-auth-post.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
