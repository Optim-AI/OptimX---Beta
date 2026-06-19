import type { AdFrameworkId, CampaignGoal, HookType, PerformanceStoryboardBeat } from "./strategy-types";

export type AdFramework = {
  id: AdFrameworkId;
  name: string;
  beats: PerformanceStoryboardBeat[];
  description: string;
  bestFor: HookType[];
};

export const AD_FRAMEWORKS: Record<AdFrameworkId, AdFramework> = {
  "hook-problem-solution-cta": {
    id: "hook-problem-solution-cta",
    name: "Hook → Problem → Solution → CTA",
    beats: ["Hook", "Problem", "Solution", "CTA"],
    description: "Classic direct-response. Stop the scroll, name the pain, show the fix, ask for action.",
    bestFor: ["Problem Agitation", "Curiosity Hook", "Product Demonstration"],
  },
  "before-after-proof-cta": {
    id: "before-after-proof-cta",
    name: "Before → After → Proof → CTA",
    beats: ["Before", "After", "Proof", "CTA"],
    description: "Transformation arc. Show the contrast, prove it works, convert.",
    bestFor: ["Before & After", "Testimonial", "Social Proof"],
  },
  "social-proof-demo-benefit-cta": {
    id: "social-proof-demo-benefit-cta",
    name: "Social Proof → Demo → Benefit → CTA",
    beats: ["Social Proof", "Demo", "Benefit", "CTA"],
    description: "Trust-first. Others love it, here's how it works, here's what you get.",
    bestFor: ["Social Proof", "Testimonial", "Product Demonstration"],
  },
  "contrarian-explanation-proof-cta": {
    id: "contrarian-explanation-proof-cta",
    name: "Contrarian → Explanation → Proof → CTA",
    beats: ["Hook", "Explanation", "Proof", "CTA"],
    description: "Challenge a belief, explain the better way, prove it, convert skeptics.",
    bestFor: ["Contrarian", "Curiosity Hook", "Founder Story"],
  },
  "founder-story-journey-solution-cta": {
    id: "founder-story-journey-solution-cta",
    name: "Founder Story → Problem → Journey → Solution → CTA",
    beats: ["Hook", "Problem", "Journey", "Solution", "CTA"],
    description: "Human narrative. Why we built this, the struggle, the breakthrough.",
    bestFor: ["Founder Story", "Testimonial", "Problem Agitation"],
  },
};

const HOOK_TO_FRAMEWORK: Partial<Record<HookType, AdFrameworkId>> = {
  Auto: "hook-problem-solution-cta",
  "Curiosity Hook": "contrarian-explanation-proof-cta",
  "Before & After": "before-after-proof-cta",
  "Social Proof": "social-proof-demo-benefit-cta",
  Contrarian: "contrarian-explanation-proof-cta",
  "Problem Agitation": "hook-problem-solution-cta",
  "Founder Story": "founder-story-journey-solution-cta",
  Testimonial: "social-proof-demo-benefit-cta",
  "Product Demonstration": "social-proof-demo-benefit-cta",
};

const GOAL_HOOK_BIAS: Partial<Record<CampaignGoal, HookType[]>> = {
  "Drive Sales": ["Problem Agitation", "Before & After", "Product Demonstration"],
  "Generate Leads": ["Curiosity Hook", "Social Proof", "Contrarian"],
  "Product Launch": ["Curiosity Hook", "Founder Story", "Product Demonstration"],
  "Build Awareness": ["Contrarian", "Founder Story", "Curiosity Hook"],
  "Retarget Visitors": ["Social Proof", "Before & After", "Testimonial"],
};

export function selectFrameworkForHook(hookType: HookType | string): AdFramework {
  const id = HOOK_TO_FRAMEWORK[hookType as HookType] ?? "hook-problem-solution-cta";
  return AD_FRAMEWORKS[id];
}

export function recommendHookTypes(
  campaignGoal: CampaignGoal | string,
  count = 5
): HookType[] {
  const biased = GOAL_HOOK_BIAS[campaignGoal as CampaignGoal] ?? [
    "Curiosity Hook",
    "Problem Agitation",
    "Social Proof",
    "Product Demonstration",
    "Before & After",
  ];
  const pool: HookType[] = [
    "Curiosity Hook",
    "Before & After",
    "Social Proof",
    "Contrarian",
    "Problem Agitation",
    "Founder Story",
    "Testimonial",
    "Product Demonstration",
  ];
  const ordered = [...new Set([...biased, ...pool])].slice(0, count) as HookType[];
  return ordered;
}

export function getFrameworkBeatsForDuration(
  frameworkId: AdFrameworkId,
  durationSeconds: number
): PerformanceStoryboardBeat[] {
  const framework = AD_FRAMEWORKS[frameworkId];
  const beats = [...framework.beats];
  if (durationSeconds <= 8) return beats;
  // Extended: insert Proof or Agitation between core beats
  if (!beats.includes("Proof") && durationSeconds > 8) {
    const ctaIdx = beats.indexOf("CTA");
    if (ctaIdx > 0) beats.splice(ctaIdx, 0, "Proof");
  }
  if (durationSeconds >= 12 && !beats.includes("Agitation")) {
    const problemIdx = beats.findIndex((b) => b === "Problem");
    if (problemIdx >= 0) beats.splice(problemIdx + 1, 0, "Agitation");
  }
  return beats;
}

export function formatFrameworkForPrompt(frameworkId: AdFrameworkId): string {
  const f = AD_FRAMEWORKS[frameworkId];
  return `${f.name}: ${f.beats.join(" → ")}. ${f.description}`;
}
