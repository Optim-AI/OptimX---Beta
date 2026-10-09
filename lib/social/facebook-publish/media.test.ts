/**
 * Media + caption validation for Facebook Page publish.
 * Run: npx --yes tsx lib/social/facebook-publish/media.test.ts
 */
import assert from "assert";
import {
  isHttpUrl,
  isLikelyPublicFetchableUrl,
  validateCaption,
  validatePublishableImageUrl,
} from "@/lib/social/facebook-publish/media";

assert.ok(isHttpUrl("https://example.com/a.png"));
assert.ok(!isHttpUrl("not-a-url"));
assert.ok(
  isLikelyPublicFetchableUrl(
    "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/a.png"
  )
);
assert.ok(!isLikelyPublicFetchableUrl("data:image/png;base64,aaa"));

const empty = validateCaption(null);
assert.ok(empty.ok && empty.caption === "");

const okCap = validateCaption("Hello world");
assert.ok(okCap.ok && okCap.caption === "Hello world");

const badType = validateCaption(123 as any);
assert.ok(!badType.ok);

const tooLong = validateCaption("x".repeat(2201));
assert.ok(!tooLong.ok);

async function main() {
  const dataUrl = await validatePublishableImageUrl("data:image/png;base64,aaa");
  assert.ok(!dataUrl.ok);

  const bad = await validatePublishableImageUrl("");
  assert.ok(!bad.ok);

  // Localhost storage URL is allowed for drafts / multipart resolve (not Meta url=)
  const local = await validatePublishableImageUrl(
    "http://localhost:54321/storage/v1/object/public/campaign-assets/x.png"
  );
  assert.ok(local.ok, "localhost storage URL should pass lightweight validation");

  const publicHttps = await validatePublishableImageUrl(
    "https://example.supabase.co/storage/v1/object/public/campaign-assets/poster.png"
  );
  assert.ok(publicHttps.ok);

  const plainHttp = await validatePublishableImageUrl(
    "http://example.com/poster.png"
  );
  assert.ok(!plainHttp.ok, "non-local http should be rejected");

  console.log("facebook-publish media.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
