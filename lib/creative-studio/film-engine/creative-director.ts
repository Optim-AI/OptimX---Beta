/**
 * OptimX Film Engine — Creative Director (master decision engine).
 *
 * Nothing else in the system decides anything until this runs. It converts a
 * creative brief + strategy + product intelligence into a single
 * `CreativeDirection` object. Every downstream engine (scene graph, physics,
 * editor, compressor, renderer) reads this and EXECUTES it — none of them
 * re-decide emotion, pacing, camera, or product timing.
 */

import { classifyProduct } from "../product-intelligence";
import {
  getFrameworkBeatsForDuration,
  selectFrameworkForHook,
} from "../ad-frameworks";
import type { AdFrameworkId } from "../strategy-types";
import { getFilmStyle, getFilmStyleById } from "./film-styles";
import type {
  AttentionCue,
  CreativeDirection,
  CreativeDirectorInput,
  EmotionalBeat,
  FilmStyle,
  PacingProfile,
  ProductRevealStrategy,
} from "./types";

/** Canonical emotional arc for a performance ad. Zones are progress windows. */
const BASE_EMOTIONAL_ARC: EmotionalBeat[] = [
  { zone: "0-20%", emotion: "Curiosity", intent: "Pattern interrupt — stop the scroll, open a loop" },
  { zone: "20-40%", emotion: "Tension", intent: "Agitate the pain or unmet desire; raise the stakes" },
  { zone: "40-60%", emotion: "Discovery", intent: "Reveal the product as the earned answer" },
  { zone: "60-80%", emotion: "Satisfaction", intent: "Show proof / transformation; let the benefit land" },
  { zone: "80-100%", emotion: "Resolution", intent: "Payoff, confidence, brand lock-in, clear CTA" },
];

function pacingForStyleAndDuration(style: FilmStyle, durationSeconds: number): PacingProfile {
  // Shorter ads skew punchier regardless of style.
  if (durationSeconds <= 6) {
    if (style.pacing === "slow-burn" || style.pacing === "measured") return "punchy";
  }
  return style.pacing;
}

