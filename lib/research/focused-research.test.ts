import assert from "node:assert/strict";
import { resolveRegions } from "./regions";
import { interestFor, trendsByState } from "./focused-research";
import { carryResearchForward } from "./store";

(async () => {
  // Regions: known ids only, order kept, no duplicates, max 6.
  const r = resolveRegions(["in-tn", "nope", "city-mumbai", "in-tn", "in-kl", "in-ka", "in-mh", "in-dl", "in-wb"]);
  assert.deepEqual(r.map((x) => x.name), ["Tamil Nadu", "Mumbai", "Kerala", "Karnataka", "Maharashtra", "Delhi"]);
  assert.equal(r[1].stateCode, "IN-MH");
  assert.deepEqual(resolveRegions("in-tn"), []);

  // Trends: scores come from Google Trends, ranked; a city uses its state's figure.
  process.env.SERPAPI_KEY = "test";
  const fake = (async () =>
    new Response(JSON.stringify({ interest_by_region: [
      { geo: "IN-TG", location: "Telangana", extracted_value: 100 },
      { geo: "IN-MH", location: "Maharashtra", extracted_value: 59 },
      { geo: "IN-TN", location: "Tamil Nadu", extracted_value: 58 },
      { geo: "IN-XX", location: "Nowhere", extracted_value: 0 },
    ] }), { status: 200 })) as typeof fetch;
  const t = await trendsByState("quinoa", fake);
  assert.equal(t.status, "ok");
  assert.deepEqual(interestFor(r[0], t), { score: 58, rank: 3, of: 3 });
  assert.deepEqual(interestFor(r[1], t), { score: 59, rank: 2, of: 3, fromState: "Maharashtra" });
  assert.deepEqual(interestFor(r[2], t), { score: null, rank: null, of: 3 });

  const none = await trendsByState("x", (async () => new Response(JSON.stringify({ error: "no results", interest_by_region: [] }), { status: 200 })) as typeof fetch);
  assert.equal(none.status, "no_data");

  // Saving the brand snapshot from the browser must not drop saved focused reports.
  const kept = carryResearchForward({ brand_name: "B" }, { focusedResearch: [{ id: "1" }] });
  assert.deepEqual(kept.focusedResearch, [{ id: "1" }]);
  const replaced = carryResearchForward({ focusedResearch: [] }, { focusedResearch: [{ id: "1" }] });
  assert.deepEqual(replaced.focusedResearch, []);

  console.log("focused-research.test.ts: PASS");
})().catch((e) => { console.error(e); process.exit(1); });
