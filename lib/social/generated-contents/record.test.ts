/**
 * Generated Contents recording helpers (dedupe / media type rules).
 * Run: npx --yes tsx lib/social/generated-contents/record.test.ts
 */
import assert from "assert";

function shouldPersistToLibrary(mediaUrl: string): boolean {
  if (!mediaUrl) return false;
  if (mediaUrl.startsWith("data:")) return false;
  return mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://");
}

function resolvePublishRoute(platform: "facebook" | "instagram", mediaType: "image" | "video") {
  if (platform === "instagram") {
    return { allowed: false, reason: "instagram_unavailable" as const };
  }
  if (mediaType === "video") {
    return { allowed: false, reason: "facebook_video_unsupported" as const };
  }
  return { allowed: true, endpoint: "/api/social/facebook/publish" as const };
}

assert.ok(shouldPersistToLibrary("https://x.supabase.co/storage/v1/object/public/campaign-assets/a.png"));
assert.ok(!shouldPersistToLibrary("data:image/png;base64,aaa"));
assert.ok(!shouldPersistToLibrary(""));

assert.deepStrictEqual(resolvePublishRoute("instagram", "image"), {
  allowed: false,
  reason: "instagram_unavailable",
});
assert.deepStrictEqual(resolvePublishRoute("facebook", "video"), {
  allowed: false,
  reason: "facebook_video_unsupported",
});
assert.deepStrictEqual(resolvePublishRoute("facebook", "image"), {
  allowed: true,
  endpoint: "/api/social/facebook/publish",
});

console.log("generated-contents record.test: PASS");
