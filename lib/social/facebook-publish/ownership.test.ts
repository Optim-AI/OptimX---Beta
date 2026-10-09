/**
 * Ownership / duplicate-publish guards (pure logic mirrored from publish route).
 * Run: npx --yes tsx lib/social/facebook-publish/ownership.test.ts
 */
import assert from "assert";

type PostRow = {
  userId: string;
  status: "draft" | "publishing" | "published" | "failed";
  metaPostId?: string | null;
};

function assertUserOwnsPost(row: PostRow | null, userId: string): row is PostRow {
  return !!row && row.userId === userId;
}

function canAttemptPublish(row: PostRow): {
  ok: boolean;
  code?: string;
  ambiguous?: boolean;
} {
  if (row.status === "published" && row.metaPostId) {
    return { ok: false, code: "already_published" };
  }
  if (row.status === "publishing") {
    return { ok: false, code: "publish_in_progress", ambiguous: true };
  }
  return { ok: true };
}

const userA = "user-a";
const userB = "user-b";

assert.ok(
  !assertUserOwnsPost({ userId: userA, status: "draft" }, userB),
  "user B must not own user A post"
);
assert.ok(assertUserOwnsPost({ userId: userA, status: "draft" }, userA));

assert.deepStrictEqual(
  canAttemptPublish({
    userId: userA,
    status: "published",
    metaPostId: "123_456",
  }),
  { ok: false, code: "already_published" }
);

assert.deepStrictEqual(
  canAttemptPublish({ userId: userA, status: "publishing" }),
  { ok: false, code: "publish_in_progress", ambiguous: true }
);

assert.deepStrictEqual(
  canAttemptPublish({ userId: userA, status: "draft" }),
  { ok: true }
);

assert.deepStrictEqual(
  canAttemptPublish({ userId: userA, status: "failed" }),
  { ok: true }
);

console.log("facebook-publish ownership.test: PASS");