function buildAudiencePsychology(input: CreativeDirectorInput, buyerType: string, emotionType: string): string {
  const s = input.creativeStrategy;
  const audience = s?.targetAudience || buyerType;
  const pain = s?.corePainPoint || "an unmet need the product resolves";
  const desire = s?.coreDesire || emotionType;
  const objection = s?.biggestObjection;
  return [
    `Audience: ${audience}.`,
    `Core pain: ${pain}.`,
    `Core desire: ${desire}.`,
    objection ? `Objection to overcome: ${objection}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCoreMessage(input: CreativeDirectorInput, productName: string, brandName: string): string {
  const s = input.creativeStrategy;
  const benefit =
    input.keyMessage ||
    s?.coreDesire ||
    input.userDescription ||
    `why ${productName} is worth buying`;
  const brandPart = brandName ? `${brandName} ` : "";
  return `${brandPart}${productName}: ${benefit}`.replace(/\s+/g, " ").trim();
}

/** Build the viewer attention plan — what the eye tracks, how long, and why it moves. */
function buildAttentionPlan(
  totalDurationSeconds: number,
  productRevealAt: number,
  style: FilmStyle
): AttentionCue[] {
  const dwell = style.pacing === "rapid" ? 1.2 : style.pacing === "slow-burn" ? 2.5 : 1.8;
  return [
    {
      focus: "Subject's face / opening visual hook",
      durationSeconds: Math.min(dwell, totalDurationSeconds * 0.2),
      emotion: "Curiosity",
      moveTrigger: "Subject's gaze or gesture leads the eye toward the problem",
    },
    {
      focus: "The problem / context in the environment",
      durationSeconds: dwell,
      emotion: "Tension",
      moveTrigger: "Hand reaches for the product — motion carries attention",
    },
    {
      focus: `The product (clear reveal ~${productRevealAt}s)`,
      durationSeconds: dwell,
      emotion: "Discovery",
      moveTrigger: "Product action (open, pour, apply) pulls focus to the benefit",
    },
    {
      focus: "Benefit / transformation on subject or result",
      durationSeconds: dwell,
      emotion: "Satisfaction",
      moveTrigger: "Resolved expression draws the eye to the hero frame",
    },
    {
      focus: "Hero product + brand lock-in",
      durationSeconds: Math.min(dwell, totalDurationSeconds * 0.2),
      emotion: "Resolution",
      moveTrigger: "End on stable hero — CTA lands in the final beat",
    },
  ];
}

function buildProductReveal(
  totalDurationSeconds: number,
  style: FilmStyle,
  productName: string
): ProductRevealStrategy {
  // Premium/luxury reveal a touch later (build desire); UGC/hook reveal earlier.
  const revealRatio =
    style.emotionalWeight === "premium"
      ? 0.55
      : style.id === "ugc_authentic" || style.id === "redbull_punchy"
        ? 0.4
        : 0.5;
  return {
    revealAtSeconds: Math.max(1, Math.round(totalDurationSeconds * revealRatio)),
    revealStyle:
      style.emotionalWeight === "premium"
        ? "earned hero reveal with deliberate camera and light"
        : "revealed naturally inside the story action, not a random insert",
    heroMoment: `Final ${productName} hero frame, stable hold, label crisp and true to reference`,
  };
}

/**
 * Run the Creative Director. Pure function — deterministic given the same input.
 * This output is the contract every other engine executes against.
 */
export function buildCreativeDirection(input: CreativeDirectorInput): CreativeDirection {
  const productName = input.productName?.trim() || "the product";
  const brandName = input.brandName?.trim() || "";
  const totalDurationSeconds = Math.max(4, Math.round(input.totalDurationSeconds || 8));

  const intel = classifyProduct(input.productName, input.category, input.userDescription);

  const style = input.filmStyleId
    ? getFilmStyleById(input.filmStyleId)
    : getFilmStyle(input.creativeFormat, input.style, input.userDescription, intel.industry);

  const s = input.creativeStrategy;
  const hookType = s?.hookType || input.hookType || "Auto";
  const cta = input.cta || s?.cta || "Shop now";
  const campaignObjective =
    s?.conversionObjective || s?.campaignGoal || input.campaignGoal || "Drive sales";

  const frameworkId: AdFrameworkId | undefined =
    s?.frameworkId ?? selectFrameworkForHook(hookType).id;
  // Touch the duration-aware beats so the framework drives later scene-graph build.
  if (frameworkId) getFrameworkBeatsForDuration(frameworkId, totalDurationSeconds);

  const pacingCurve = pacingForStyleAndDuration(style, totalDurationSeconds);
  const productRevealStrategy = buildProductReveal(totalDurationSeconds, style, productName);

  const direction: CreativeDirection = {
    campaignObjective,
    audiencePsychology: buildAudiencePsychology(input, intel.buyerType, intel.emotionType),
    coreMessage: buildCoreMessage(input, productName, brandName),
    hookType,
    cta,
    frameworkId,

    emotionalJourney: BASE_EMOTIONAL_ARC,
    viewerAttentionPlan: buildAttentionPlan(
      totalDurationSeconds,
      productRevealStrategy.revealAtSeconds,
      style
    ),

    productRevealStrategy,

    pacingCurve,
    visualHierarchy: [
      "1. Hook execution",
      "2. Product clarity",
      "3. Benefit / proof",
      "4. Emotion",
      "5. Brand",
      "6. Cinematography",
    ],
    cameraIntent: style.cameraLanguage,
    lightingIntent: style.lightingLanguage,
    editingStyle: style.editingGrammar,
    soundIntent:
      style.emotionalWeight === "raw"
        ? "natural ambient + honest VO; minimal music"
        : "premium underscore that builds; VO forward; foley synced to product action",
    performanceStyle:
      style.id === "ugc_authentic"
        ? "real person, spontaneous, slightly imperfect delivery"
        : "controlled, confident talent; natural micro-expressions",
    realismLevel: style.realismLevel,
    cinematicReferences: style.references,

    filmStyle: style,

    totalDurationSeconds,
    productName,
    brandName,
    category: input.category,
  };

  return direction;
}

/** Compact human-readable digest of the direction (for logs / prompt headers). */
export function summarizeCreativeDirection(d: CreativeDirection): string {
  return [
    `Style: ${d.filmStyle.label} (${d.pacingCurve}).`,
    `Objective: ${d.campaignObjective}. Hook: ${d.hookType}. CTA: ${d.cta}.`,
    `Message: ${d.coreMessage}.`,
    `Product reveal ~${d.productRevealStrategy.revealAtSeconds}s.`,
    `Arc: ${d.emotionalJourney.map((b) => b.emotion).join(" → ")}.`,
  ].join(" ");
}
