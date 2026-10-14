/**
 * Deterministic text helpers for carousel story validation and campaign checks.
 */

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how in into is it its of on or our so that the their this to with you your we will can more most just get".split(
    " "
  )
);

export function contentTokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9%₹$€£\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

/** Jaccard similarity of content tokens, 0–1 */
export function textSimilarity(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

const QUANTIFIED_CLAIM =
  /\b\d+(?:[.,]\d+)?\s?(?:g|gm|grams?|mg|kg|ml|l|litres?|liters?|%|x|hrs?|hours?|mins?|minutes?|days?|weeks?|months?|calories|kcal|servings?|steps?)\b/gi;
const PROOF_LANGUAGE =
  /\b(award(?:-winning)?|testimonials?|rated|ratings?|reviews?|customers love|best[\s-]?sell(?:er|ing)|#\s?1|number one|trusted by|clinically|dermatologist|doctor[\s-]recommended|\d[\d,]*\+?\s(?:happy\s)?customers)\b/gi;
const PRICE_LANGUAGE =
  /([₹$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d+\s?%\s?off\b|\bdiscount(?:ed)?\b|\bsale\b|\bfree shipping\b|\bbogo\b|\bbuy one get one\b)/gi;

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matches(text: string, re: RegExp): string[] {
  return [...(text.matchAll(re) || [])].map((m) => normalizeForMatch(m[0]));
}

export type GroundingCorpus = {
  /** Lower-cased facts the copy may rely on */
  text: string;
};

export function buildGroundingCorpus(parts: Array<string | null | undefined>): GroundingCorpus {
  return {
    text: normalizeForMatch(parts.filter(Boolean).join(" \n ")),
  };
}

function grounded(corpus: GroundingCorpus, phrase: string): boolean {
  const p = normalizeForMatch(phrase);
  if (!p) return true;
  if (corpus.text.includes(p)) return true;
  // "26g" vs "26 g"
  return corpus.text.replace(/\s+/g, "").includes(p.replace(/\s+/g, ""));
}

/** Returns human-readable reasons for each ungrounded claim in `copy` */
export function findUnsupportedClaims(
  copy: string,
  corpus: GroundingCorpus
): string[] {
  const out: string[] = [];
  for (const q of matches(copy, QUANTIFIED_CLAIM)) {
    if (!grounded(corpus, q)) out.push(`quantified claim "${q}" is not in the product facts`);
  }
  for (const p of matches(copy, PROOF_LANGUAGE)) {
    if (!grounded(corpus, p)) out.push(`proof/award language "${p}" has no supporting evidence`);
  }
  for (const p of matches(copy, PRICE_LANGUAGE)) {
    if (!grounded(corpus, p)) out.push(`price/offer "${p}" is not supported by the brief`);
  }
  return [...new Set(out)];
}

export function containsPhrase(haystack: string, needle: string): boolean {
  const n = normalizeForMatch(needle);
  return !!n && normalizeForMatch(haystack).includes(n);
}

/** unit → set of numeric values seen (for contradiction detection) */
export function quantifiedValuesByUnit(text: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const m of text.matchAll(QUANTIFIED_CLAIM)) {
    const raw = normalizeForMatch(m[0]);
    const num = raw.match(/\d+(?:[.,]\d+)?/)?.[0] || "";
    const unit = raw.replace(num, "").trim().replace(/s$/, "");
    if (!unit) continue;
    if (!map.has(unit)) map.set(unit, new Set());
    map.get(unit)!.add(num);
  }
  return map;
}

export function hasProofEvidence(corpus: GroundingCorpus): boolean {
  return matches(corpus.text, PROOF_LANGUAGE).length > 0;
}

export function slugifyRole(raw: string): string {
  const full = (raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (full.length <= 32) return full || "slide";
  const cut = full.slice(0, 33);
  const boundary = cut.lastIndexOf("_");
  return (boundary > 0 ? cut.slice(0, boundary) : full.slice(0, 32)) || "slide";
}

export function titleCase(raw: string): string {
  return (raw || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}
