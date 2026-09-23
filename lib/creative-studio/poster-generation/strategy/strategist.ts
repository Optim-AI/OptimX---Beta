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

Return JSON only matching the schema.`;

function buildUserPrompt(input: MarketingStrategistInput): string {
  const { brief, product, brand, references } = input;
  const overrides = detectUserOverrides(brief);

  const parts: string[] = [];
  parts.push("=== USER INTENT (CreativeBrief) ===");
  parts.push(brief.userInstruction || "(none)");
  if (brief.objectiveHint) parts.push(`Objective hint: ${brief.objectiveHint}`);
  if (brief.audienceHint) parts.push(`Audience hint: ${brief.audienceHint}`);
  if (brief.offerHint) parts.push(`Offer hint: ${brief.offerHint}`);
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
    "headline": "from facts + intent",
    "supporting": "optional or null",
    "productLine": "optional product name line or null",
    "cta": "optional CTA or null",
    "badges": ["short factual badges only"]
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
