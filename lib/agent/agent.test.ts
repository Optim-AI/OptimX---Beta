/**
 * Marketing Agent: pure-logic checks (no database, no model calls).
 * Run: npm run test:agent
 */
import assert from "node:assert/strict";
import { cleanCadence, describeCadence, nextRunAfter } from "./tasks";
import { cleanProposal, costOf } from "./actions";
import { cleanPost, isOwnPosterUrl, settleStale, type PosterJobResult } from "./posters";
import { wantsWebFacts, iso } from "./store";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Marketing Agent");

test("weekly schedule picks the next matching day in India time", () => {
  const from = new Date("2026-11-22T10:00:00+05:30"); // Sunday 10 AM IST
  assert.equal(nextRunAfter({ freq: "weekly", weekday: 1, hour: 9 }, from).toISOString(), "2026-11-23T03:30:00.000Z");
  assert.equal(nextRunAfter({ freq: "weekly", weekday: 0, hour: 9 }, from).toISOString(), "2026-11-29T03:30:00.000Z");
  assert.equal(nextRunAfter({ freq: "weekly", weekday: 0, hour: 11 }, from).toISOString(), "2026-11-22T05:30:00.000Z");
});

test("monthly schedule rolls over months and years", () => {
  assert.equal(nextRunAfter({ freq: "monthly", monthday: 1, hour: 10 }, new Date("2026-11-22T10:00:00+05:30")).toISOString(), "2026-12-01T04:30:00.000Z");
  assert.equal(nextRunAfter({ freq: "monthly", monthday: 5, hour: 8 }, new Date("2026-12-20T10:00:00+05:30")).toISOString(), "2027-01-05T02:30:00.000Z");
});

test("bad schedules are rejected and good ones read in plain words", () => {
  assert.equal(cleanCadence({ freq: "daily", hour: 9 }), null);
  assert.equal(cleanCadence({ freq: "weekly", weekday: 7, hour: 9 }), null);
  assert.equal(cleanCadence({ freq: "monthly", monthday: 31, hour: 9 }), null);
  assert.equal(describeCadence({ freq: "weekly", weekday: 1, hour: 9 }), "Every Monday at 9 AM");
  assert.equal(describeCadence({ freq: "monthly", monthday: 22, hour: 15 }), "Every month on the 22nd at 3 PM");
});

test("poster proposals are cleaned, capped and priced per post", () => {
  const posts = Array.from({ length: 9 }, (_, i) => ({ idea: `Idea ${i}`, headline: `H${i}`, goal: "nope" }));
  const p = cleanProposal({ type: "posters", params: { posts } });
  assert.ok(p);
  assert.equal(p!.type, "posters");
  assert.equal((p!.params.posts as unknown[]).length, 6);
  assert.equal(((p!.params.posts as { goal: string }[])[0]).goal, "awareness");
  assert.equal(costOf("posters", p!.params).credits, 6);
  assert.equal(cleanProposal({ type: "posters", params: { posts: [] } }), null);
  assert.equal(cleanProposal({ type: "delete_everything", params: {} }), null);
});

test("old studio hand-offs become in-chat posters", () => {
  const p = cleanProposal({ type: "brand_posters", params: { brief: "Pongal poster for the 500 g pack with a free tumbler" } });
  assert.equal(p?.type, "posters");
  assert.equal((p!.params.posts as unknown[]).length, 1);
});

test("research proposals map region names to ids", () => {
  const p = cleanProposal({ type: "research", params: { product: "filter coffee", regions: ["Bengaluru", "Atlantis"] } });
  assert.ok(p);
  assert.equal((p!.params.regions as string[]).length, 1);
  assert.equal(costOf("research", p!.params).credits, 0);
});

test("a post needs an idea or a headline", () => {
  assert.equal(cleanPost({}), null);
  assert.equal(cleanPost({ headline: "Fresh roast" })?.idea, "Fresh roast");
});

test("only our own poster storage can replace a poster", () => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  try {
    assert.equal(isOwnPosterUrl("https://abc.supabase.co/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.png"), true);
    assert.equal(isOwnPosterUrl("https://evil.example.com/storage/v1/object/public/campaign-assets/x.png"), false);
    assert.equal(isOwnPosterUrl("https://abc.supabase.co/storage/v1/object/public/other-bucket/x.png"), false);
    assert.equal(isOwnPosterUrl("javascript:alert(1)"), false);
    assert.equal(isOwnPosterUrl("http://abc.supabase.co/storage/v1/object/public/campaign-assets/x.png"), false); // protocol must match ours
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = base;
  }
});

test("poster jobs cut off by the time limit are settled as not charged", () => {
  const job: PosterJobResult = { items: [{ index: 0, status: "done", imageUrl: "x" }, { index: 1, status: "running" }], size: "feed", productName: null, startedAt: "" };
  assert.equal(settleStale(job, new Date().toISOString())?.finishedAt, undefined);
  const old = settleStale(job, new Date(Date.now() - 9 * 60_000).toISOString());
  assert.ok(old?.finishedAt);
  assert.equal(old!.items[0].status, "done");
  assert.equal(old!.items[1].status, "failed");
});

test("web search runs only for fact questions", () => {
  assert.equal(wantsWebFacts("How big is the coffee market in India?"), true);
  assert.equal(wantsWebFacts("What do competitors charge for 500g?"), true);
  assert.equal(wantsWebFacts("Plan this week's posts"), false);
  assert.equal(wantsWebFacts("Write 3 captions for Pongal"), false);
});

test("database dates become ISO strings Safari can read", () => {
  assert.equal(iso("2026-11-23 03:30:00+00"), "2026-11-23T03:30:00.000Z");
  assert.equal(iso(null), "");
});

console.log(`\n${passed} passed`);
