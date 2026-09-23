/**
 * MarketingStrategy validation / quality gate — Phase 4.
 * No visual-design fields allowed.
 */

import { assertMarketingStrategyShape } from "../guards";
import type { MarketingStrategy } from "../types";
import type { ProductContext } from "../context/product-context";
import type { DetectedUserOverrides } from "./strategy-input";
import { PosterStrategyError } from "./strategy-errors";

const VISUAL_LEAK_PATTERNS =
  /\b(camera|lens|lighting|composition|layout|typography|font|palette|background|centered product|product placement|graphic element|photography style|image prompt|dark black background|gold typography)\b/i;

export function normalizeStrategyRaw(
  raw: unknown,
  meta: {
    id: string;
    briefId: string;
    createdAt: string;
    userOverrides: DetectedUserOverrides;
  }
): MarketingStrategy {
  if (!raw || typeof raw !== "object") {
    throw new PosterStrategyError({
      code: "MALFORMED_MODEL_OUTPUT",
      message: "Strategy model returned non-object",
      stage: "normalize",
      retryable: true,
    });
  }
  const r = raw as Record<string, any>;
  const copy = r.copy && typeof r.copy === "object" ? r.copy : {};

  const strategy: MarketingStrategy = {
    id: meta.id,
    briefId: meta.briefId,
    createdAt: meta.createdAt,
    objective: String(r.objective || "custom").trim() || "custom",
    audience: String(r.audience || "").trim() || "General consumers",
    primaryMessage: String(r.primaryMessage || "").trim(),
    communicationAngle: String(r.communicationAngle || "").trim(),
    valueProposition: String(r.valueProposition || "").trim(),
    emotionalDirection: String(r.emotionalDirection || "").trim(),
    rationale: String(r.rationale || "").trim(),
    supportingMessages: Array.isArray(r.supportingMessages)
      ? r.supportingMessages.map(String).filter(Boolean).slice(0, 5)
      : [],
    copy: {
      headline: String(copy.headline || "").trim(),
      supporting: copy.supporting != null ? String(copy.supporting).trim() : null,
      productLine:
        copy.productLine != null ? String(copy.productLine).trim() : null,
      cta: copy.cta != null && String(copy.cta).trim() ? String(copy.cta).trim() : null,
      badges: Array.isArray(copy.badges)
        ? copy.badges.map(String).filter(Boolean).slice(0, 4)
        : [],
    },
    informationHierarchy: Array.isArray(r.informationHierarchy)
      ? r.informationHierarchy.map(String).filter(Boolean).slice(0, 8)
      : [],
    allowedClaims: Array.isArray(r.allowedClaims)
      ? r.allowedClaims.map(String).filter(Boolean)
      : [],
    forbiddenClaims: Array.isArray(r.forbiddenClaims)
      ? r.forbiddenClaims.map(String).filter(Boolean)
      : [],
    restrictedClaims: Array.isArray(r.restrictedClaims)
      ? r.restrictedClaims.map(String).filter(Boolean)
      : [],
    requiredDisclaimers: Array.isArray(r.requiredDisclaimers)
      ? r.requiredDisclaimers.map(String).filter(Boolean)
      : [],
    userOverrides: {
      headline: meta.userOverrides.headline,
      cta: meta.userOverrides.cta,
      audience: meta.userOverrides.audience,
      message: meta.userOverrides.message,
      offer: meta.userOverrides.offer,
    },
  };

  // Apply user overrides — never overwrite explicit user copy
  if (meta.userOverrides.headline) {
    strategy.copy.headline = meta.userOverrides.headline;
  }
  if (meta.userOverrides.cta) {
    strategy.copy.cta = meta.userOverrides.cta;
  }
  if (meta.userOverrides.audience) {
    strategy.audience = meta.userOverrides.audience;
  }
  if (meta.userOverrides.message) {
    strategy.primaryMessage = meta.userOverrides.message;
  }

  return strategy;
}

