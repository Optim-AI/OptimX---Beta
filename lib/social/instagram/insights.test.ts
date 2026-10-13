/**
 * Run: npx --yes tsx lib/social/instagram/insights.test.ts
 */
import assert from "assert";
import { loadInstagramMediaEngagement } from "@/lib/social/instagram/insights";

async function main() {
  const eng = await loadInstagramMediaEngagement({
    mediaId: "m1",
    accessToken: "tok",
    getMedia: async () => ({
      id: "m1",
      like_count: 0,
      comments_count: 3,
      permalink: "https://instagram.com/p/x",
      media_type: "IMAGE",
      caption: "hi",
      timestamp: "2026-01-01T00:00:00+0000",
    }),
    getInsights: async () => ({
      data: [
        { name: "likes", values: [{ value: 0 }] },
        { name: "reach", values: [{ value: 12 }] },
        // saved intentionally missing → unavailable
      ],
    }),
  });

  assert.strictEqual(eng.likeCount.available, true);
  assert.strictEqual(eng.likeCount.value, 0); // genuine zero
  assert.strictEqual(eng.commentsCount.available, true);
  assert.strictEqual(eng.commentsCount.value, 3);
  assert.strictEqual(eng.insights.reach.available, true);
  assert.strictEqual(eng.insights.reach.value, 12);
  assert.strictEqual(eng.insights.saved.available, false);
  assert.strictEqual(eng.insights.saved.value, null);

  const omitted = await loadInstagramMediaEngagement({
    mediaId: "m2",
    accessToken: "tok",
    getMedia: async () => ({
      id: "m2",
      // like_count omitted (e.g. hidden)
    }),
    getInsights: async () => ({ data: [] }),
  });
  assert.strictEqual(omitted.likeCount.available, false);
  assert.strictEqual(omitted.likeCount.value, null);

  console.log("instagram insights.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
