/**
 * Concept diversity validation — Phase 5.
 * Detects near-duplicate creative directions (not color/background noise).
 */

import type { CreativeConcept, CreativeTerritory } from "../types";

export type DiversityFingerprint = {
  conceptId: string;
  territory: CreativeTerritory;
  human: string;
  product: string;
  composition: string;
  environment: string;
  typography: string;
  subject: string;
  key: string;
};

export type DiversityValidationResult = {
  ok: boolean;
  issues: string[];
  fingerprints: DiversityFingerprint[];
};

function normalizeHuman(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(none|no human|no people|absent)\b/.test(t)) return "none";
  if (/\b(hands?\s*only|hand)\b/.test(t)) return "hands_only";
  if (/\b(implied|suggestion|silhouette)\b/.test(t)) return "implied";
  if (/\b(partial|cropped|torso)\b/.test(t)) return "partial";
  if (/\b(full|model|person|people|human)\b/.test(t)) return "full";
  return t.slice(0, 24) || "unknown";
}

function normalizeProduct(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(hero|dominant|primary subject|packshot hero)\b/.test(t)) return "hero";
  if (/\b(integrated|in.?scene|belong)\b/.test(t)) return "integrated";
  if (/\b(contextual|supporting|secondary)\b/.test(t)) return "contextual";
  if (/\b(handheld|held|in hand)\b/.test(t)) return "handheld";
  if (/\b(foreground)\b/.test(t)) return "foreground";
  if (/\b(background)\b/.test(t)) return "background";
  if (/\b(ingredient|associated)\b/.test(t)) return "ingredient";
  if (/\b(repeated|pattern)\b/.test(t)) return "repeated";
  return t.slice(0, 24) || "unknown";
}

function normalizeComposition(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(center|centred|centered)\b/.test(t)) return "centered";
  if (/\b(asymmetric|off.?center|editorial crop)\b/.test(t)) return "asymmetric";
  if (/\b(split|diptych|two.?panel)\b/.test(t)) return "split";
  if (/\b(typography.?led|type.?led|type.?forward)\b/.test(t)) return "typography_led";
  if (/\b(negative.?space|whitespace|quiet)\b/.test(t)) return "negative_space";
  if (/\b(hierarchy|layered)\b/.test(t)) return "hierarchy";
  return t.slice(0, 24) || "unknown";
}

function normalizeEnvironment(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(studio|seamless|sweep)\b/.test(t)) return "studio";
  if (/\b(kitchen|breakfast)\b/.test(t)) return "kitchen";
  if (/\b(bathroom|skincare|vanity)\b/.test(t)) return "bathroom";
  if (/\b(cafe|coffee|desk)\b/.test(t)) return "cafe_desk";
  if (/\b(dining|restaurant|table)\b/.test(t)) return "dining";
  if (/\b(outdoor|street|nature)\b/.test(t)) return "outdoor";
  if (/\b(office|workflow|workspace|ui)\b/.test(t)) return "workplace";
  if (/\b(abstract|graphic field|flat)\b/.test(t)) return "abstract";
  if (/\b(festive|seasonal|holiday)\b/.test(t)) return "seasonal";
  return t.slice(0, 24) || "unknown";
}

function normalizeTypography(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(dominant|hero type|large editorial|type.?led|major)\b/.test(t))
    return "dominant";
  if (/\b(restrained|quiet|minimal|supporting)\b/.test(t)) return "restrained";
  if (/\b(bold|graphic|offer.?led|immediate)\b/.test(t)) return "bold_graphic";
  return t.slice(0, 24) || "unknown";
}

function normalizeSubject(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(product)\b/.test(t) && !/\b(human|hand|person)\b/.test(t))
    return "product_focus";
  if (/\b(human|person|model|lifestyle)\b/.test(t)) return "human_focus";
  if (/\b(type|typography|headline)\b/.test(t)) return "type_focus";
  if (/\b(ingredient|feature|ui|interface)\b/.test(t)) return "feature_focus";
  if (/\b(metaphor|conceptual)\b/.test(t)) return "metaphor_focus";
  return t.slice(0, 24) || "unknown";
}

export function fingerprintConcept(concept: CreativeConcept): DiversityFingerprint {
  const human = normalizeHuman(concept.humanPresence);
  const product = normalizeProduct(concept.productTreatment);
  const composition = normalizeComposition(concept.composition);
  const environment = normalizeEnvironment(concept.environment);
  const typography = normalizeTypography(concept.typographyTreatment);
  const subject = normalizeSubject(
    `${concept.subjectTreatment} ${concept.visualStory}`
  );
  const key = [
    concept.territory,
    human,
    product,
    composition,
    environment,
    typography,
    subject,
  ].join("|");

  return {
    conceptId: concept.id,
    territory: concept.territory,
    human,
    product,
    composition,
    environment,
    typography,
    subject,
    key,
  };
}

/**
 * Validate that a concept set explores meaningfully different creative routes.
 * Color/background wording alone does not count as diversity.
 */
export function validateConceptDiversity(
  concepts: CreativeConcept[]
): DiversityValidationResult {
  const issues: string[] = [];
  const fingerprints = concepts.map(fingerprintConcept);

  if (concepts.length <= 1) {
    return { ok: true, issues: [], fingerprints };
  }

  const territorySeen = new Map<string, string>();
  for (const fp of fingerprints) {
    const prev = territorySeen.get(fp.territory);
    if (prev) {
      issues.push(
        `Duplicate territory "${fp.territory}" on concepts ${prev} and ${fp.conceptId}`
      );
    } else {
      territorySeen.set(fp.territory, fp.conceptId);
    }
  }

  const keySeen = new Map<string, string>();
  for (const fp of fingerprints) {
    // Core creative route: territory + human + product + composition
    const coreKey = [fp.territory, fp.human, fp.product, fp.composition].join("|");
    const prev = keySeen.get(coreKey);
    if (prev) {
      issues.push(
        `Near-duplicate creative route (${coreKey}) on concepts ${prev} and ${fp.conceptId}`
      );
    } else {
      keySeen.set(coreKey, fp.conceptId);
    }
  }

  // Detect "same idea, different gradient" — identical human/product/composition across all
  if (concepts.length >= 2) {
    const allSameCore =
      fingerprints.every(
        (fp) =>
          fp.human === fingerprints[0].human &&
          fp.product === fingerprints[0].product &&
          fp.composition === fingerprints[0].composition
      ) &&
      fingerprints.every((fp) => fp.territory === fingerprints[0].territory);
    if (allSameCore) {
      issues.push(
        "All concepts share the same territory, human presence, product treatment, and composition — not creatively diverse"
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues: [...new Set(issues)],
    fingerprints,
  };
}
