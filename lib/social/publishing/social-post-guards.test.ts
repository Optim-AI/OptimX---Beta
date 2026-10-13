/**
 * Social post publish guards + request body wiring.
 * Run: npx --yes tsx lib/social/publishing/social-post-guards.test.ts
 */
import assert from "assert";
import {
  buildPublishRequestBody,
  evaluateSocialPostForPublish,
  type SocialPostGuardRow,
} from "@/lib/social/publishing/social-post-guards";

const userId = "user-a";
const base: SocialPostGuardRow = {
  id: "post-1",
  userId,
  provider: "meta-publish",
  status: "draft",
  metaPostId: null,
  sourceImageId: "img-1",
  sourceImageUrl: "https://example.com/a.png",
  metadata: {},
};

// Success path
assert.deepStrictEqual(
  evaluateSocialPostForPublish({
    existing: base,
    expectedProvider: "meta-publish",
    userId,
    sourceImageId: "img-1",
  }),
  { ok: true }
);

// Foreign user
{
  const r = evaluateSocialPostForPublish({
    existing: { ...base, userId: "other" },
    expectedProvider: "meta-publish",
    userId,
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "not_found");
}

// Provider mismatch (FB id on IG path)
{
  const r = evaluateSocialPostForPublish({
    existing: base,
    expectedProvider: "meta-instagram",
    userId,
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "provider_mismatch");
}

// Creative mismatch
{
  const r = evaluateSocialPostForPublish({
    existing: base,
    expectedProvider: "meta-publish",
    userId,
    sourceImageId: "img-other",
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "creative_mismatch");
}

// Already published
{
  const r = evaluateSocialPostForPublish({
    existing: { ...base, status: "published", metaPostId: "meta_1" },
    expectedProvider: "meta-publish",
    userId,
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "already_published");
  assert.strictEqual((r as any).status, 409);
}

// In progress
{
  const r = evaluateSocialPostForPublish({
    existing: { ...base, status: "publishing" },
    expectedProvider: "meta-publish",
    userId,
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "publish_in_progress");
  assert.strictEqual((r as any).ambiguous, true);
}

// Ambiguous prior — blocked without forceRetry
{
  const r = evaluateSocialPostForPublish({
    existing: {
      ...base,
      status: "failed",
      metadata: { ambiguous: true },
    },
    expectedProvider: "meta-publish",
    userId,
  });
  assert.ok(!r.ok);
  assert.strictEqual((r as any).code, "ambiguous_prior");
}

// Ambiguous prior — allowed with deliberate forceRetry
assert.deepStrictEqual(
  evaluateSocialPostForPublish({
    existing: {
      ...base,
      status: "failed",
      metadata: { ambiguous: true },
    },
    expectedProvider: "meta-publish",
    userId,
    forceRetry: true,
  }),
  { ok: true }
);

// Confirmed failure — retryable
assert.deepStrictEqual(
  evaluateSocialPostForPublish({
    existing: {
      ...base,
      status: "failed",
      metadata: { ambiguous: false, code: "invalid_media" },
    },
    expectedProvider: "meta-publish",
    userId,
  }),
  { ok: true }
);

// Composer body always includes socialPostId when known (FB + IG)
const fbBody = buildPublishRequestBody({
  platform: "facebook",
  mediaUrl: "https://x/a.png",
  mediaType: "image",
  caption: "hi",
  sourceImageId: "img-1",
  socialPostId: "post-1",
  draft: false,
});
assert.strictEqual(fbBody.socialPostId, "post-1");
assert.strictEqual(fbBody.imageUrl, "https://x/a.png");
assert.ok(!("mediaUrl" in fbBody));

const igBody = buildPublishRequestBody({
  platform: "instagram",
  mediaUrl: "https://x/a.mp4",
  mediaType: "video",
  caption: "reel",
  socialPostId: "post-2",
  forceRetry: true,
});
assert.strictEqual(igBody.socialPostId, "post-2");
assert.strictEqual(igBody.mediaUrl, "https://x/a.mp4");
assert.strictEqual(igBody.forceRetry, true);
assert.ok(!("imageUrl" in igBody));

// Second publish payload must reuse same id (regression for omitted socialPostId)
const second = buildPublishRequestBody({
  platform: "facebook",
  mediaUrl: "https://x/a.png",
  mediaType: "image",
  caption: "again",
  socialPostId: "post-1",
});
assert.strictEqual(second.socialPostId, "post-1");

console.log("social-post-guards.test: PASS");
