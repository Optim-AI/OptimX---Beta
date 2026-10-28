/**
 * Marketing Strategist — Phase 4.
 * Decides WHAT the poster should communicate — never HOW it should look.
 */

import { createDefaultStructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/gemini-structured";
import {
  StructuredGenerationError,
  type StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { MarketingStrategy } from "../types";
import {
  detectUserOverrides,
  formatBrandForStrategist,
  formatProductFactsForStrategist,
  type MarketingStrategistInput,
} from "./strategy-input";
import { PosterStrategyError } from "./strategy-errors";
import {
  normalizeStrategyRaw,
  repairStrategyClaims,
  validateMarketingStrategy,
} from "./strategy-validation";

const SYSTEM_PROMPT = `You are a Marketing Strategist for advertising posters.

Your job: decide WHAT the poster should communicate.
You do NOT decide HOW it should look.

NEVER include: camera, lens, lighting, composition, layout, typography, fonts, color palettes, backgrounds, product placement, photography style, or image prompts.

Rules:
1. USER INTENT has priority over inferred objectives.
2. ONE primary message only — what a viewer should understand in 2 seconds.
3. Use ONLY supported product/brand facts for claims. Do not invent medical outcomes, rankings, or unproven benefits.
4. Inferred product data (confidence=inferred) must NOT become hard factual claims.
5. Audience must be grounded in provided data — no invented demographics.
6. CTA only when useful for the objective; never invent URLs, phones, codes, or dates.
7. Preserve explicit user overrides for headline/CTA/audience/message exactly.
8. Emotional direction is strategic intent, not visual style.
9. If objective is unclear, use "custom".
10. communicationAngle is framing (convenience, urgency, seasonal relevance…) — not "premium dark theme".

Poster copy is ad copy, read in under 3 seconds on a phone:
11. Headline: 2–6 words (up to 8 only when an offer or number needs it). A punchy benefit, offer or proof — not a page title.
    - Never put the brand or product name in the headline; productLine carries it.
    - No colon titles ("X: Y"), no "Introducing…", no "Elevate your…", no exclamation marks unless the brand voice demands it.
12. Lead with what this objective sells:
    - sale / limited_time_offer → the number first ("30% off this weekend").
    - social proof (ratings, reviews, customer counts in the facts) → the proof first ("4.8★ from 12,000+ customers").
    - product_launch → newness ("New. Dark chocolate oats.").
    - product_feature / product_benefit → the benefit as an outcome ("40 hours. One charge.").
    - before/after → the transformation ("Frizz to smooth in one use").
    - seasonal / festive → the occasion + gift ("The Diwali gift they'll open first").
    - awareness → one memorable line about the customer, not the company.
13. supporting: one short line (≤10 words) that adds a new fact — never repeats the headline. Use null when the headline is enough.
14. productLine: just the product name (with size/variant if useful) — no adjectives.
15. CTA: 2–3 words, specific to the objective ("Shop the sale", "Get your audit", "Order by 30 Oct"). Never "Learn more" or "Discover more" for sale, launch or festive objectives.
16. badges: at most 2, each ≤4 words; the offer or proof as a badge when relevant. Never repeat the headline.

Return JSON only matching the schema.`;

function buildUserPrompt(input: MarketingStrategistInput): string {
  const { brief, product, brand, references } = input;
  const overrides = detectUserOverrides(brief);

  const parts: string[] = [];
  parts.push("=== USER INTENT (CreativeBrief) ===");
  parts.push(brief.userInstruction || "(none)");
  if (brief.adGoal) {
    parts.push(
      `Ad goal chosen by the user: ${brief.adGoal} → use objective "${brief.objectiveHint || brief.adGoal}" (the user picked it; do not infer a different one).`
    );
  } else if (brief.objectiveHint) {
    parts.push(`Objective hint: ${brief.objectiveHint}`);
  }
  if (brief.audienceHint) parts.push(`Audience hint: ${brief.audienceHint}`);
  if (brief.offerHint) parts.push(`Offer (exact, from the user): ${brief.offerHint}`);
  if (brief.proofHint) {
    parts.push(
      `Social proof (exact, from the user — an allowed factual claim; lead with it): ${brief.proofHint}`
    );
  }
  if (brief.occasionHint) parts.push(`Occasion: ${brief.occasionHint}`);
  if (brief.transformationHint) {
    parts.push(`Before/after transformation to communicate: ${brief.transformationHint}`);
  }
  if (brief.platformHint) parts.push(`Where it runs: ${brief.platformHint}`);
  if (brief.visualDirection) {
    parts.push(
      `Visual direction chip (emotional/seasonal framing hint only — do NOT invent layout, palette, or photography): ${brief.visualDirection}. If the chip is festive/seasonal, communicationAngle may reflect occasion energy; still no visual art direction here.`
    );
  }
  if (brief.constraints.length) {
    parts.push(`Constraints: ${brief.constraints.join("; ")}`);
  }

  parts.push("\n=== DETECTED USER OVERRIDES (must preserve) ===");
  parts.push(JSON.stringify(overrides));

  parts.push("\n=== PRODUCT FACTS ===");
  parts.push(formatProductFactsForStrategist(product));

  parts.push("\n=== BRAND CONTEXT ===");
  parts.push(formatBrandForStrategist(brand));

  parts.push("\n=== REFERENCES (strategic relevance only) ===");
  parts.push(
    `Product refs: ${references.productReferences.length}; Design refs: ${references.designReferences.length}; Supporting: ${references.supportingReferences.length}`
  );
  parts.push(
    "Design references influence later creative direction — do not copy their look into this strategy."
  );

  parts.push(`\nReturn JSON:
{
  "objective": "one of: product_launch|product_promotion|sale|limited_time_offer|awareness|education|announcement|event_promotion|seasonal_campaign|social_engagement|product_feature|product_benefit|brand_awareness|recruitment|custom",
  "audience": "grounded audience string",
  "primaryMessage": "singular core message",
  "communicationAngle": "framing angle",
  "valueProposition": "from supported facts only",
  "emotionalDirection": "strategic emotion",
  "rationale": "1-2 sentence strategic rationale",
  "supportingMessages": ["optional secondary messages"],
  "copy": {
    "headline": "2–6 words, objective-led (rules 11–12); no product/brand name",
    "supporting": "≤10 words adding a new fact, or null",
    "productLine": "product name only, or null",
    "cta": "2–3 words specific to the objective, or null",
    "badges": ["≤2 short factual badges, ≤4 words each"]
  },
  "informationHierarchy": ["1st notice", "2nd", "..."],
  "allowedClaims": ["only supported factual claims"],
  "forbiddenClaims": ["unsupported claims to avoid"],
  "restrictedClaims": ["soft restrictions"],
  "requiredDisclaimers": []
}`);

  return parts.join("\n");
}

export type GenerateMarketingStrategyOptions = {
  generator?: StructuredGenerator;
  strategyId?: string;
};

export async function generateMarketingStrategy(
  input: MarketingStrategistInput,
  options: GenerateMarketingStrategyOptions = {}
): Promise<MarketingStrategy> {
  if (!input?.brief?.id) {
    throw new PosterStrategyError({
      code: "MISSING_BRIEF",
      message: "CreativeBrief is required",
      stage: "generateMarketingStrategy",
    });
  }

  const generator = options.generator ?? createDefaultStructuredGenerator();
  const overrides = detectUserOverrides(input.brief);
  const id =
    options.strategyId ||
    `strat_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();

  let raw: unknown;
  try {
    const result = await generator.generateJson<Record<string, unknown>>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      schemaName: "poster-marketing-strategy-v1",
      temperature: 0.35,
      maxOutputTokens: 4096,
    });
    raw = result.data;
  } catch (err) {
    if (err instanceof StructuredGenerationError) {
      throw new PosterStrategyError({
        code: "PROVIDER",
        message: err.message || "Strategy provider failed",
        stage: "llm",
        retryable: true,
      });
    }
    throw err;
  }

  let strategy = normalizeStrategyRaw(raw, {
    id,
    briefId: input.brief.id,
    createdAt,
    userOverrides: overrides,
  });

  strategy = repairStrategyClaims(strategy, input.product);

  let quality = validateMarketingStrategy(strategy, input.product);
  if (!quality.ok) {
    // One repair attempt via lower-temperature re-ask is expensive; apply local fixes first
    if (!strategy.rationale.trim()) {
      strategy.rationale =
        "Lead with the clearest supported product differentiator relevant to the requested objective.";
    }
    if (!strategy.informationHierarchy.length) {
      strategy.informationHierarchy = [
        "Primary message",
        "Product identity",
        "Supporting proof",
        "CTA if relevant",
      ];
    }
    if (!strategy.communicationAngle.trim()) {
      strategy.communicationAngle = "product benefit";
    }
    if (!strategy.primaryMessage.trim()) {
      strategy.primaryMessage =
        input.product.shortDescription?.value ||
        input.product.name?.value ||
        "Product communication";
    }
    if (!strategy.copy.headline.trim()) {
      strategy.copy.headline =
        overrides.headline ||
        input.product.factualClaims.value[0] ||
        input.product.name?.value ||
        "Discover more";
    }
    strategy = repairStrategyClaims(strategy, input.product);
    quality = validateMarketingStrategy(strategy, input.product);
  }

  if (!quality.ok) {
    throw new PosterStrategyError({
      code: "VALIDATION",
      message: `Strategy failed quality checks: ${quality.issues.join("; ")}`,
      stage: "validate",
      retryable: true,
    });
  }

  return strategy;
}

/**
 * Build Phase 3-ish ProductContext from Phase 1 brief.product for strategist use
 * when resolvePosterContext was already applied upstream.
 */
export { type MarketingStrategistInput };
