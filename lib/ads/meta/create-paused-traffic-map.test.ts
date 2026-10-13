/**
 * Run: npx --yes tsx lib/ads/meta/create-paused-traffic-map.test.ts
 */
import assert from "assert";
import {
  META_ADS_CREATE_PAUSED_OBJECTIVE,
  assertTrafficCreatePausedDraft,
  buildTrafficAdParams,
  buildTrafficAdSetParams,
  buildTrafficCampaignParams,
  buildTrafficCreativeParams,
  MetaAdsCreatePausedMapError,
} from "@/lib/ads/meta/create-paused-traffic-map";

const base = {
  name: "Traffic Test",
  objective: META_ADS_CREATE_PAUSED_OBJECTIVE,
  dailyBudgetMajor: "10.50",
  currency: "USD",
  accountCurrency: "USD",
  targeting: { geoCountries: ["US"], ageMin: 18, ageMax: 45 },
  placements: { mode: "automatic" as const },
  destinationUrl: "https://example.com/landing",
  callToAction: "LEARN_MORE",
  primaryText: "Hello",
  headline: "World",
  scheduleStart: null,
  scheduleEnd: null,
};

{
  const mapped = assertTrafficCreatePausedDraft(base);
  const camp = buildTrafficCampaignParams(mapped);
  assert.strictEqual(camp.status, "PAUSED");
  assert.strictEqual(camp.objective, "OUTCOME_TRAFFIC");
  assert.strictEqual(camp.special_ad_categories, "[]");
  assert.ok(!("status" in camp && (camp as any).status === "ACTIVE"));

  const adset = buildTrafficAdSetParams(mapped, "camp_1");
  assert.strictEqual(adset.status, "PAUSED");
  assert.strictEqual(adset.optimization_goal, "LINK_CLICKS");
  assert.strictEqual(adset.billing_event, "IMPRESSIONS");
  assert.strictEqual(adset.daily_budget, 1050);
  assert.ok(adset.targeting.includes("US"));

  const creative = buildTrafficCreativeParams({
    name: mapped.name,
    pageId: "page_9",
    destinationUrl: mapped.destinationUrl,
    imageHash: "hash_1",
    primaryText: mapped.primaryText,
    headline: mapped.headline,
    callToAction: mapped.callToAction,
  });
  const spec = JSON.parse(creative.object_story_spec);
  assert.strictEqual(spec.page_id, "page_9");
  assert.strictEqual(spec.link_data.image_hash, "hash_1");

  const ad = buildTrafficAdParams({
    name: mapped.name,
    adsetId: "adset_1",
    creativeId: "cr_1",
  });
  assert.strictEqual(ad.status, "PAUSED");
}

{
  assert.throws(
    () =>
      assertTrafficCreatePausedDraft({
        ...base,
        objective: "OUTCOME_AWARENESS",
      }),
    (e: unknown) =>
      e instanceof MetaAdsCreatePausedMapError &&
      e.code === "unsupported_objective"
  );
}

{
  assert.throws(
    () =>
      assertTrafficCreatePausedDraft({
        ...base,
        specialAdCategories: ["HOUSING"],
      }),
    (e: unknown) =>
      e instanceof MetaAdsCreatePausedMapError &&
      e.code === "unsupported_special_ad_categories"
  );
}

{
  assert.throws(
    () =>
      assertTrafficCreatePausedDraft({
        ...base,
        dailyBudgetMajor: null,
      }),
    (e: unknown) =>
      e instanceof MetaAdsCreatePausedMapError && e.code === "missing_budget"
  );
}

{
  const feed = assertTrafficCreatePausedDraft({
    ...base,
    placements: { mode: "manual", positions: ["facebook_feed"] },
  });
  const adset = buildTrafficAdSetParams(feed, "c1");
  const targeting = JSON.parse(adset.targeting);
  assert.deepStrictEqual(targeting.publisher_platforms, ["facebook"]);
  assert.deepStrictEqual(targeting.facebook_positions, ["feed"]);
}

console.log("create-paused-traffic-map.test.ts: ok");
