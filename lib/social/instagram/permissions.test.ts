/**
 * Run: npx --yes tsx lib/social/instagram/permissions.test.ts
 */
import assert from "assert";
import { summarizeInstagramScopes } from "@/lib/social/instagram/permissions";

const complete = summarizeInstagramScopes([
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
]);
assert.deepStrictEqual(complete.missingRequired, []);
assert.ok(complete.hasContentPublish);
assert.ok(complete.hasManageComments);

const missingPublish = summarizeInstagramScopes([
  "instagram_basic",
  "pages_show_list",
]);
assert.ok(missingPublish.missingRequired.includes("instagram_content_publish"));
assert.ok(!missingPublish.hasContentPublish);

const declinedComments = summarizeInstagramScopes([
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
]);
assert.ok(
  declinedComments.missingRecommended.includes("instagram_manage_comments")
);

console.log("instagram permissions.test: PASS");
