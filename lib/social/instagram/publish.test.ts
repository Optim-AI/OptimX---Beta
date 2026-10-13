/**
 * Run: npx --yes tsx lib/social/instagram/publish.test.ts
 */
import assert from "assert";
import { publishInstagramCreative } from "@/lib/social/instagram/publish";

const PUBLIC =
  "https://example.supabase.co/storage/v1/object/public/campaign-assets/poster.jpg";

async function main() {
  const badUrl = await publishInstagramCreative({
    igUserId: "ig1",
    accessToken: "tok",
    mediaUrl: "http://localhost:54321/storage/v1/object/public/campaign-assets/a.png",
    validateUrl: async () => ({
      ok: false,
      error: "localhost blocked",
      code: "localhost_or_insecure",
    }),
  });
  assert.ok(!badUrl.ok);
  assert.strictEqual((badUrl as any).code, "localhost_or_insecure");

  let createCalls = 0;
  let publishCalls = 0;
  let waitCalls = 0;

  const ok = await publishInstagramCreative({
    igUserId: "ig1",
    accessToken: "tok",
    mediaUrl: PUBLIC,
    caption: "Launch",
    validateUrl: async () => ({ ok: true, url: PUBLIC, mediaKind: "image" }),
    createImageContainer: async (input) => {
      createCalls += 1;
      assert.strictEqual(input.imageUrl, PUBLIC);
      assert.strictEqual(input.caption, "Launch");
      return { id: "container_1" };
    },
    waitForReady: async () => {
      waitCalls += 1;
      return { statusCode: "FINISHED" };
    },
    publishContainer: async (input) => {
      publishCalls += 1;
      assert.strictEqual(input.creationId, "container_1");
      return { id: "media_99" };
    },
    fetchPublished: async () => ({
      id: "media_99",
      permalink: "https://instagram.com/p/abc",
    }),
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.strictEqual(ok.mediaId, "media_99");
    assert.strictEqual(ok.containerId, "container_1");
    assert.strictEqual(ok.permalink, "https://instagram.com/p/abc");
  }
  assert.strictEqual(createCalls, 1);
  assert.strictEqual(waitCalls, 1);
  assert.strictEqual(publishCalls, 1);

  // Video / Reels path
  createCalls = 0;
  const reel = await publishInstagramCreative({
    igUserId: "ig1",
    accessToken: "tok",
    mediaUrl: "https://cdn.example/v.mp4",
    mediaType: "video",
    validateUrl: async () => ({
      ok: true,
      url: "https://cdn.example/v.mp4",
      mediaKind: "video",
    }),
    createVideoContainer: async (input) => {
      createCalls += 1;
      assert.strictEqual(input.mediaType, "REELS");
      return { id: "c_video" };
    },
    waitForReady: async () => ({ statusCode: "FINISHED" }),
    publishContainer: async () => ({ id: "m_video" }),
    fetchPublished: async () => ({ id: "m_video" }),
  });
  assert.ok(reel.ok);
  assert.strictEqual(createCalls, 1);

  // Duplicate / empty publish id → ambiguous, no auto-retry
  publishCalls = 0;
  const amb = await publishInstagramCreative({
    igUserId: "ig1",
    accessToken: "tok",
    mediaUrl: PUBLIC,
    validateUrl: async () => ({ ok: true, url: PUBLIC, mediaKind: "image" }),
    createImageContainer: async () => ({ id: "c2" }),
    waitForReady: async () => ({ statusCode: "FINISHED" }),
    publishContainer: async () => {
      publishCalls += 1;
      return { id: "" } as any;
    },
  });
  assert.ok(!amb.ok);
  assert.ok((amb as any).ambiguous);
  assert.strictEqual(publishCalls, 1);

  console.log("instagram publish.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
