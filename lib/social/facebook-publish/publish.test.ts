/**
 * Facebook Page photo publish service (Meta API mocked via inject).
 * Run: npx --yes tsx lib/social/facebook-publish/publish.test.ts
 */
import assert from "assert";
import { publishFacebookPagePhoto } from "@/lib/social/facebook-publish/publish";
import type { ResolvePublishImageDeps } from "@/lib/social/facebook-publish/resolve-media";
import type { CreateFacebookPostInput } from "@/integrations/meta/facebook";

const PUBLIC =
  "https://example.supabase.co/storage/v1/object/public/campaign-assets/a.png";
const LOCAL =
  "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.jpg";

const jpegBytes = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
  0xd9,
]);

function localDeps(): ResolvePublishImageDeps {
  return {
    getImageByIdForUser: async (id, userId) =>
      id === "img-1" && userId === "user-1"
        ? {
            id: "img-1",
            userId: "user-1",
            imageUrl: LOCAL,
            imagePath: "poster-generation/u/s/g.jpg",
            mediaType: "image",
          }
        : null,
    findImageForUser: async () => null,
    downloadStorageObject: async () => ({ ok: true, buffer: jpegBytes }),
    lookupFn: async () => [{ address: "8.8.8.8", family: 4 }] as any,
  };
}

function publicDeps(): ResolvePublishImageDeps {
  return {
    getImageByIdForUser: async () => null,
    findImageForUser: async () => null,
    downloadStorageObject: async () => ({ ok: false, error: "not_found" }),
    lookupFn: async () => [{ address: "8.8.8.8", family: 4 }] as any,
  };
}

async function main() {
  let lastCreate: CreateFacebookPostInput | null = null;

  const badMedia = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    imageUrl: "data:image/png;base64,xx",
    caption: "hi",
    resolveDeps: publicDeps(),
    createPost: async (input) => {
      lastCreate = input;
      return { id: "x" };
    },
  });
  assert.ok(!badMedia.ok);
  assert.strictEqual(lastCreate, null);

  const badCap = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    imageUrl: PUBLIC,
    caption: "x".repeat(2201),
    resolveDeps: publicDeps(),
    createPost: async (input) => {
      lastCreate = input;
      return { id: "x" };
    },
  });
  assert.ok(!badCap.ok);
  assert.strictEqual((badCap as any).code, "invalid_caption");

  // Public HTTPS → Meta url field
  lastCreate = null;
  const okUrl = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    imageUrl: PUBLIC,
    caption: "Launch day",
    resolveDeps: publicDeps(),
    createPost: async (input) => {
      lastCreate = input;
      return { id: "ph_ok", post_id: "po_ok" };
    },
  });
  assert.ok(okUrl.ok);
  if (okUrl.ok) {
    assert.strictEqual(okUrl.uploadMode, "url");
    assert.strictEqual(okUrl.photoId, "ph_ok");
  }
  const urlCall = lastCreate as CreateFacebookPostInput | null;
  assert.ok(urlCall);
  assert.strictEqual(urlCall.imageUrl, PUBLIC);
  assert.strictEqual(urlCall.imageBuffer, undefined);

  // Localhost owned → multipart source, no url
  lastCreate = null;
  const okMulti = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    sourceImageId: "img-1",
    imageUrl: LOCAL,
    caption: "Local poster",
    resolveDeps: localDeps(),
    createPost: async (input) => {
      lastCreate = input;
      return { id: "ph_m", post_id: "po_m" };
    },
  });
  assert.ok(okMulti.ok);
  if (okMulti.ok) {
    assert.strictEqual(okMulti.uploadMode, "multipart");
  }
  const multiCall = lastCreate as CreateFacebookPostInput | null;
  assert.ok(multiCall);
  assert.strictEqual(multiCall.imageUrl, undefined);
  assert.ok(multiCall.imageBuffer);
  assert.ok(Buffer.from(multiCall.imageBuffer).equals(jpegBytes));
  assert.strictEqual(multiCall.imageContentType, "image/jpeg");
  assert.strictEqual(multiCall.imageFilename, "photo.jpg");

  // Meta permission error still tracked (no auto-retry)
  lastCreate = null;
  let calls = 0;
  const denied = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    imageUrl: PUBLIC,
    resolveDeps: publicDeps(),
    createPost: async () => {
      calls += 1;
      throw new Error(
        "Facebook post creation failed: (#200) Requires pages_manage_posts"
      );
    },
  });
  assert.ok(!denied.ok);
  assert.strictEqual(calls, 1);
  assert.ok(!(denied as any).ambiguous);

  calls = 0;
  const amb = await publishFacebookPagePhoto({
    pageId: "p1",
    pageAccessToken: "tok",
    userId: "user-1",
    imageUrl: PUBLIC,
    resolveDeps: publicDeps(),
    createPost: async () => {
      calls += 1;
      throw new Error("fetch failed: ECONNRESET");
    },
  });
  assert.ok(!amb.ok);
  assert.strictEqual(calls, 1, "must not auto-retry ambiguous failures");
  assert.ok((amb as any).ambiguous);

  console.log("facebook-publish publish.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
