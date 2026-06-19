import type { ProductIntelligence } from "./strategy-types";

const CATEGORY_RULES: Array<{
  pattern: RegExp;
  industry: string;
  emotionType: string;
  purchaseIntent: ProductIntelligence["purchaseIntent"];
  awarenessLevel: ProductIntelligence["awarenessLevel"];
  buyerType: string;
}> = [
  {
    pattern: /\b(skin|lotion|moistur|cream|beauty|cosmetic|serum|spf|face)\b/i,
    industry: "Beauty & Skincare",
    emotionType: "Trust + Transformation",
    purchaseIntent: "medium",
    awarenessLevel: "solution-aware",
    buyerType: "Health-conscious consumers",
  },
  {
    pattern: /\b(software|saas|app|platform|api|tool|dashboard|ai)\b/i,
    industry: "SaaS / Technology",
    emotionType: "Efficiency + ROI",
    purchaseIntent: "medium",
    awarenessLevel: "problem-aware",
    buyerType: "Business decision-makers",
  },
  {
    pattern: /\b(fitness|gym|protein|workout|supplement|athletic)\b/i,
    industry: "Fitness & Wellness",
    emotionType: "Transformation + Status",
    purchaseIntent: "high",
    awarenessLevel: "problem-aware",
    buyerType: "Aspirational self-improvers",
  },
  {
    pattern: /\b(finance|insurance|invest|loan|bank|credit)\b/i,
    industry: "Finance",
    emotionType: "Trust + Security",
    purchaseIntent: "low",
    awarenessLevel: "solution-aware",
    buyerType: "Risk-averse planners",
  },
  {
    pattern: /\b(food|snack|beverage|drink|coffee|tea|pickle|organic)\b/i,
    industry: "Food & Beverage",
    emotionType: "Craving + Trust",
    purchaseIntent: "high",
    awarenessLevel: "product-aware",
    buyerType: "Everyday consumers",
  },
  {
    pattern: /\b(pad|period|hygiene|personal care|sanitary)\b/i,
    industry: "Personal Care",
    emotionType: "Trust + Comfort",
    purchaseIntent: "high",
    awarenessLevel: "product-aware",
    buyerType: "Health-conscious women",
  },
];

export function classifyProduct(
  productName?: string,
  category?: string,
  description?: string
): ProductIntelligence {
  const text = `${productName || ""} ${category || ""} ${description || ""}`.trim();

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return {
        industry: rule.industry,
        emotionType: rule.emotionType,
        purchaseIntent: rule.purchaseIntent,
        awarenessLevel: rule.awarenessLevel,
        buyerType: rule.buyerType,
      };
    }
  }

  return {
    industry: category || "General Consumer",
    emotionType: "Desire + Clarity",
    purchaseIntent: "medium",
    awarenessLevel: "problem-aware",
    buyerType: "General consumers",
  };
}

export function productIntelligenceToPromptBlock(intel: ProductIntelligence): string {
  return [
    `Industry: ${intel.industry}`,
    `Emotional drivers: ${intel.emotionType}`,
    `Purchase intent: ${intel.purchaseIntent}`,
    `Market awareness: ${intel.awarenessLevel}`,
    `Buyer type: ${intel.buyerType}`,
  ].join(". ");
}
