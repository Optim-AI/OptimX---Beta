/**
 * First-release Meta Ads draft contract (PR W2.2).
 * Run: npx --yes tsx lib/ads/meta/draft-contract.test.ts
 */
import assert from "assert";
import {
  isMetaAdsDraftObjective,
  isPublicHttpsUrl,
  metaAdsDraftStatusLabel,
  parseMetaAdsDraftPlacements,
  parseMetaAdsDraftTargeting,
  META_ADS_DRAFT_OBJECTIVES,
} from "@/lib/ads/meta/draft-contract";
import { assertFirstReleaseDraftFields } from "@/lib/ads/meta/draft-validation";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";

assert.ok(isMetaAdsDraftObjective("OUTCOME_TRAFFIC"));
assert.ok(!isMetaAdsDraftObjective("OUTCOME_SALES"));
assert.ok(!isMetaAdsDraftObjective("CONVERSIONS"));
assert.strictEqual(META_ADS_DRAFT_OBJECTIVES.length, 3);

assert.ok(isPublicHttpsUrl("https://example.com/x"));
assert.ok(!isPublicHttpsUrl("http://example.com/x"));
assert.ok(!isPublicHttpsUrl("not-a-url"));

assert.ok(
  parseMetaAdsDraftTargeting({
    geoCountries: ["US", "IN"],
    ageMin: 18,
    ageMax: 45,
  })
);
assert.strictEqual(
  parseMetaAdsDraftTargeting({ geoCountries: ["ZZ"], ageMin: 18, ageMax: 40 }),
  null
);
assert.ok(parseMetaAdsDraftPlacements({ mode: "automatic" }));
assert.strictEqual(
  parseMetaAdsDraftPlacements({ mode: "manual", positions: ["instagram_reels"] }),
  null
);

assert.strictEqual(metaAdsDraftStatusLabel("draft"), "Draft — not on Meta");
assert.strictEqual(
  metaAdsDraftStatusLabel("failed"),
  "Failed — needs attention"
);
assert.strictEqual(metaAdsDraftStatusLabel("archived"), "Archived");
assert.ok(!metaAdsDraftStatusLabel("draft").toLowerCase().includes("live"));

assert.doesNotThrow(() =>
  assertFirstReleaseDraftFields({
    objective: "OUTCOME_TRAFFIC",
    callToAction: "LEARN_MORE",
    destinationUrl: "https://example.com",
    targeting: { geoCountries: ["US"], ageMin: 18, ageMax: 65 },
    placements: { mode: "automatic" },
    scheduleStart: "2026-10-20T00:00:00.000Z",
    scheduleEnd: "2026-10-30T00:00:00.000Z",
  })
);

try {
  assertFirstReleaseDraftFields({ objective: "OUTCOME_SALES" });
  throw new Error("expected invalid_objective");
} catch (e) {
  assert.ok(e instanceof MetaAdsDraftValidationError);
  assert.strictEqual(e.code, "invalid_objective");
}

try {
  assertFirstReleaseDraftFields({ destinationUrl: "http://insecure.example" });
  throw new Error("expected invalid_destination_url");
} catch (e) {
  assert.ok(e instanceof MetaAdsDraftValidationError);
  assert.strictEqual(e.code, "invalid_destination_url");
}

console.log("draft-contract.test.ts: ok");
