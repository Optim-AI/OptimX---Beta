/**
 * Deterministic fixtures for Commercial Director validation / director tests.
 * No live AI.
 */

import type { CampaignBrief } from "../campaign/types";
import type { CommercialBlueprintCore } from "./types";

export function makeValidBrief(overrides: Partial<CampaignBrief> = {}): CampaignBrief {
  return {
    campaignId: "camp_test_001",
    brand: {
      name: "Northline Athletics",
      personality: "honest, energetic, community-first",
      tone: "direct and encouraging",
      primaryColors: ["#1B1B1B", "#E8FF3D"],
    },
    product: {
      name: "Pulse Protein+",
      category: "fitness protein powder",
      description: "Grass-fed whey with no artificial sweeteners for morning training",
      images: [],
      offer: "First bag 20% off",
    },
    targetAudience: "Busy adults restarting a training habit after work",
    marketingObjective: "Drive Sales",
    campaignMessage: "Training sticks when the fuel is simple",
    platform: "instagram_reels",
    aspectRatio: "9:16",
    campaignDuration: 15,
    ...overrides,
  };
}

export function makeValidBlueprint(
  overrides: Partial<CommercialBlueprintCore> = {}
): CommercialBlueprintCore {
  const base: CommercialBlueprintCore = {
    campaignId: "camp_test_001",
    campaignDuration: 15,
    aspectRatio: "9:16",
    createdAt: "2026-09-21T12:00:00.000Z",
    selectedConcept: {
      title: "Kitchen Counter Reset",
      coreIdea: "A rushed evening becomes a deliberate training start with one simple scoop",
      creativeConcept:
        "Intimate after-work kitchen ritual that reframes protein as the decision to begin, not a gym flex",
      emotionalDirection: "Quiet determination → earned confidence",
      visualMetaphor: "The scoop as a small door opening into the workout",
      oneLinePitch: "One scoop turns 'maybe later' into 'I'm already in'",
      campaignFitRationale:
        "Matches busy-adult audience and honest brand tone without fake transformation montage",
    },
    exploredConcepts: [
      {
        id: "explore-1",
        title: "Kitchen Counter Reset",
        coreIdea: "Evening kitchen ritual",
        creativeConcept: "Domestic reset",
        emotionalDirection: "Quiet determination",
        oneLinePitch: "Start before you leave the kitchen",
        narrativeMechanism: "micro-habit story",
        productInteraction: "pour and mix in real kitchen",
        visualLanguage: "warm domestic natural light",
        campaignFitNotes: "strong fit",
      },
      {
        id: "explore-2",
        title: "Commute Clash",
        coreIdea: "City friction vs training intent",
        creativeConcept: "Urban tension then resolve",
        emotionalDirection: "Agitation to release",
        oneLinePitch: "Fuel that survives the city",
        narrativeMechanism: "contrast cut",
        productInteraction: "shaker on the go",
        visualLanguage: "hard daylight and reflective glass",
        campaignFitNotes: "alternate direction",
      },
    ],
    creativeStrategy: {
      campaignGoal: "Drive Sales",
      targetAudience: "Busy adults restarting training after work",
      creativeAngle: "Protein as the decision to begin",
      coreMessage: "Training sticks when the fuel is simple",
      corePainPoint: "Evenings collapse into skipped workouts",
      coreDesire: "Feel like someone who follows through",
      biggestObjection: "Another complicated supplement routine",
      hookType: "Problem Agitation",
      cta: "Get Pulse Protein+",
      conversionObjective: "Drive product purchase",
    },
    visualTreatment: {
      visualStyle:
        "Warm late-afternoon domestic realism with restrained athletic accents — not glossy gym porn",
      lighting:
        "Natural window sidelight with soft falloff across counters; cooler practical under-cabinet for product clarity",
      colorLanguage:
        "Muted oak, ceramic white, and charcoal wardrobe with a single acid-lime accent from brand energy",
      environment:
        "Lived-in apartment kitchen after work — shoes by the door, laptop closed, shaker waiting",
      cameraLanguage:
        "Intimate handheld with deliberate slow pushes into hands and product; avoid frantic whip-pans",
      lensLanguage:
        "35–50mm equivalent, shallow depth for tactile food/powder detail, deeper stop for end hero",
      texture:
        "Matte ceramic, condensation on glass, powder grain detail, fabric of training clothes",
      productionDesign:
        "Real props only — no sterile showroom kitchen; brand colors appear as objects not overlays",
      typographyDirection:
        "No on-screen captions or logos; end with product package as the only brand lock",
      motionLanguage:
        "Human-scale gestures: scoop, pour, seal; camera motion motivated by hand paths",
      pacing:
        "Measured open, slight acceleration through mix, held stillness on first sip / resolve",
    },
    visualBeats: [
      {
        id: "beat-1",
        zone: "hook",
        purpose: "Establish exhausted after-work inertia",
        timestampStartSeconds: 0,
        timestampEndSeconds: 3,
        emotion: "Fatigue",
        intent: "Door close, bag drop, kitchen lights — life interrupting training intent",
        productVisible: false,
        productVisibility: "none",
      },
      {
        id: "beat-2",
        zone: "tension",
        purpose: "Agitate the skip-workout moment",
        timestampStartSeconds: 3,
        timestampEndSeconds: 6,
        emotion: "Friction",
        intent: "Glance at clock / phone; hesitation at the counter",
        productVisible: false,
        productVisibility: "implied",
      },
      {
        id: "beat-3",
        zone: "product_enter",
        purpose: "Product enters as the simple decision",
        timestampStartSeconds: 6,
        timestampEndSeconds: 10,
        emotion: "Focus",
        intent: "Hands scoop Pulse Protein+; packaging readable in natural light",
        productVisible: true,
        productVisibility: "partial",
      },
      {
        id: "beat-4",
        zone: "resolve",
        purpose: "Hero product and resolve",
        timestampStartSeconds: 10,
        timestampEndSeconds: 15,
        emotion: "Confidence",
        intent: "Stable product hero with shaker; quiet readiness to leave for training",
        productVisible: true,
        productVisibility: "hero",
      },
    ],
    editorialPlan: {
      storyStructure: "inertia → hesitation → simple action → resolve",
      pacing: "slow → build → hold",
      transitionStrategy: "motivated cuts on gesture; no trendy whip transitions",
      cuttingRhythm: "longer opens, tighter on hands/product, settle on hero",
      heroMomentSeconds: 12,
    },
    soundDesignIntent: {
      music: "Low pulse electronic that blooms after the scoop",
      voiceover: "Sparse, honest lines — optional",
      soundEffects: "Bag drop, scoop, shaker seal",
      silenceStrategy: "Brief quiet before first scoop",
    },
    productStrategy: {
      visibilityRequirements:
        "Product packaging readable when it enters; full hero in final beat only",
      heroMoments: ["Final countertop hero with label crisp"],
      identityLock: "Pulse Protein+ tub label, colors, and lid must match reference",
      avoidRegeneratingProductWhenReferenceExists: true,
      firstAppearanceSeconds: 6,
      becomesImportantSeconds: 8,
      prominence: "Earned mid-spot — not forced into opening",
      interaction: "Scoop and mix — human hands, careful physics",
      packagingVisibility: "Label forward in hero; avoid warped text",
      revealStrategy: "Appears naturally on the counter as the decision object",
      finalCtaFrame: "Product + shaker held on counter; no text CTA overlay",
    },
    brandStrategy: {
      personality: "honest, energetic, community-first",
      message: "Training sticks when the fuel is simple",
      doNotLookGeneric: "Avoid generic gym montage, neon fitness clichés, and stock hero lighting",
      differentiation: "Domestic honesty over hyper-athletic spectacle",
      tone: "direct and encouraging",
      visualIdentity: "Charcoal + acid-lime accents in real environments",
      communicationStyle: "Plainspoken, no hype voiceover",
      constraints: ["No invented celebrity endorsements"],
      unknowns: [],
    },
    platformStrategy: {
      platform: "instagram_reels",
      aspectRatio: "9:16",
      safeAreas: "Keep faces and product out of top/bottom UI chrome",
      firstFrameHook: "Immediate after-work kitchen friction in first second",
      framing: "Vertical medium-close, hands and face readable",
      pacingInfluence: "Hook in first 1–2s for Reels scroll-stop",
      textUsage: "No captions or sticker text",
      hookTiming: "Pattern interrupt by 1.5s",
      composition: "Center-weighted product in lower third for vertical",
      ctaStrategy: "End-frame product clarity; verbal CTA only if VO used",
    },
    continuityLock: {
      character: "Same adult mid-30s, short dark hair, tired-then-focused expression",
      wardrobe: "Charcoal tee and dark joggers throughout",
      location: "Same apartment kitchen, evening",
      lighting: "Window sidelight + under-cabinet practicals",
      timeOfDay: "Early evening after work",
      product: "Pulse Protein+ tub identity lock",
      colorGrade: "Warm neutrals with lime accent; no teal-orange Instagram grade",
      visualTreatmentSummary:
        "Warm domestic athletic realism with restrained brand accent",
    },
    commercialQCRequirements: {
      checks: [
        "product_identity",
        "visual_treatment",
        "continuity",
        "product_visibility",
        "artifact_risk",
        "campaign_relevance",
      ],
      productIdentity: "Tub label matches Pulse Protein+ reference",
      brandConsistency: "Tone stays honest/energetic — not luxury perfume ad",
      visualContinuity: "Same person, wardrobe, kitchen, evening light",
      conceptAdherence: "Follows Kitchen Counter Reset — not a gym montage",
      productVisibility: "Product absent early; clear mid-to-late",
      visualTreatmentConsistency: "Domestic warm system held through all beats",
      artifactRiskChecks: ["Packaging text warp", "Hand/scoop physics"],
    },
    commercialQC: {
      passed: false,
      score: 0,
      severity: "info",
      recommendedAction: "manual_review",
      issues: [
        {
          check: "product_identity",
          severity: "info",
          message: "Pending QC: product_identity",
        },
      ],
    },
    artifactRisks: [
      {
        id: "risk-1",
        category: "product_packaging",
        description: "Label/text on protein tub may warp or invent brand marks",
        severity: "high",
        mitigation: "Use product reference images; keep packaging hero angles simple",
      },
      {
        id: "risk-2",
        category: "hands_interaction",
        description: "Scooping hands may morph or multiply fingers",
        severity: "medium",
        mitigation: "Prefer clear single-hand actions; avoid extreme close finger contortions",
      },
    ],
  };

  return { ...base, ...overrides };
}
