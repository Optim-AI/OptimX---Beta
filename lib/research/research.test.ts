/**
 * Run: npx tsx lib/research/research.test.ts
 */
import assert from "node:assert/strict";
import { normalizeResearch, researchDigest, type BrandResearch } from "./brand-research";
import { normalizeStrategy } from "./product-strategy";
import { parseJsonLoose } from "./gemini";
import { carryResearchForward, researchMatchesBrandName } from "./store";
import type { SiteEvidence } from "./site-crawl";

function section(name: string, fn: () => void) {
  console.log(`=== ${name} ===`);
  fn();
}
function check(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

const site = {
  url: "https://thewholetruthfoods.com/",
  origin: "https://thewholetruthfoods.com",
  domain: "thewholetruthfoods.com",
  platform: "shopify",
  pages: [{ url: "https://thewholetruthfoods.com/", kind: "home", title: "", description: "", headings: [], text: "" }],
  products: [],
  priceRange: null,
  ratings: [],
  testimonials: [],
  trustSignals: [],
  offers: [],
  socialLinks: {},
  navLabels: [],
  ctas: [],
  homeHtml: "",
} as SiteEvidence;

section("parseJsonLoose", () => {
  check("reads fenced and prose-wrapped JSON", () => {
    assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(parseJsonLoose('Here you go: {"a":[1,2]} hope it helps'), { a: [1, 2] });
    assert.equal(parseJsonLoose("no json here"), null);
  });
});

section("normalizeResearch", () => {
  check("drops web-only sections when web research was unavailable", () => {
    const r = normalizeResearch(
      {
        summary: "s",
        competitors: [{ name: "Yoga Bar", positioning: "x" }],
        customer_voice: { their_words: ["chalky"], desires: [{ insight: "taste", basis: "nonsense" }] },
        reputation: { ratings: ["4.9 on Amazon"] },
        market: { sophistication: { stage: 9 } },
      },
      { site, sources: [], webStatus: "unavailable", notes: [] }
    );
    assert.deepEqual(r.competitors, []);
    assert.deepEqual(r.customer_voice.their_words, []);
    assert.deepEqual(r.reputation.ratings, []);
    assert.equal(r.customer_voice.desires[0].basis, "inferred");
    assert.equal(r.market.sophistication.stage, 5);
  });

  check("strips markdown asterisks and caps lists", () => {
    const r = normalizeResearch(
      { summary: "**Bold** read", opportunities: Array.from({ length: 6 }, (_, i) => ({ title: `o${i}` })) },
      { site, sources: [], webStatus: "ok", notes: [] }
    );
    assert.equal(r.summary, "Bold read");
    assert.equal(r.opportunities.length, 3);
  });

  check("digest is plain text with the key reads", () => {
    const r = normalizeResearch(
      { summary: "Premium clean-label bars.", market: { sophistication: { stage: 3, meaning: "claims saturated" }, saturated_claims: ["no added sugar"] } },
      { site, sources: [], webStatus: "ok", notes: [] }
    );
    const d = researchDigest(r);
    assert.ok(d.includes("Premium clean-label bars."));
    assert.ok(d.includes("stage 3"));
    assert.ok(d.includes("no added sugar"));
  });
});

section("normalizeStrategy", () => {
  const ctx = { sources: [], research: "web" as const, alternatives: [] };

  check("drops banned cliché hooks and coerces enums", () => {
    const s = normalizeStrategy(
      {
        angles: [
          { title: "Elevate your snacking", message: "m" },
          { title: "Zero maltitol, zero 4 PM bloat", message: "No sugar alcohols.", insight: "Buyers report bloating", funnel: "consideration", awareness: "Problem-Aware", basis: "web" },
        ],
        campaign_plan: [{ day: "2", goal: "conversion", platform: "TikTok", content_type: "Meme", hook: "h" }],
        positioning: { statement: "For desk workers who…" },
      },
      ctx
    );
    assert.deepEqual(s.angles.map((a) => a.title), ["Zero maltitol, zero 4 PM bloat"]);
    assert.equal(s.angles[0].funnel, "Consideration");
    assert.equal(s.angles[0].awareness, "problem-aware");
    assert.ok(s.angles[0].explanation.includes("Built on: Buyers report bloating"));
    const { day, goal, platform, content_type } = s.campaign_plan[0];
    assert.deepEqual({ day, goal, platform, content_type }, { day: 2, goal: "Conversion", platform: "Instagram Feed", content_type: "Poster Ad" });
    assert.equal(s.campaign_strategy.brief.positioning, "For desk workers who…");
  });
});

section("research storage helpers", () => {
  const research = { version: 1, websiteUrl: "https://www.thewholetruthfoods.com/" } as BrandResearch;

  check("keeps saved research when a snapshot for the same site is saved without it", () => {
    const out = carryResearchForward({ name: "TWT", website_url: "https://thewholetruthfoods.com" }, { research });
    assert.equal(out.research, research);
  });

  check("does not attach research to a different website", () => {
    const out = carryResearchForward({ name: "Other", website_url: "https://other.com" }, { research });
    assert.equal(out.research, undefined);
  });

  check("matches research to a brand by name only when the domain names it", () => {
    assert.equal(researchMatchesBrandName(research, "The Whole Truth"), true);
    assert.equal(researchMatchesBrandName(research, "Yoga Bar"), false);
    assert.equal(researchMatchesBrandName(research, "TW"), false);
  });
});
