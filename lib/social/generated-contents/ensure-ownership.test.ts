/**
 * Ensure ownership helpers (poster / video library registration).
 * Run: npx --yes tsx lib/social/generated-contents/ensure-ownership.test.ts
 */
import assert from "assert";
import {
  assertEnsureableStoragePath,
  storagePathFromPublicUrl,
} from "@/lib/social/generated-contents/ensure-ownership";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

// Path parse from public URL
assert.strictEqual(
  storagePathFromPublicUrl(
    `https://host.supabase.co/storage/v1/object/public/campaign-assets/poster-generation/${userA}/s/g.jpg`
  ),
  `poster-generation/${userA}/s/g.jpg`
);
assert.strictEqual(storagePathFromPublicUrl("data:image/png;base64,aaa"), null);
assert.strictEqual(storagePathFromPublicUrl("not-a-url"), null);

// Own poster-generation path allowed
assert.deepStrictEqual(
  assertEnsureableStoragePath({
    userId: userA,
    storagePath: `poster-generation/${userA}/sess/gen.png`,
  }),
  { ok: true }
);

// Foreign poster path rejected (even before a library row exists)
const foreignPoster = assertEnsureableStoragePath({
  userId: userA,
  storagePath: `poster-generation/${userB}/sess/gen.png`,
});
assert.ok(!foreignPoster.ok);
assert.strictEqual((foreignPoster as any).code, "foreign_path");

// campaigns/{userId}/… same rule
const foreignCampaign = assertEnsureableStoragePath({
  userId: userA,
  storagePath: `campaigns/${userB}/file.png`,
});
assert.ok(!foreignCampaign.ok);

// Unscoped video layout allowed (claim via first ensure + DAO cross-user check)
assert.deepStrictEqual(
  assertEnsureableStoragePath({
    userId: userA,
    storagePath: "generated/videos/abc_123.mp4",
  }),
  { ok: true }
);

console.log("generated-contents ensure-ownership.test: PASS");
