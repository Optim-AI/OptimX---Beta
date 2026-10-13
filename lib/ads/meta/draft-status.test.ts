/**
 * Run: npx --yes tsx lib/ads/meta/draft-status.test.ts
 */
import assert from "assert";
import {
  canTransitionMetaAdsDraftStatus,
  metaAdsDraftStatusAllowsMetaIds,
  META_ADS_DRAFT_STATUSES,
} from "@/lib/ads/meta/draft-status";

assert.ok(META_ADS_DRAFT_STATUSES.includes("draft"));
assert.ok(META_ADS_DRAFT_STATUSES.includes("created_paused"));

assert.ok(canTransitionMetaAdsDraftStatus("draft", "creating"));
assert.ok(canTransitionMetaAdsDraftStatus("creating", "created_paused"));
assert.ok(canTransitionMetaAdsDraftStatus("creating", "partial_failure"));
assert.ok(!canTransitionMetaAdsDraftStatus("draft", "created_paused"));
assert.ok(!canTransitionMetaAdsDraftStatus("archived", "draft"));
assert.ok(!canTransitionMetaAdsDraftStatus("created_paused", "creating"));

assert.ok(!metaAdsDraftStatusAllowsMetaIds("draft"));
assert.ok(!metaAdsDraftStatusAllowsMetaIds("failed"));
assert.ok(metaAdsDraftStatusAllowsMetaIds("creating"));
assert.ok(metaAdsDraftStatusAllowsMetaIds("created_paused"));
assert.ok(metaAdsDraftStatusAllowsMetaIds("partial_failure"));

console.log("draft-status.test.ts: ok");
