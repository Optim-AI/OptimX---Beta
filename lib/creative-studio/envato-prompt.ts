/**
 * Envato commercial prompt formula — tone + hook + camera/pacing + emotion + payoff.
 * @see https://elements.envato.com/learn/ai-ad-prompts
 */

const TONE_LINES: Record<string, string> = {
  Energetic: "High-energy, driven tone. Feels focused and determined.",
  Calm: "Warm, gentle tone. Calm and reflective mood.",
  Premium: "Premium tone. Feels refined, calm, and confident.",
  Fun: "Playful, slightly absurd tone. Light, fun energy throughout.",
};

const HOOK_LINES: Record<string, string> = {
  Auto: "Open with an unexpected action or bold visual in the first second.",
  "Curiosity Hook": "Open with intrigue — pattern interrupt in the first second.",
  "Before & After": "Start on the 'before' struggle, then contrast to transformation.",
  "Social Proof": "Start on a close-up reaction or testimonial energy before revealing the product.",
  Contrarian: "Open with a bold contrarian claim that stops the scroll.",
  "Problem Agitation": "Start on the pain moment — relatable frustration immediately.",
  "Founder Story": "Start on an authentic human moment before the product.",
  Testimonial: "Start on a close-up reaction before revealing the scene.",
  "Product Demonstration": "Begin with fast forward motion toward the product in use.",
};

const FORMAT_PACING: Record<string, string> = {
  UGC: "Tight framing, minimal camera drift, fast tempo. Handheld, social-first.",
  Commercial: "Smooth tracking shots, motivated cuts, punchy commercial rhythm.",
  Lifestyle: "Handheld with gentle imperfection, casual organic pacing.",
  "Product Showcase": "Slow push-in, steady camera, product-hero framing.",
  "Motion Graphics": "Dynamic graphic energy, fast cuts, bold motion.",
  Cinematic: "Smooth tracking shots, shallow depth of field, cinematic pacing.",
};

export function buildEnvatoCommercialDirective(opts: {
  tone?: string;
  hookType?: string;
  creativeFormat?: string;
  keyMessage?: string;
}): string {
  const tone = TONE_LINES[opts.tone || ""] || TONE_LINES.Energetic;
  const hook =
    HOOK_LINES[opts.hookType || ""] || HOOK_LINES.Auto;
  const pacing =
    FORMAT_PACING[opts.creativeFormat || ""] || FORMAT_PACING.Commercial;
  const emotion = opts.keyMessage?.trim()
    ? `Emotional direction: ${opts.keyMessage.trim()}. Moment should feel relatable and conversion-focused.`
    : "Emotional direction: relatable everyday emotion — trustworthy and aspirational, not exaggerated.";

  return [
    "Commercial structure (Envato formula):",
    `Tone: ${tone}`,
    `Hook: ${hook}`,
    `Camera & pacing: ${pacing}`,
    emotion,
    "Payoff: End on a clean product hero reveal with space for brand lock-in and CTA.",
  ].join(" ");
}