export function validateMarketingStrategy(
  strategy: MarketingStrategy,
  product: ProductContext
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];

  if (!assertMarketingStrategyShape(strategy)) {
    issues.push("Strategy failed shape validation");
    return { ok: false, issues };
  }

  if (!strategy.primaryMessage.trim()) {
    issues.push("primaryMessage is required");
  }
  if (!strategy.copy.headline.trim()) {
    issues.push("headline is required");
  }
  if (!strategy.communicationAngle.trim()) {
    issues.push("communicationAngle is required");
  }
  if (!strategy.rationale.trim()) {
    issues.push("rationale is required");
  }
  if (strategy.informationHierarchy.length === 0) {
    issues.push("informationHierarchy must not be empty");
  }

  // No visual design leaks in strategy text fields
  const blob = [
    strategy.objective,
    strategy.primaryMessage,
    strategy.communicationAngle,
    strategy.valueProposition,
    strategy.emotionalDirection,
    strategy.rationale,
    strategy.copy.headline,
    strategy.copy.supporting,
    ...strategy.supportingMessages,
    ...strategy.informationHierarchy,
  ]
    .filter(Boolean)
    .join(" ");
  if (VISUAL_LEAK_PATTERNS.test(blob)) {
    issues.push(
      "Strategy contains visual/design execution language — belongs in Creative Director"
    );
  }

  // Allowed claims must be subset of known factual claims when product has facts
  const factual = new Set(
    (product.factualClaims.value || []).map((c) => c.toLowerCase())
  );
  const benefitSet = new Set(
    (product.benefits.value || []).map((c) => c.toLowerCase())
  );
  if (factual.size > 0 || benefitSet.size > 0) {
    for (const claim of strategy.allowedClaims) {
      const lower = claim.toLowerCase();
      const grounded =
        factual.has(lower) ||
        benefitSet.has(lower) ||
        [...factual, ...benefitSet].some(
          (f) => lower.includes(f) || f.includes(lower)
        );
      if (!grounded) {
        // Soft: if claim looks like invented medical outcome, hard fail
        if (
          /clinically|guaranteed|build muscle|cures|proven to|best in india|#1/i.test(
            claim
          )
        ) {
          issues.push(`Unsupported factual claim elevated: "${claim}"`);
        }
      }
    }
  }

  // Inferred-only facts should not appear as hard allowedClaims without authoritative sibling
  for (const claim of strategy.allowedClaims) {
    if (
      product.category?.confidence === "inferred" &&
      product.category.value &&
      claim.toLowerCase() === product.category.value.toLowerCase()
    ) {
      // category as claim is weak — strip later rather than fail
    }
  }

  // Forbidden must include common unsupported patterns when product has protein etc.
  const forbiddenBlob = strategy.forbiddenClaims.join(" ").toLowerCase();
  if (
    product.factualClaims.value.some((c) => /protein/i.test(c)) &&
    !/clinically|guaranteed|build muscle/i.test(forbiddenBlob)
  ) {
    // auto-augment in quality repair rather than fail
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true };
}

/** Deterministic post-pass: strip unsupported claims, ensure forbidden list */
export function repairStrategyClaims(
  strategy: MarketingStrategy,
  product: ProductContext
): MarketingStrategy {
  const factual = product.factualClaims.value || [];
  const benefits = product.benefits.value || [];
  const grounded = new Set(
    [...factual, ...benefits].map((c) => c.toLowerCase())
  );

  const allowedClaims = strategy.allowedClaims.filter((claim) => {
    const lower = claim.toLowerCase();
    if (/clinically|guaranteed|build muscle faster|cures|#1|best in india/i.test(claim)) {
      return false;
    }
    if (grounded.size === 0) return false; // no facts → no allowed factual claims
    return (
      grounded.has(lower) ||
      [...grounded].some((f) => lower.includes(f) || f.includes(lower))
    );
  });

  // Prefer product factual claims when model returned empty allowed list
  const finalAllowed =
    allowedClaims.length > 0
      ? allowedClaims
      : factual.slice(0, 6);

  const forbidden = Array.from(
    new Set([
      ...strategy.forbiddenClaims,
      "Clinically proven",
      "Guaranteed results",
      "Build muscle faster",
      "#1 in India",
      "Best in India",
    ])
  );

  // Badges should only echo allowed claims / short product facts
  const badges = strategy.copy.badges.filter((b) =>
    finalAllowed.some(
      (a) =>
        a.toLowerCase().includes(b.toLowerCase()) ||
        b.toLowerCase().includes(a.toLowerCase())
    )
  );

  return {
    ...strategy,
    allowedClaims: finalAllowed,
    forbiddenClaims: forbidden,
    copy: { ...strategy.copy, badges },
  };
}
