/**
 * The owner's Brand Kit rules ("Every poster must include", "Do", "Don't"),
 * shaped for the two places that need them: the copywriter (so the words
 * follow the rules) and the image prompt (so the picture does).
 */

export type BrandRules = { mustInclude: string[]; dos: string[]; donts: string[] };

const clean = (list: string[] | undefined) =>
  (list ?? []).map((r) => r.trim()).filter(Boolean);

export function hasBrandRules(rules: Partial<BrandRules> | null | undefined): boolean {
  return !!rules && (clean(rules.mustInclude).length + clean(rules.dos).length + clean(rules.donts).length) > 0;
}

/**
 * Exact text a "must include" rule asks to print: quoted words, @handles,
 * #hashtags, web addresses and phone numbers. "Logo in the top-left corner"
 * has none; "@fuelco handle in the footer" gives "@fuelco".
 */
export function printedTextFromRule(rule: string): string[] {
  const out: string[] = [];
  const push = (s: string | undefined) => {
    const v = s?.trim().replace(/[.,;:]+$/, "");
    if (v && v.length <= 80 && !out.includes(v)) out.push(v);
  };
  for (const m of rule.matchAll(/["“”']([^"“”']{2,80})["“”']/g)) push(m[1]);
  for (const m of rule.matchAll(/(^|\s)(@[A-Za-z0-9._]{2,30})/g)) push(m[2]);
  for (const m of rule.matchAll(/(^|\s)(#[A-Za-z0-9_]{2,40})/g)) push(m[2]);
  for (const m of rule.matchAll(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|co|net|org|shop|store|app|io|co\.in)(?:\/[^\s]*)?)/gi)) push(m[1]);
  for (const m of rule.matchAll(/(\+?\d[\d\s-]{8,14}\d)/g)) push(m[1].replace(/\s+/g, " "));
  return out;
}

/** Every exact line the rules require on the poster, in rule order. */
export function requiredPrintedText(rules: Partial<BrandRules> | null | undefined): string[] {
  const out: string[] = [];
  for (const r of clean(rules?.mustInclude)) {
    for (const t of printedTextFromRule(r)) if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Rules block for the copywriter: the words it writes must not break them. */
export function formatBrandRulesForCopy(rules: Partial<BrandRules> | null | undefined): string {
  if (!hasBrandRules(rules)) return "";
  const lines = [
    "These come from the brand owner. Every headline, line and CTA you write must follow them; if a request conflicts with a Don't, the Don't wins.",
    ...clean(rules?.mustInclude).map((r) => `- Every poster must include: ${r}`),
    ...clean(rules?.dos).map((r) => `- Do: ${r}`),
    ...clean(rules?.donts).map((r) => `- Don't: ${r}`),
  ];
  return lines.join("\n");
}

/** Rules block for the image prompt, worded as instructions the model must follow. */
export function formatBrandRulesForImage(rules: Partial<BrandRules> | null | undefined): string {
  if (!hasBrandRules(rules)) return "";
  return [
    "Brand rules from the owner — follow every one exactly; they take priority over the style direction above:",
    ...clean(rules?.mustInclude).map((r) => `- Must include: ${r}`),
    ...clean(rules?.dos).map((r) => `- Do: ${r}`),
    ...clean(rules?.donts).map((r) => `- Never: ${r}`),
  ].join("\n");
}
