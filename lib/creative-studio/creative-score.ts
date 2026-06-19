import type { CreativeScore, CreativeStrategy, PerformanceStoryboardScene } from "./strategy-types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Heuristic creative score — performance marketing lens, not cinematography. */
export function scoreCreativeScript(input: {
  strategy?: CreativeStrategy | null;
  storyboard?: PerformanceStoryboardScene[] | Array<{ beat?: string; marketing_message?: string; proof_element?: string; visual_description?: string; voiceover_line?: string }>;
  voiceoverScript?: string;
  adAngle?: string;
}): CreativeScore {
  const storyboard = input.storyboard ?? [];
  const vo = (input.voiceoverScript || "").trim();
  const feedback: string[] = [];

  const hasHook = storyboard.some(
    (s) =>
      /hook/i.test(String(s.beat || "")) ||
      /hook|wait|stop|secret|nobody|why/i.test(s.voiceover_line || s.marketing_message || "")
  );
  const hasProblem = storyboard.some((s) => /problem|pain|struggle|frustrat/i.test(String(s.beat || s.marketing_message || "")));
  const hasSolution = storyboard.some((s) => /solution|fix|answer|works/i.test(String(s.beat || s.marketing_message || "")));
  const hasProof = storyboard.some((s) => /proof|testimonial|review|result|before|after|social/i.test(String(s.beat || s.marketing_message || s.proof_element || "")));
  const hasCta = storyboard.some((s) => /cta|buy|shop|try|order|link|get/i.test(String(s.beat || s.marketing_message || s.voiceover_line || "")));

  let hookStrength = hasHook ? 78 : 45;
  if (input.strategy?.hookType && input.strategy.hookType !== "Auto") hookStrength += 8;
  if (!hasHook) feedback.push("Add a stronger pattern-interrupt hook in scene 1.");

  let scrollStopPotential = hookStrength;
  if (storyboard[0]?.visual_description && storyboard[0].visual_description.length > 40) scrollStopPotential += 10;
  if (storyboard.length >= 4) scrollStopPotential += 5;

  let emotionalImpact = 60;
  if (input.strategy?.corePainPoint) emotionalImpact += 12;
  if (input.strategy?.coreDesire) emotionalImpact += 12;
  if (hasProblem) emotionalImpact += 8;

  let clarity = 55;
  if (hasSolution) clarity += 15;
  if (vo.split(/\s+/).length >= 8 && vo.split(/\s+/).length <= 35) clarity += 12;
  if (storyboard.every((s) => (s.marketing_message || s.visual_description || "").length > 10)) clarity += 8;
  if (!hasSolution) feedback.push("Make the product benefit unmistakable in a dedicated solution beat.");

  let trustFactor = 50;
  if (hasProof) trustFactor += 25;
  else feedback.push("Add social proof, results, or demonstration to build trust.");

  let conversionPotential = 50;
  if (hasCta) conversionPotential += 20;
  if (input.strategy?.cta) conversionPotential += 10;
  if (hasSolution && hasCta) conversionPotential += 12;
  if (!hasCta) feedback.push("End with a clear, specific CTA.");

  const scores = [hookStrength, scrollStopPotential, emotionalImpact, clarity, trustFactor, conversionPotential];
  const overallScore = clamp(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    hookStrength: clamp(hookStrength),
    scrollStopPotential: clamp(scrollStopPotential),
    emotionalImpact: clamp(emotionalImpact),
    clarity: clamp(clarity),
    trustFactor: clamp(trustFactor),
    conversionPotential: clamp(conversionPotential),
    overallScore,
    feedback: feedback.length ? feedback : undefined,
  };
}

export const CREATIVE_SCORE_THRESHOLD = 75;

export function meetsCreativeThreshold(score: CreativeScore): boolean {
  return score.overallScore >= CREATIVE_SCORE_THRESHOLD;
}
