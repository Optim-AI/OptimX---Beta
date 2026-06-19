/** Performance marketing creative strategy types */

export type CreativeFormat =
  | "UGC"
  | "Commercial"
  | "Lifestyle"
  | "Product Showcase"
  | "Motion Graphics"
  | "Cinematic";

export type HookType =
  | "Auto"
  | "Curiosity Hook"
  | "Before & After"
  | "Social Proof"
  | "Contrarian"
  | "Problem Agitation"
  | "Founder Story"
  | "Testimonial"
  | "Product Demonstration";

export type CampaignGoal =
  | "Drive Sales"
  | "Generate Leads"
  | "Product Launch"
  | "Build Awareness"
  | "Retarget Visitors";

export type AudienceType =
  | "Auto"
  | "Consumers"
  | "Businesses"
  | "Startup Founders"
  | "Enterprise Teams"
  | "Marketers";

export type AdFrameworkId =
  | "hook-problem-solution-cta"
  | "before-after-proof-cta"
  | "social-proof-demo-benefit-cta"
  | "contrarian-explanation-proof-cta"
  | "founder-story-journey-solution-cta";

export type ProductIntelligence = {
  industry: string;
  emotionType: string;
  purchaseIntent: "low" | "medium" | "high";
  awarenessLevel: "unaware" | "problem-aware" | "solution-aware" | "product-aware";
  buyerType: string;
};

export type CreativeStrategy = {
  targetAudience: string;
  corePainPoint: string;
  coreDesire: string;
  biggestObjection: string;
  campaignGoal: CampaignGoal | string;
  hookType: HookType | string;
  creativeAngle: string;
  cta: string;
  conversionObjective: string;
  marketAwarenessLevel?: string;
  emotionalDrivers?: string[];
  frameworkId?: AdFrameworkId;
  productIntelligence?: ProductIntelligence;
};

export type AdConcept = {
  id: string;
  title: string;
  hookType: HookType | string;
  creativeAngle: string;
  frameworkId: AdFrameworkId;
  rationale: string;
  predictedStrength: "high" | "medium" | "experimental";
  cta: string;
  oneLinePitch: string;
};

export type CreativeScore = {
  hookStrength: number;
  scrollStopPotential: number;
  emotionalImpact: number;
  clarity: number;
  trustFactor: number;
  conversionPotential: number;
  overallScore: number;
  feedback?: string[];
};

export type PerformanceStoryboardBeat =
  | "Hook"
  | "Problem"
  | "Agitation"
  | "Solution"
  | "Proof"
  | "CTA"
  | "Before"
  | "After"
  | "Demo"
  | "Benefit"
  | "Explanation"
  | "Journey"
  | "Social Proof";

export type PerformanceStoryboardScene = {
  scene: number;
  beat: PerformanceStoryboardBeat | string;
  marketing_message: string;
  visual_description: string;
  duration: string;
  time_range?: string;
  on_screen_text: string;
  emotion: string;
  motion_style: string;
  voiceover_line: string;
  proof_element?: string;
};
