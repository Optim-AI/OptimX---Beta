/** Shared helpers for Veo video generation prompts and voiceover pacing. */

import {
  buildBeatBasedStoryboardSection,
  buildCompactPipelineDigest,
  buildCompactStoryboardLines,
  buildDirectorLayerBlock,
  buildDirectorLayerCompact,
  buildPostDirectorPipelineLayers,
  buildScriptGenerationPipelineInstructions,
  FILM_GRAMMAR_BLOCK,
  type ExtendedStoryboardScene,
} from "./director-pipeline";

export {
  buildScriptGenerationPipelineInstructions,
  buildDirectorLayerBlock,
  buildDirectorLayerCompact,
  AD_BEAT_SEQUENCE,
  FILM_GRAMMAR_BLOCK,
} from "./director-pipeline";

export const VEO_SEGMENT_SECONDS = 8;
export const SEGMENT_SECONDS = VEO_SEGMENT_SECONDS;
export const VEO_ALLOWED_DURATIONS = [4, 6, 8] as const;
/** Gemini Veo 3.1 text input limit (tokens). */
export const VEO_PROMPT_MAX_TOKENS = 1024;
export type VeoDuration = (typeof VEO_ALLOWED_DURATIONS)[number];

/** Conservative token estimate for Veo prompt budgeting (~1.35 tokens/word). */
export function estimateVeoPromptTokens(text: string): number {
  if (!text?.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (estimateVeoPromptTokens(trimmed) <= maxTokens) return trimmed;
  const maxWords = Math.max(1, Math.floor(maxTokens / 1.35));
  return `${trimmed.split(/\s+/).slice(0, maxWords).join(" ")}…`;
}

/** Join prompt sections, dropping or truncating lowest-priority tail to stay under Veo limit. */
function joinWithinVeoTokenBudget(parts: string[], maxTokens = VEO_PROMPT_MAX_TOKENS): string {
  const sections = parts.map((p) => p.trim()).filter(Boolean);
  let result = "";
  let used = 0;

  for (const part of sections) {
    const partTokens = estimateVeoPromptTokens(part);
    if (used + partTokens <= maxTokens) {
      result = result ? `${result}\n\n${part}` : part;
      used += partTokens;
      continue;
    }
    const remaining = maxTokens - used;
    if (remaining < 20) break;
    const truncated = truncateToTokenBudget(part, remaining);
    if (truncated) result = result ? `${result}\n\n${truncated}` : truncated;
    break;
  }

  return result;
}

export type StoryboardScene = {
  scene?: number;
  time_range?: string;
  duration?: string | number;
  visual_description?: string;
  description?: string;
  emotion?: string;
  mood?: string;
  motion_style?: string;
  camera?: string;
  voiceover_line?: string;
  voiceover_script?: string;
  /** Performance ad beat: Hook, Problem, Discovery, Product, Transformation, Payoff */
  beat?: string;
  marketing_message?: string;
  proof_element?: string;
  shot_purpose?: string;
  transition_to_next?: string;
  emotional_zone?: string;
  dialogue_direction?: string;
  product_state?: string;
  container_state?: string;
};

export type StyleDirectorSpec = {
  role: string;
  aesthetic: string;
  cinematography: string;
  lighting: string;
  pacing: string;
  lensFeel: string;
  references: string;
};

export type VeoPromptInput = {
  brandName?: string;
  productName?: string;
  category?: string;
  userDescription?: string;
  style?: string;
  creativeFormat?: string;
  hookType?: string;
  campaignGoal?: string;
  creativeStrategy?: {
    targetAudience?: string;
    corePainPoint?: string;
    coreDesire?: string;
    biggestObjection?: string;
    campaignGoal?: string;
    hookType?: string;
    creativeAngle?: string;
    cta?: string;
    conversionObjective?: string;
  };
  clipDurationSeconds: number;
  totalDurationSeconds?: number;
  aspectRatio: string;
  segmentIndex?: number;
  segmentCount?: number;
  finalVideoPrompt?: string;
  fallbackPrompt?: string;
  voiceoverScript?: string;
  storyboard?: StoryboardScene[];
  hasReferenceImages: boolean;
  headline?: string;
  subtext?: string;
};

/** Alias for cinematic prompt builder options */
export type BuildVeoVideoPromptOptions = VeoPromptInput;

/** Map requested duration to a Veo-supported clip length (4, 6, or 8). Reference-image mode requires 8s. */
export function normalizeVeoDuration(
  requestedSeconds: number,
  hasReferenceImages = false
): VeoDuration {
  if (hasReferenceImages) return 8;
  const clamped = Math.max(4, Math.min(8, Math.round(requestedSeconds)));
  if (clamped <= 5) return 4;
  if (clamped <= 7) return 6;
  return 8;
}

/** Voiceover budget: leave ~2s at the end for music + hero frame so speech is not cut off. */
export function computeVoiceoverBudget(durationSeconds: number): {
  maxSpokenSeconds: number;
  maxWords: number;
  tailSilenceSeconds: number;
} {
  const duration = Math.max(4, Math.min(120, durationSeconds));
  const tailSilenceSeconds = duration <= 8 ? 2 : 1.5;
  const maxSpokenSeconds = Math.max(
    3,
    Math.min(Math.floor(duration - tailSilenceSeconds), duration <= 8 ? 6 : 15)
  );
  const maxWords = Math.floor(maxSpokenSeconds * 2.2);
  return { maxSpokenSeconds, maxWords, tailSilenceSeconds };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Trim voiceover to max words; prefer keeping full sentences when possible. */
export function truncateVoiceover(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;

  const sentences = trimmed
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    let result = "";
    for (const sentence of sentences) {
      const candidate = result ? `${result} ${sentence}` : sentence;
      if (countWords(candidate) <= maxWords) {
        result = candidate;
      } else {
        break;
      }
    }
    if (result) return result;
  }

  return words.slice(0, maxWords).join(" ");
}

/** Split voiceover into two halves by word count (for stitched 16s videos). */
export function splitVoiceoverForStitch(
  script: string,
  maxWordsPerHalf: number
): { part1: string; part2: string } {
  const trimmed = script.trim();
  if (!trimmed) return { part1: "", part2: "" };

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWordsPerHalf) {
    return { part1: trimmed, part2: "" };
  }

  const midpoint = Math.ceil(words.length / 2);

  const textUpToMid = words.slice(0, midpoint).join(" ");
  const lastSentenceEnd = Math.max(
    textUpToMid.lastIndexOf(". "),
    textUpToMid.lastIndexOf("! "),
    textUpToMid.lastIndexOf("? ")
  );
  if (lastSentenceEnd > 0) {
    const part1Candidate = textUpToMid.slice(0, lastSentenceEnd + 1).trim();
    if (part1Candidate && countWords(part1Candidate) <= maxWordsPerHalf) {
      return {
        part1: part1Candidate,
        part2: words.slice(countWords(part1Candidate)).join(" "),
      };
    }
  }

  return {
    part1: words.slice(0, midpoint).join(" "),
    part2: words.slice(midpoint).join(" "),
  };
}

export function redistributeVoiceoverToStoryboard(
  storyboard: StoryboardScene[],
  voiceoverScript: string
): StoryboardScene[] {
  const script = voiceoverScript.trim();
  if (!storyboard.length) return storyboard;

  const words = script ? script.split(/\s+/).filter(Boolean) : [];
  if (!words.length) {
    return storyboard.map((scene) => ({
      ...scene,
      voiceover_line: "",
      voiceover_script: "",
    }));
  }

  const wordsPerScene = Math.max(1, Math.ceil(words.length / storyboard.length));
  return storyboard.map((scene, idx) => {
    const line = words.slice(idx * wordsPerScene, (idx + 1) * wordsPerScene).join(" ");
    return {
      ...scene,
      voiceover_line: line,
      voiceover_script: line,
    };
  });
}

function parseSceneTimeRange(timeRange: string): { start: number; end: number } | null {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
}

/** Return storyboard scenes that fall within a clip segment (for stitched videos). */
export function filterStoryboardForSegment(
  storyboard: StoryboardScene[] | undefined,
  segmentIndex: number,
  segmentDurationSeconds: number
): StoryboardScene[] {
  if (!storyboard?.length) return [];
  const segStart = segmentIndex * segmentDurationSeconds;
  const segEnd = segStart + segmentDurationSeconds;

  return storyboard.filter((scene) => {
    const range = scene.time_range || "";
    const parsed = parseSceneTimeRange(range);
    if (!parsed) return segmentIndex === 0;
    const midpoint = (parsed.start + parsed.end) / 2;
    return midpoint >= segStart && midpoint < segEnd;
  });
}

/** Director-grade style specs — Tier-1 commercial / ad film level. */
export const VIDEO_STYLE_DIRECTOR_SPECS: Record<string, StyleDirectorSpec> = {
  Hook: {
    role: "Performance creative director — scroll-stopping direct response",
    aesthetic: "High-contrast, punchy, conversion-first. Every frame sells.",
    cinematography: "Tight framing, snap zooms, whip-pans, macro product inserts, handheld energy on hooks",
    lighting: "Hard key light, strong rim, high contrast, bold shadows — never flat or ambient",
    pacing: "Fast cuts every 1–2s. Zero dead air. Hook in frame 1.",
    lensFeel: "35mm wide for impact shots, 85mm macro for product detail",
    references: "TikTok performance ads, DTC scroll-stoppers, high-CTR social commerce",
  },
  Commercial: {
    role: "Premium brand film director — broadcast-quality paid media",
    aesthetic: "Polished, aspirational, product-as-hero. Feels like a Super Bowl spot compressed.",
    cinematography: "Slider dolly moves, slow push-ins, rack focus reveals, hero product orbit, controlled pans",
    lighting: "Three-point studio lighting, soft highlights, controlled specular on product, clean whites",
    pacing: "Confident rhythm: hook → demo → payoff → brand lock. Motivated cuts on beats.",
    lensFeel: "50mm natural perspective for lifestyle, 100mm macro for product texture, shallow T1.8 DOF",
    references: "Apple product films, Nike brand spots, premium DTC broadcast ads",
  },
  "UGC Style": {
    role: "Native social creator director — authentic, not polished",
    aesthetic: "Phone-filmed realism. Imperfect but believable. Trust-first.",
    cinematography: "Selfie angle, slight handheld shake, jump cuts, reaction zooms, POV product handling",
    lighting: "Natural window light or room light — never studio-polished",
    pacing: "Conversational rhythm with jump-cut energy. Feels unscripted.",
    lensFeel: "Phone camera wide (~24mm equivalent), eye-level, arm's length",
    references: "TikTok creator reviews, authentic Reels testimonials",
  },
  "Product Close-up": {
    role: "Product cinematographer — texture, detail, craft",
    aesthetic: "Macro beauty shots. Product is sculpture. Every surface tells quality.",
    cinematography: "Extreme close-ups, slow orbit, rack focus across product features, detail inserts",
    lighting: "Soft box key, gradient backdrop, controlled reflections, highlight roll-off on edges",
    pacing: "Deliberate, luxurious. Let each detail breathe 1–2s before cut.",
    lensFeel: "100mm macro, T2.8 shallow DOF, creamy bokeh background",
    references: "Luxury watch/jewelry commercials, Apple product macro films",
  },
  Lifestyle: {
    role: "Lifestyle film director — human stories around the product",
    aesthetic: "Warm, relatable, aspirational everyday moments. Product integrated naturally.",
    cinematography: "Medium shots in real environments, follow-cam, over-shoulder, golden-hour exteriors",
    lighting: "Natural golden hour or soft window light, warm color temperature (~4800K)",
    pacing: "Flowing narrative arc. Emotional build to product moment.",
    lensFeel: "35mm documentary feel, natural depth, gentle movement",
    references: "Aspirational lifestyle brand films, Patagonia-style human stories",
  },
  Cinematic: {
    role: "Cinematic film director — narrative-driven visual poetry",
    aesthetic: "Film-grade production. Anamorphic feel. Story through light and motion.",
    cinematography: "Crane shots, slow dolly, dramatic reveals, silhouette moments, depth layering",
    lighting: "Motivated cinematic lighting, volumetric rays, chiaroscuro contrast, color-motivated gels",
    pacing: "Deliberate build with emotional crescendo. Cuts serve story beats.",
    lensFeel: "Anamorphic 2.39:1 feel, 35mm/50mm spherical, lens flare on highlights",
    references: "Tier-1 brand films, Ridley Scott aesthetic, high-end automotive spots",
  },
  Luxury: {
    role: "Luxury brand director — exclusivity, refinement, desire",
    aesthetic: "Understated opulence. Slow confidence. Every frame whispers premium.",
    cinematography: "Static hero compositions, imperceptibly slow push-ins, elegant reveals",
    lighting: "Low-key elegant lighting, warm gold accents, deep shadows, silk-smooth gradients",
    pacing: "Slow, deliberate. Minimum 2s per shot. Never rushed.",
    lensFeel: "85mm portrait compression, T1.4 ultra-shallow DOF, creamy falloff",
    references: "Chanel, Rolex, high-fashion brand films",
  },
  Minimalist: {
    role: "Minimal design director — restraint as power",
    aesthetic: "Clean negative space. Product isolated. Zero visual noise.",
    cinematography: "Centered compositions, slow subtle moves, geometric framing",
    lighting: "High-key soft light, white/neutral backgrounds, single soft shadow",
    pacing: "Calm, measured. Long holds. Breathing room between beats.",
    lensFeel: "50mm straight-on, deep focus, clinical precision",
    references: "Muji, Apple minimal product films, Scandinavian design ads",
  },
  "Bold & Energetic": {
    role: "High-energy sports/ad director — maximum visual impact",
    aesthetic: "Kinetic, vibrant, adrenaline. Colors pop. Motion never stops.",
    cinematography: "Whip-pans, speed ramps, dutch angles, rapid match cuts, dynamic tracking",
    lighting: "Saturated colors, bold gel accents, high energy contrast",
    pacing: "Sub-1.5s cuts. Relentless forward momentum. Beat-synced editing.",
    lensFeel: "24mm wide for impact, fast shutter for crisp motion",
    references: "Red Bull, energy drink spots, festival/event promos",
  },
  "2D Animation": {
    role: "Animation director — illustrated brand storytelling",
    aesthetic: "Clean vector/flat illustration. Expressive motion graphics storytelling.",
    cinematography: "Smooth animated camera pans, scale transitions, parallax layers",
    lighting: "Illustrated light/shadow, gradient backgrounds, stylized highlights",
    pacing: "Snappy animated beats. Squash-and-stretch on transitions.",
    lensFeel: "N/A — flat/2.5D illustrated perspective",
    references: "Premium motion design reels, animated explainer spots",
  },
  "Motion Graphics": {
    role: "Motion design director — design-forward kinetic visuals",
    aesthetic: "Graphic elements, shape transitions, dynamic visual flow. No live-action.",
    cinematography: "Element-driven camera, zoom-through transitions, particle reveals",
    lighting: "Neon accents, gradient backgrounds, glow effects",
    pacing: "Rhythmic, design-synced. Every transition is intentional.",
    lensFeel: "N/A — graphic/3D camera space",
    references: "Tech brand launch videos, SaaS product motion reels",
  },
  Retro: {
    role: "Vintage film director — nostalgic analog warmth",
    aesthetic: "Film grain, faded colors, VHS/analog artifacts, nostalgic mood",
    cinematography: "Static or gentle handheld, period-appropriate framing",
    lighting: "Warm tungsten, soft halation, lifted blacks, faded highlights",
    pacing: "Relaxed vintage rhythm. Longer holds with grain texture.",
    lensFeel: "Vintage 50mm soft focus, slight vignette, chromatic aberration",
    references: "80s/90s commercial aesthetic, analog film nostalgia ads",
  },
  "Stop Motion": {
    role: "Stop-motion animation director — tactile craft",
    aesthetic: "Physical, handcrafted feel. Frame-by-frame charm.",
    cinematography: "Locked camera, subtle frame-by-frame object movement",
    lighting: "Even studio lighting, soft shadows, craft-table aesthetic",
    pacing: "Playful stop-motion rhythm. Satisfying object transitions.",
    lensFeel: "50mm tabletop macro perspective",
    references: "Premium stop-motion product ads, handcrafted brand films",
  },
  "3D Animation": {
    role: "CGI director — photoreal or stylized 3D product world",
    aesthetic: "Polished CGI environments. Product as 3D hero asset.",
    cinematography: "Virtual camera orbit, fly-through, particle simulations",
    lighting: "HDRI studio lighting, caustics, realistic material shaders",
    pacing: "Cinematic CGI reveal sequence with build-up.",
    lensFeel: "Virtual 35mm with depth of field pass",
    references: "Premium 3D product renders, tech launch CGI films",
  },
};

const DEFAULT_STYLE_SPEC: StyleDirectorSpec = {
  role: "Award-winning commercial film director",
  aesthetic: "Broadcast-quality brand film. Premium, intentional, every frame composed.",
  cinematography: "Professional multi-shot edit with motivated cuts, dolly/slider moves, rack focus",
  lighting: "Controlled three-point or motivated natural light, consistent color grade",
  pacing: "Clear narrative arc: hook → product → payoff → brand lock-in",
  lensFeel: "35mm/50mm cinematic perspective, shallow DOF on product hero moments",
  references: "Tier-1 agency brand films, premium DTC commercials",
};

export function getStyleDirectorSpec(style?: string): StyleDirectorSpec {
  if (!style) return DEFAULT_STYLE_SPEC;
  return VIDEO_STYLE_DIRECTOR_SPECS[style] || DEFAULT_STYLE_SPEC;
}

export const FILM_MODE_FLAG = "FILM_MODE = true";

export const FILMMAKING_RULE_BLOCK = `
FILMMAKING RULE (CRITICAL):

This is not a montage.

This advertisement must feel like a single cohesive short film.

Every scene must be visually and emotionally connected to the previous scene.

The viewer should feel they are watching one continuous story unfold naturally, not separate clips stitched together.

Each shot must have:
1. Cause from the previous shot
2. Visual continuity
3. Motivated camera movement
4. Emotional progression

Transitions must be motivated by action, movement, eye-line, object interaction, or camera motion.

Avoid random scene jumps.
Avoid slideshow-style storytelling.
Avoid isolated hero shots with no narrative context.

The camera should feel like it is following the story, not generating unrelated visuals.
`.trim();

export const STORY_FLOW_MANDATORY = `
STORY FLOW (MANDATORY):

Scene 1 introduces a problem, desire, or curiosity.
Scene 2 develops that moment naturally.
Scene 3 reveals the product within the story.
Scene 4 demonstrates transformation.
Scene 5 resolves emotionally.
Scene 6 lands on the brand payoff.

Every scene must feel like the next logical moment of the same story.
No disconnected shots.
`.trim();

export const TRANSITION_DESIGN_BLOCK = `
TRANSITION DESIGN:

Scene changes must use:
• Match cuts
• Object continuity
• Camera continuation
• Motion continuation
• Eye-line continuation

Examples:
A hand reaches for the product → next scene begins with that same hand opening it.
Camera pushes toward the product → next scene starts from a closer angle of that same movement.
Character turns → next shot begins completing that turn.

Every cut should feel invisible.
`.trim();

export const CONTINUITY_RULES_BLOCK = `
CONTINUITY RULES:

Maintain the same throughout the film:
• Character appearance
• Clothing
• Hairstyle
• Environment
• Lighting direction
• Color grade
• Time of day

Do not generate different actors.
Do not change environments without narrative reason.
Do not change wardrobe between scenes.

The film should feel captured on the same production day.
`.trim();

export const EMOTIONAL_ARC_BLOCK = `
EMOTIONAL ARC (see EMOTIONAL CURVE SYSTEM for per-shot assignment):

0-20% = Curiosity — pattern interrupt, intrigue
20-40% = Tension — problem, stakes, struggle
40-60% = Discovery — insight, product reveal
60-80% = Satisfaction — proof, transformation
80-100% = Resolution — payoff, brand lock-in

Emotion must gradually increase throughout the film.
Do not keep every shot emotionally neutral.
`.trim();

export const PHYSICAL_REALISM_BLOCK = `
PHYSICAL REALISM (CRITICAL):

All objects must behave according to real-world physics.

Every interaction must follow the complete sequence of actions.
Do not skip mechanical steps.

Examples:

Bottle:
1. Hand grabs bottle
2. Cap is unscrewed
3. Cap is removed
4. Bottle is tilted
5. Liquid pours out

Food Packet:
1. Packet is held
2. Seal is torn open
3. Opening becomes visible
4. Contents are poured

Coffee Jar:
1. Lid is opened
2. Spoon enters jar
3. Coffee is scooped
4. Coffee is transferred

Never show contents exiting a sealed container.
Never show liquids, powders, food, or ingredients appearing magically.
Every output must have a visible source.
`.trim();

export const OBJECT_STATE_TRACKING_BLOCK = `
OBJECT STATE TRACKING:

Every product must maintain logical state. Never jump between states.

Bottle:
Closed → Opened → Pouring → Empty

Food Packet:
Sealed → Torn Open → Open → Pouring

Coffee Cup:
Empty → Filling → Full → Drinking

Jar (powder/granules):
Closed → Lid Removed → Open → Scooping → Transferring

Pump Dispenser:
Idle → Pressed → Dispensing → Released

Tube (toothpaste, cream):
Sealed → Cap Removed → Squeezed → Product Extrudes

Atomizer (perfume, spray):
Capped → Uncapped → Pressed → Mist Disperses

Track state across every scene. The product in scene N must reflect the state earned by scene N-1.
`.trim();

export const REALITY_CHECK_BLOCK = `
REALITY CHECK (PHYSICS SUPERVISOR):

Before rendering every scene, verify: Can this action happen in real life?
If not, regenerate the action.

Reject:
• Liquids leaving closed bottles
• Food exiting unopened packages
• Floating products
• Teleporting objects
• Instant transformations
• Missing cause-and-effect actions
• Different product appearance between scenes (label, color, cap, fill level)
• Powder, liquid, or food with no visible source container

Cause-and-effect gates:
- Did the cap get removed? If NO → liquid cannot pour.
- Did the packet get opened? If NO → powder/food cannot appear.
- Did the person press the pump? If NO → soap/lotion cannot dispense.
- Did the lid get unscrewed? If NO → contents cannot be scooped or poured.
`.trim();

type ProductInteractionProfile = {
  id: string;
  label: string;
  states: string[];
  sequence: string[];
  match: RegExp;
};

const PRODUCT_INTERACTION_PROFILES: ProductInteractionProfile[] = [
  {
    id: "beard_oil",
    label: "Beard oil / dropper bottle",
    states: ["Closed", "Cap removed", "Dropper out", "Tilted", "Drops dispensed", "Applied"],
    sequence: [
      "Pick up bottle",
      "Unscrew cap",
      "Remove dropper",
      "Tilt bottle",
      "Dispense drops into palm or dropper",
      "Apply to beard/skin",
    ],
    match: /beard oil|face oil|hair oil|serum|dropper|essential oil/i,
  },
  {
    id: "bottle_liquid",
    label: "Bottle (liquid pour)",
    states: ["Closed", "Cap unscrewed", "Cap removed", "Tilted", "Pouring", "Empty"],
    sequence: [
      "Hand grabs bottle",
      "Cap is unscrewed",
      "Cap is removed",
      "Bottle is tilted",
      "Liquid pours into target",
    ],
    match: /bottle|shampoo|conditioner|lotion|body wash|juice|drink|beverage|oil/i,
  },
  {
    id: "facewash_pump",
    label: "Foaming facewash / pump bottle",
    states: ["Closed", "Picked up", "Pump pressed", "Foam dispensing", "Applied"],
    sequence: ["Pick up bottle", "Press pump", "Foam dispenses to palm", "Apply to face"],
    match: /\b(facewash|face wash|cleanser|foaming)\b/i,
  },
  {
    id: "food_packet",
    label: "Food / snack packet",
    states: ["Sealed", "Torn open", "Opening visible", "Pouring", "Empty"],
    sequence: [
      "Hold packet",
      "Tear seal open",
      "Opening becomes visible",
      "Pour or tip contents out",
    ],
    match: /(?:\b(packet|pouch|chips|snack|noodle|granola|cereal)\b|\binstant\s+(food|meal|noodle|ramen|snack))/i,
  },
  {
    id: "coffee_jar",
    label: "Coffee jar / powder container",
    states: ["Closed", "Lid opened", "Open", "Scooping", "Transferring"],
    sequence: [
      "Open lid",
      "Spoon enters jar",
      "Coffee/powder is scooped",
      "Transferred to cup or vessel",
    ],
    match: /coffee|instant coffee|protein powder|powder|jar|canister/i,
  },
  {
    id: "toothpaste",
    label: "Toothpaste / squeeze tube",
    states: ["Sealed", "Cap removed", "Squeezed", "Paste extrudes"],
    sequence: ["Open cap", "Squeeze tube", "Paste extrudes onto brush"],
    match: /toothpaste|tooth paste|tube/i,
  },
  {
    id: "perfume",
    label: "Perfume / atomizer spray",
    states: ["Capped", "Uncapped", "Atomizer pressed", "Mist disperses"],
    sequence: ["Remove cap", "Press atomizer", "Mist sprays onto skin or air"],
    match: /perfume|cologne|fragrance|mist|spray/i,
  },
  {
    id: "pump_dispenser",
    label: "Pump dispenser (soap, lotion)",
    states: ["Idle", "Hand on pump", "Pressed", "Dispensing", "Released"],
    sequence: ["Hand positions on pump", "Press pump head", "Product dispenses", "Release"],
    match: /pump|hand soap|hand wash|dispenser|sanitizer/i,
  },
  {
    id: "cup_fill",
    label: "Cup / mug (fill and drink)",
    states: ["Empty", "Filling", "Full", "Lifting", "Drinking"],
    sequence: ["Cup empty on surface", "Liquid poured in", "Cup fills", "Hand lifts cup", "Sip"],
    match: /cup|mug|glass|tumbler/i,
  },
];

const DEFAULT_PRODUCT_INTERACTION_PROFILE: ProductInteractionProfile = {
  id: "generic",
  label: "General product",
  states: ["Idle", "Handled", "Activated", "In use", "Result visible"],
  sequence: [
    "Identify the product object",
    "Show hand/body contact before use",
    "Complete all mechanical steps to activate (open, unscrew, tear, press, scoop)",
    "Show the product working with visible cause and effect",
    "Show the result only after the action sequence",
  ],
  match: /$/,
};

function detectProductInteractionProfile(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): ProductInteractionProfile {
  const haystack = `${input.category || ""} ${input.productName || ""} ${input.userDescription || ""}`;
  return (
    PRODUCT_INTERACTION_PROFILES.find((p) => p.match.test(haystack)) ||
    DEFAULT_PRODUCT_INTERACTION_PROFILE
  );
}

/** Hidden pre-render layer — prop master + continuity + physics checker. */
export function buildProductInteractionValidationBlock(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">,
  scenes?: StoryboardScene[]
): string {
  const profile = detectProductInteractionProfile(input);
  const productLabel = input.productName || "the product";

  const sceneChecklist = (scenes || [])
    .map((scene, idx) => {
      const sceneNum = scene.scene ?? idx + 1;
      const visual = (scene.visual_description || scene.description || "").trim();
      const message =
        (scene as StoryboardScene & { marketing_message?: string }).marketing_message || "";
      if (!visual && !message) return null;
      return [
        `  Scene ${sceneNum}:`,
        `    Visual: ${visual || "(none)"}`,
        message ? `    Intent: ${message}` : "",
        `    Validate: What object? What state is it in? Can this action happen now? If not, insert required mechanical steps first.`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  return `
PRODUCT INTERACTION VALIDATION (INTERNAL — do not skip; validate before rendering):

This is a pre-generation reasoning layer. Act as prop master + continuity supervisor + physics checker.
Do not render any frame until every check passes.

Product: ${productLabel}
Product type: ${profile.label}
Valid state progression: ${profile.states.join(" → ")}

Required interaction sequence for this product type:
${profile.sequence.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Validation chain (apply to EVERY product interaction):
1. What object is being used?
2. What state is it currently in?
3. What action is the scene requesting?
4. Can that action happen in the current state?
5. If NO — list required mechanical steps before rendering.

Example — beard oil:
  Object: beard oil bottle | State: Closed | Action: oil in hand | Can oil come out? NO (bottle closed)
  Required: pick up → unscrew cap → remove dropper → tilt → dispense → apply.

Example — instant noodles:
  Object: noodle packet | State: Sealed | Action: noodles in bowl | Can noodles leave? NO (packet sealed)
  Required: hold packet → tear open → opening visible → pour noodles → add water → stir → serve.

${sceneChecklist.length ? `Per-scene validation checklist:\n${sceneChecklist.join("\n")}` : "No storyboard scenes — still enforce full mechanical sequences for any product use shown."}

REJECT and revise any visual that shows:
- Liquids leaving closed containers
- Food/powder exiting unopened packages
- Contents with no visible source
- Skipped steps (cap removal, seal tear, pump press, lid open)
- State jumps (e.g. Sealed → Pouring without Open)
- Product appearance changes between scenes (label, color, cap, fill level)

Only render after the complete cause-and-effect chain is satisfied.
`.trim();
}

function buildPhysicsSupervisorBlock(): string {
  return [PHYSICAL_REALISM_BLOCK, OBJECT_STATE_TRACKING_BLOCK, REALITY_CHECK_BLOCK].join("\n\n");
}

function buildPostStoryboardPhysicsLayer(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription" | "brandName" | "campaignGoal" | "hookType" | "clipDurationSeconds" | "totalDurationSeconds" | "voiceoverScript" | "creativeStrategy">,
  scenes?: StoryboardScene[]
): string {
  const extended = scenes as ExtendedStoryboardScene[] | undefined;
  return [
    buildPostDirectorPipelineLayers(input, extended),
    buildProductInteractionValidationBlock(input, scenes),
    buildPhysicsSupervisorBlock(),
  ].join("\n\n");
}

function buildPreStoryboardFilmDirectives(): string {
  return [
    FILM_MODE_FLAG,
    FILM_GRAMMAR_BLOCK,
    FILMMAKING_RULE_BLOCK,
    TRANSITION_DESIGN_BLOCK,
    CONTINUITY_RULES_BLOCK,
    EMOTIONAL_ARC_BLOCK,
  ].join("\n\n");
}

export function buildShotByShotBlock(
  storyboard: StoryboardScene[] | undefined,
  clipDurationSeconds: number,
  segmentOffsetSeconds = 0,
  productContext?: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): string {
  if (!storyboard?.length) return "";

  const lines = storyboard
    .map((scene, idx) => {
      const timeRange = scene.time_range || `${segmentOffsetSeconds + idx * 2}-${segmentOffsetSeconds + (idx + 1) * 2}s`;
      const visual = scene.visual_description?.trim();
      if (!visual) return null;

      const parts = [
        `  Shot ${scene.scene ?? idx + 1} [${timeRange}]: ${visual}`,
      ];
      if (scene.motion_style?.trim()) parts.push(`    Camera: ${scene.motion_style.trim()}`);
      if (scene.emotion?.trim()) parts.push(`    Emotion: ${scene.emotion.trim()}`);
      const vo = (scene.voiceover_line || scene.voiceover_script || "").trim();
      if (vo) parts.push(`    VO line: "${vo}"`);

      return parts.join("\n");
    })
    .filter(Boolean);

  if (!lines.length) return "";

  return [
    buildPreStoryboardFilmDirectives(),
    "",
    buildDirectorLayerBlock({
      ...(productContext || {}),
      clipDurationSeconds,
    }),
    "",
    `STORY FLOW (MANDATORY — ${clipDurationSeconds}s cohesive short film):`,
    STORY_FLOW_MANDATORY,
    "",
    lines.join("\n"),
    "",
    buildPostStoryboardPhysicsLayer(
      { ...productContext, clipDurationSeconds } as VeoPromptInput,
      storyboard
    ),
    "",
    "Execute each shot at its time_range. Every cut must be motivated — match cuts, object/camera/motion/eye-line continuation.",
    "No random scene jumps. No slideshow storytelling. One continuous story unfolding naturally.",
  ].join("\n");
}

export function buildSoundDesignBlock(hasVoiceover: boolean, clipDurationSeconds: number): string {
  const tailStart = Math.max(0, clipDurationSeconds - 2);
  return `
SOUND DESIGN (broadcast mix):
${hasVoiceover ? "- Voiceover: warm, confident commercial VO. Clean studio recording. Slight compression. No echo/reverb on speech." : "- No voiceover."}
- Music: premium licensed-style underscore. Builds subtly, swells at ${tailStart}s for the hero close.
- SFX: subtle product foley (clicks, pours, textures) synced to visual actions — never overpowering.
- Mix: VO forward in center, music ducked under speech (-6dB), ambient bed fills gaps.
- Final ${clipDurationSeconds - tailStart}s: music-forward finish, VO silent, satisfying audio resolve.
`.trim();
}

export function buildVoiceoverPromptBlock(
  voiceoverScript: string | undefined,
  clipDurationSeconds: number
): string {
  if (!voiceoverScript?.trim()) {
    return "No voiceover — use premium background music and subtle sound design only.";
  }

  const budget = computeVoiceoverBudget(clipDurationSeconds);
  const script = truncateVoiceover(voiceoverScript, budget.maxWords);
  const wordCount = countWords(script);
  const finishBySecond = Math.max(1, clipDurationSeconds - budget.tailSilenceSeconds);

  return `
VOICEOVER DIRECTION (CRITICAL — DO NOT CUT OFF SPEECH):
- This clip is exactly ${clipDurationSeconds} seconds. Script: ${wordCount} words — MUST finish by ${finishBySecond}s.
- Speak EXACTLY: "${script}"
- Delivery: natural commercial VO — conversational but confident. NOT robotic, NOT rushed, NOT monotone.
- Dialogue quality: hook-first line, specific product benefits, proof where possible, clear CTA at end.
- Use natural breath pauses between phrases. Micro-reactions while speaking if talent is on camera.
- Lip sync must match spoken rhythm if face is visible.
- Start within 0.3s. Even pacing (~2.2 words/sec). Final word lands cleanly before ${finishBySecond}s.
- Last ${budget.tailSilenceSeconds}s (${finishBySecond}–${clipDurationSeconds}s): SILENT. Hero frame + music swell.
`.trim();
}

export function buildOpeningClosingPromptBlock(clipDurationSeconds: number): string {
  const holdStart = Math.max(0, clipDurationSeconds - 1);
  return `
OPENING & CLOSING (film-grade bookends):
- OPENING (0–1s): Immediate visual hook — no fade from black, no empty drift. Frame 1 must stop the scroll.
- MID-FILM: Every transition lands on action, gesture, or beat. Match cuts > dissolves. No morphing or AI-smear.
- CLOSING (${holdStart}–${clipDurationSeconds}s): Resolve on stable product hero. Camera settles (slow push-in or static hold). 1 full second of breathing room — no abrupt freeze, no cut to black.
`.trim();
}

export const AD_FILM_CRAFT_SPEC = `
PRODUCTION QUALITY (broadcast / Tier-1 agency standard):
- Photorealistic live-action (unless animation style specified). 24fps cinematic motion cadence.
- Exposure: bright, clean, well-lit. Natural skin tones. No muddy shadows or crushed blacks.
- Color grade: unified LUT across all shots — consistent temperature, contrast, and saturation.
- Camera physics: realistic motion blur, stable horizon, no jitter/wobble/warping between frames.
- Product fidelity: exact shape, label, color, packaging from reference — zero drift across shots.

EDITING GRAMMAR (professional ad cut):
- Multi-shot narrative (3–7 motivated shots). One cohesive short film — not a random montage or slideshow.
- Cut types: match cut on action, whip-pan exit/entry, rack-focus pull, speed-ramp, motivated hard cut.
- Each shot flows from the previous — cause, visual continuity, motivated camera, emotional progression.
- Forbidden: morphing transitions, random teleports, flicker, object geometry shifts, label changes.

NEGATIVE CONSTRAINTS:
- No on-screen text, captions, subtitles, watermarks, or UI overlays.
- No extra limbs, warped faces, melting objects, plastic skin, AI halos, or texture crawling.
- No voiceover cut off mid-word. No abrupt ending before script completes.
- No impossible physics: liquids from closed containers, food from sealed packets, teleporting objects, or magical product appearance.
- No nudity, partial nudity, exposed breasts, nipples, bare chest, lingerie, or revealing attire.
- No shower/bath scenes with exposed skin. No suggestive or intimate framing.
`.trim();

/** @deprecated Use AD_FILM_CRAFT_SPEC */
export const REALISM_AND_EDIT_SPEC = AD_FILM_CRAFT_SPEC;

/** Keywords woven into the text prompt (Gemini Veo API does not accept negativePrompt). */
export const VEO_NEGATIVE_SAFETY_PROMPT =
  "nudity, nude, naked, topless, bare chest, exposed breasts, nipples, areola, lingerie, underwear only, see-through clothing, sheer fabric, bikini, swimwear, sexual content, erotic, suggestive pose, intimate body parts, exposed torso, cleavage, revealing clothing, shower nudity, bath nudity, towel drop";

export const SAFETY_BLOCK = `
CONTENT SAFETY (MANDATORY — mainstream TV brand advertisement standard):
- People ARE allowed as models, spokespersons, and lifestyle talent — but MUST be fully clothed in EVERY frame.
- NO nudity, partial nudity, topless, bare chest, exposed breasts, nipples, areola, lingerie, underwear-only, see-through or sheer clothing, or revealing swimwear.
- Modest necklines only — no cleavage focus. No intimate body areas in frame.
- NO shower, bath, spa, or towel-drop scenes with exposed skin. NO bedroom intimacy vibes.
- For skincare, body lotion, soap, beauty, and personal-care products: show product applied to HANDS, FOREARMS, or LOWER LEGS only — NEVER on chest, torso, back, or intimate areas.
- Model wears modest everyday clothing (full shirt, closed robe, athletic wear). Think Dove/Nivea/Olay TV commercials — professional, modest, family-friendly, safe for work.
- DO NOT DEPICT: ${VEO_NEGATIVE_SAFETY_PROMPT}.
`.trim();

/** Rules injected into script-generation prompts so storyboards avoid risky visuals. */
export const SCRIPT_CONTENT_SAFETY = `

CONTENT SAFETY (MANDATORY — every visual_description and final_video_prompt MUST comply):
- People are allowed, but MUST be fully clothed in every scene. NO nudity or partial nudity.
- NO bare chest, exposed breasts, nipples, lingerie, underwear-only, see-through clothing, or revealing swimwear.
- NO shower/bath/spa scenes with exposed skin. NO suggestive poses or intimate framing.
- For body lotion, skincare, soap, beauty, and personal-care products: application shots on HANDS, FOREARMS, or LOWER LEGS only — model wears a modest fully closed top. NEVER bare-torso or chest application.
- Safe alternatives: product bottle hero, cream texture on palm, smiling face portrait, lifestyle in casual modest outfit.
- If the user vision implies revealing content, reinterpret it as a modest mainstream brand commercial.`;

/** Veo API config — Gemini Veo rejects negativePrompt for most API keys; safety is enforced via text prompt. */
export function buildVeoGenerateSafetyConfig(): Record<string, never> {
  return {};
}

const BODY_BEAUTY_KEYWORDS =
  /\b(body|skin|lotion|moistur|cream|beauty|cosmetic|soap|shampoo|conditioner|serum|balm|oil|bath|shower|personal care|skincare|cleanser|sunscreen|deodorant|wellness|spa)\b/i;

export function isBodyOrBeautyProduct(
  category?: string,
  productName?: string,
  userDescription?: string
): boolean {
  const text = `${category || ""} ${productName || ""} ${userDescription || ""}`;
  return BODY_BEAUTY_KEYWORDS.test(text);
}

export function buildBodyProductSafetyBlock(
  category?: string,
  productName?: string,
  userDescription?: string
): string {
  if (!isBodyOrBeautyProduct(category, productName, userDescription)) return "";
  return `

BODY & SKINCARE PRODUCT RULES (this product category):
- Show lotion/cream applied to hands, forearms, or lower legs ONLY — never chest, torso, back, or intimate areas.
- Model wears a fully closed modest top (t-shirt, sweater, robe tied shut). Neckline must not reveal cleavage.
- Preferred shots: product bottle hero, cream texture on palm, face close-up with modest clothing visible, casual lifestyle in everyday outfit.
- FORBIDDEN: post-shower bare shoulders, towel scenes, spa robes open at chest, body-wide application on exposed skin.`;
}

export function buildReferenceImagesBlock(hasReferenceImages: boolean): string {
  if (!hasReferenceImages) {
    return "Create visuals based on the creative treatment above.";
  }
  return `REFERENCE IMAGES (CRITICAL — source of truth):
The attached reference images show the EXACT product and/or logo. Depict with pixel-level fidelity:
same shape, colors, packaging, label text, proportions, and branding. Do NOT redesign, reimagine, or alter the product.
The product must be recognizable in every shot where it appears.`;
}

function buildSegmentContext(input: VeoPromptInput): string {
  const { segmentIndex, segmentCount, clipDurationSeconds, totalDurationSeconds } = input;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return "";

  const total = totalDurationSeconds ?? clipDurationSeconds * segmentCount;
  if (segmentIndex === 0) {
    return `
SEGMENT 1 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
FIRST HALF — Hook, product introduction, setup. End on a resolved beat (hero product shot, pause, or held frame) for a clean stitch point.`;
  }
  return `
SEGMENT 2 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
SECOND HALF — Continue the SAME story. Match lighting, grade, location, wardrobe, and product EXACTLY from segment 1.
Start with a new motivated angle (match-cut or whip-pan from segment 1 ending). Payoff, emotional climax, brand CTA.`;
}

// ─── Cinematic style mapping (Veo 3.1 — emotion-first prompts) ───────────────

interface CinematicStyle {
  emotion: string;
  camera: string;
  light: string;
  pace: string;
  colorGrade: string;
  closingFeel: string;
}

const STYLE_MAP: Record<string, CinematicStyle> = {
  cinematic: {
    emotion: "awe-inspiring and emotionally resonant",
    camera: "slow cinematic push-in, shallow depth of field, lens breathing subtly",
    light: "golden hour practicals, deep amber fills, long horizon shadows",
    pace: "deliberate and unhurried — every second earns its place",
    colorGrade: "warm film emulation, slightly desaturated midtones, lifted blacks",
    closingFeel: "viewers should feel like they witnessed something meaningful, not just a product ad",
  },
  lifestyle: {
    emotion: "aspirational warmth — the life you want to be living",
    camera: "handheld with gentle human imperfection, floating slowly through the scene",
    light: "soft natural window light or diffused outdoor light, airy and clean",
    pace: "casual and organic — movement feels unscripted",
    colorGrade: "bright, airy, slightly warm — think magazine editorial",
    closingFeel: "the viewer should feel a quiet desire to be in this moment",
  },
  luxury: {
    emotion: "quiet confidence and understated prestige",
    camera: "locked-off wide shots alternating with extreme macro close-ups of material detail",
    light: "controlled studio practicals, strong negative fill, deep blacks, specular highlights on surfaces",
    pace: "slow and considered — silence has weight",
    colorGrade: "cool desaturated with rich shadow detail, near-monochrome with one warm accent",
    closingFeel: "viewers should feel they are in the presence of something rare and considered",
  },
  energetic: {
    emotion: "electric, alive, unstoppable momentum",
    camera: "low-angle tracking shots, dynamic whip pans, quick editorial cuts",
    light: "high contrast, rim lighting, practical light sources popping in frame",
    pace: "fast and rhythmic — synced to an invisible heartbeat",
    colorGrade: "punchy contrast, saturated primaries, deep crushed blacks",
    closingFeel: "viewers should feel a rush — an urge to move",
  },
  minimal: {
    emotion: "calm clarity — the beauty of reduction",
    camera: "static locked-off frames, perfectly composed negative space",
    light: "clean soft boxes or natural overcast, shadowless and pure",
    pace: "serene — unhurried to the point of meditative",
    colorGrade: "near-neutral, muted, breathing room in every tone",
    closingFeel: "viewers should feel peace and confidence in simplicity",
  },
  documentary: {
    emotion: "authentic, human, honest",
    camera: "observational handheld, following rather than directing — a witness not a director",
    light: "available light only — whatever the scene offers",
    pace: "naturalistic — nothing forced",
    colorGrade: "naturalistic grade, no heavy LUT, true skin tones",
    closingFeel: "viewers should feel they glimpsed something real",
  },
  bold: {
    emotion: "confrontational, confident, impossible to ignore",
    camera: "wide angle close — distortion is intentional, space is dramatic",
    light: "hard single-source lighting, stark shadows, aggressive contrast",
    pace: "abrupt and declarative — cuts land like statements",
    colorGrade: "high contrast, almost graphic — block colors, deep shadows",
    closingFeel: "viewers should feel challenged and compelled",
  },
};

const APP_STYLE_TO_CINEMATIC: Record<string, keyof typeof STYLE_MAP> = {
  commercial: "cinematic",
  ugc: "documentary",
  "product showcase": "minimal",
  lifestyle: "lifestyle",
  cinematic: "cinematic",
  "motion graphics": "minimal",
  hook: "energetic",
  "ugc style": "documentary",
  "product close-up": "minimal",
  luxury: "luxury",
  minimalist: "minimal",
  "bold & energetic": "energetic",
  energetic: "energetic",
  bold: "bold",
  documentary: "documentary",
  minimal: "minimal",
};

function getCinematicStyle(style?: string): CinematicStyle {
  const key = (style || "commercial").toLowerCase().trim();
  const mapped = APP_STYLE_TO_CINEMATIC[key] ?? (STYLE_MAP[key] ? key : "cinematic");
  return STYLE_MAP[mapped] ?? STYLE_MAP.cinematic;
}

function getCompositionGuidance(aspectRatio: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "vertical frame — compose for mobile-first viewing. Subject centered or rule-of-thirds vertical. Sky and ground as framing bands. Text-safe zones at top 15% and bottom 20%.";
    case "16:9":
      return "widescreen cinematic frame — use the full horizontal canvas. Strong horizontal leading lines. Environmental storytelling in the periphery.";
    case "4:5":
      return "social portrait frame — slightly taller than wide. Product prominent in upper two-thirds. Breathing room below. Clean for feed scrolling.";
    default:
      return "compose with intention — every element in frame should earn its place.";
  }
}

function getReferenceImageInstruction(hasReferenceImages: boolean, productName?: string): string {
  if (!hasReferenceImages) return "";
  const name = productName || "the product";
  return (
    `CRITICAL — reference images provided: ${name} must appear exactly as shown in the reference images. ` +
    `Preserve packaging shape, label design, color, and proportions with absolute fidelity. ` +
    `Do not stylize, abstract, or approximate the product — it must be photorealistic and true to the reference.`
  );
}

function parseSceneDurationSeconds(duration?: string | number, timeRange?: string): number | undefined {
  if (typeof duration === "number" && duration > 0) return duration;
  if (typeof duration === "string") {
    const n = parseFloat(duration.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const parsed = timeRange ? parseSceneTimeRange(timeRange) : null;
  if (parsed) return Math.max(0.5, parsed.end - parsed.start);
  return undefined;
}

function buildMarketingStrategyBlock(input: VeoPromptInput): string {
  const s = input.creativeStrategy;
  if (!s) return "";
  return [
    "PERFORMANCE AD BRIEF (priority #1 — sell the product, maximize CTR and conversion):",
    s.creativeAngle ? `Creative angle: ${s.creativeAngle}` : "",
    s.hookType || input.hookType ? `Hook mechanism: ${s.hookType || input.hookType}` : "",
    s.targetAudience ? `Target audience: ${s.targetAudience}` : "",
    s.corePainPoint ? `Core pain: ${s.corePainPoint}` : "",
    s.coreDesire ? `Core desire: ${s.coreDesire}` : "",
    s.biggestObjection ? `Objection to overcome: ${s.biggestObjection}` : "",
    s.conversionObjective ? `Conversion objective: ${s.conversionObjective}` : "",
    s.cta ? `CTA: ${s.cta}` : "",
    input.campaignGoal ? `Campaign goal: ${input.campaignGoal}` : "",
    "Visual priority: (1) hook execution (2) product demo (3) benefit clarity (4) proof (5) emotion (6) cinematography.",
    "Mix shot types: lifestyle usage, product close-up, benefit demonstration, social proof moment, hero product ending.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPerformanceStoryboardSection(scenes: StoryboardScene[]): string {
  return buildBeatBasedStoryboardSection(scenes as ExtendedStoryboardScene[], (s, idx) => {
    const sceneNum = s.scene ?? idx + 1;
    const msg = s.marketing_message || s.visual_description || "";
    const vis = s.visual_description || "";
    const proof = s.proof_element ? ` Proof: ${s.proof_element}.` : "";
    const dur = parseSceneDurationSeconds(s.duration, s.time_range);
    const durPart = dur ? ` (~${dur}s)` : "";
    const purpose = s.shot_purpose ? ` Purpose: ${s.shot_purpose}.` : "";
    const transition = s.transition_to_next ? ` Transition out: ${s.transition_to_next}.` : "";
    return `    Shot ${sceneNum}${durPart}: MESSAGE: ${msg}. VISUAL: ${vis}.${purpose}${proof}${transition}`;
  });
}

function buildCinematicStoryboardSection(scenes: StoryboardScene[]): string {
  return buildBeatBasedStoryboardSection(scenes as ExtendedStoryboardScene[], (s, idx) => {
    const sceneNum = s.scene ?? idx + 1;
    const description = s.visual_description || s.description || "";
    const cam = s.motion_style || s.camera;
    const mood = s.emotion || s.mood || s.emotional_zone;
    const dur = parseSceneDurationSeconds(s.duration, s.time_range);
    const camPart = cam ? ` Camera: ${cam}.` : "";
    const moodPart = mood ? ` Emotion: ${mood}.` : "";
    const durPart = dur ? ` (~${dur}s)` : "";
    const vo = (s.voiceover_line || s.voiceover_script || "").trim();
    const voPart = vo ? ` Dialogue: "${vo}".` : "";
    return `    Shot ${sceneNum}${durPart}: ${description}.${camPart}${moodPart}${voPart}`;
  });
}

function getVoiceoverPacingNote(voiceoverScript?: string, clipDurationSeconds?: number): string {
  if (!voiceoverScript?.trim()) return "";
  const wordCount = voiceoverScript.trim().split(/\s+/).length;
  const estimatedSeconds = Math.round((wordCount / 130) * 60);
  const budget = clipDurationSeconds ? computeVoiceoverBudget(clipDurationSeconds) : null;
  const budgetNote = budget
    ? ` Must finish by ${budget.maxSpokenSeconds}s (max ${budget.maxWords} words).`
    : "";
  return (
    `AUDIO: Voiceover present (approx. ${estimatedSeconds}s at natural pace).${budgetNote} ` +
    `Visual pacing must breathe with the spoken word — do not fight the narration. ` +
    `Cut on breath points, not arbitrary intervals.`
  );
}

function buildMarketingOneLiner(input: VeoPromptInput): string {
  const s = input.creativeStrategy;
  if (!s) return "";
  const parts = [
    s.creativeAngle,
    s.hookType || input.hookType ? `Hook: ${s.hookType || input.hookType}` : "",
    s.cta ? `CTA: ${s.cta}` : "",
    input.campaignGoal ? `Goal: ${input.campaignGoal}` : "",
  ].filter(Boolean);
  return parts.length ? `Ad brief: ${parts.join(". ")}.` : "";
}

function buildCompactSafetyForVeo(
  category?: string,
  productName?: string,
  userDescription?: string
): string {
  let block =
    "Safety: fully clothed talent, modest family-friendly TV commercial, no nudity or revealing attire. Photorealistic. No watermarks or burned-in text.";
  if (isBodyOrBeautyProduct(category, productName, userDescription)) {
    block += " Skincare on face/hands only; model wears modest closed top.";
  }
  return block;
}

function buildCompactCraftForVeo(clipDurationSeconds: number): string {
  const hold = Math.max(0, clipDurationSeconds - 1);
  return `Craft: photorealistic 24fps, unified color grade, motivated match cuts, stable product label. Hook in first second. Hero product hold ${hold}-${clipDurationSeconds}s.`;
}

function buildCompactVoiceoverForVeo(
  voiceoverScript: string | undefined,
  clipDurationSeconds: number
): string {
  if (!voiceoverScript?.trim()) return "";
  const budget = computeVoiceoverBudget(clipDurationSeconds);
  const script = truncateVoiceover(voiceoverScript, budget.maxWords);
  const finishBy = Math.max(1, clipDurationSeconds - budget.tailSilenceSeconds);
  return `VO (finish by ${finishBy}s): "${script}". Natural conversational delivery with breath pauses; lip sync if on camera. Silent hero last ${budget.tailSilenceSeconds}s.`;
}

function buildCompactSegmentContext(input: VeoPromptInput): string {
  const { segmentIndex, segmentCount, clipDurationSeconds, totalDurationSeconds } = input;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return "";
  const total = totalDurationSeconds ?? clipDurationSeconds * segmentCount;
  if (segmentIndex === 0) {
    return `Segment 1/${segmentCount}: hook + setup. End on clean stitch frame (${clipDurationSeconds}s of ${total}s ad).`;
  }
  return `Segment 2/${segmentCount}: continue same story — match lighting, wardrobe, product. Payoff + CTA (${clipDurationSeconds}s of ${total}s ad).`;
}

function buildCompactProductPhysicsLine(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): string {
  const profile = detectProductInteractionProfile(input);
  const steps = profile.sequence.slice(0, 4).join(" → ");
  return `Product physics (${profile.label}): ${steps}. No skipping mechanical steps.`;
}

/**
 * Assemble a Veo 3.1 prompt within the 1024-token API limit.
 * Full director/validation layers are used in script generation — not duplicated here.
 */
function buildVeoCompactPrompt(input: VeoPromptInput): string {
  const {
    brandName,
    productName,
    category,
    userDescription,
    style,
    clipDurationSeconds,
    totalDurationSeconds,
    aspectRatio,
    segmentIndex,
    segmentCount,
    finalVideoPrompt,
    fallbackPrompt,
    voiceoverScript,
    storyboard,
    hasReferenceImages = false,
    creativeStrategy,
    headline,
    subtext,
    campaignGoal,
    hookType,
  } = input;

  const visualStyle = input.creativeFormat || style;
  const totalLabel = totalDurationSeconds ?? clipDurationSeconds;
  const scopedStoryboard =
    segmentCount != null && segmentCount > 1 && segmentIndex != null
      ? filterStoryboardForSegment(storyboard, segmentIndex, clipDurationSeconds)
      : storyboard;
  const trimmedVoiceover = voiceoverScript
    ? truncateVoiceover(voiceoverScript, computeVoiceoverBudget(clipDurationSeconds).maxWords)
    : "";
  const creativeTreatment = finalVideoPrompt?.trim() || fallbackPrompt?.trim() || "";

  const sections: string[] = [];

  if (creativeTreatment.length > 40) {
    sections.push(`CREATIVE TREATMENT:\n${creativeTreatment}`);
  } else {
    const cine = getCinematicStyle(visualStyle);
    const subject = productName || "the product";
    const brand = brandName ? `${brandName} ` : "";
    const categoryLabel = category ? ` (${category})` : "";
    sections.push(
      [
        `EMOTION: ${cine.emotion}.`,
        `SUBJECT: ${brand}${subject}${categoryLabel}.`,
        userDescription?.trim() || "",
        `CAMERA: ${cine.camera}. LIGHT: ${cine.light}. PACE: ${cine.pace}. COLOR: ${cine.colorGrade}.`,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  sections.push(
    `FRAME: ${clipDurationSeconds}s clip (${totalLabel}s ad). ${aspectRatio}. ${getCompositionGuidance(aspectRatio)}`
  );

  const refInstruction = getReferenceImageInstruction(hasReferenceImages, productName);
  if (refInstruction) sections.push(refInstruction);

  if (scopedStoryboard?.length) {
    const mode = creativeStrategy ? "performance" : "cinematic";
    sections.push(
      `STORYBOARD:\n${buildCompactStoryboardLines(scopedStoryboard as ExtendedStoryboardScene[], mode)}`
    );
  }

  const voBlock = buildCompactVoiceoverForVeo(trimmedVoiceover, clipDurationSeconds);
  if (voBlock) sections.push(voBlock);

  const marketing = buildMarketingOneLiner(input);
  if (marketing) sections.push(marketing);

  sections.push(
    buildDirectorLayerCompact({
      brandName,
      productName,
      category,
      userDescription,
      campaignGoal,
      hookType,
      clipDurationSeconds,
      totalDurationSeconds: totalLabel,
      creativeStrategy,
    })
  );

  sections.push(
    buildCompactPipelineDigest(
      {
        brandName,
        productName,
        category,
        userDescription,
        campaignGoal,
        hookType,
        clipDurationSeconds,
        totalDurationSeconds: totalLabel,
        creativeStrategy,
      },
      scopedStoryboard as ExtendedStoryboardScene[] | undefined
    )
  );

  sections.push(buildCompactProductPhysicsLine(input));

  const segmentCtx = buildCompactSegmentContext(input);
  if (segmentCtx) sections.push(segmentCtx);

  if (headline || subtext) {
    sections.push(
      [headline ? `Headline: "${headline}"` : "", subtext ? `Subtext: "${subtext}"` : ""]
        .filter(Boolean)
        .join(". ")
    );
  }

  sections.push(buildCompactCraftForVeo(clipDurationSeconds));
  sections.push(buildCompactSafetyForVeo(category, productName, userDescription));

  return joinWithinVeoTokenBudget(sections, VEO_PROMPT_MAX_TOKENS);
}

/** Assemble a cinematic Veo 3.1 prompt — fits within the 1024-token API limit. */
export function buildVeoVideoPrompt(input: VeoPromptInput): string {
  return buildVeoCompactPrompt(input);
}

/** Development helper — score prompt quality before sending to Veo. */
export function auditVideoPrompt(prompt: string): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const checks = [
    {
      test: () => estimateVeoPromptTokens(prompt) > VEO_PROMPT_MAX_TOKENS,
      issue: `Prompt exceeds Veo API limit (~${VEO_PROMPT_MAX_TOKENS} tokens)`,
      suggestion: "Compress creative treatment and storyboard before sending to Veo",
    },
    {
      test: () => prompt.length < 100,
      issue: "Prompt is very short — Veo needs rich context",
      suggestion: "Add emotional intent, camera language, and lighting description",
    },
    {
      test: () => !/emotion|feel|mood|tone/i.test(prompt),
      issue: "No emotional intent stated",
      suggestion: "Lead with how you want the viewer to feel, not just what they should see",
    },
    {
      test: () => !/camera|lens|shot|handheld|tracking|push|pull|aerial|close.?up|wide/i.test(prompt),
      issue: "No camera language specified",
      suggestion: "Add camera movement: push-in, handheld, static wide, low tracking, etc.",
    },
    {
      test: () => !/light|shadow|golden|noon|neon|candle|dusk|overcast/i.test(prompt),
      issue: "No lighting description",
      suggestion: "Describe the light source and quality: golden hour, overcast, neon night, etc.",
    },
    {
      test: () => !/color|grade|tones?|palette|warm|cool|saturated|desaturated/i.test(prompt),
      issue: "No color/grade direction",
      suggestion: "Specify color temperature and grading intent: warm amber, cool desaturated, etc.",
    },
    {
      test: () => !/pace|slow|fast|rhythmic|languid|deliberate|motion/i.test(prompt),
      issue: "No pacing/motion direction",
      suggestion: "Describe the energy and speed of movement in the scene",
    },
    {
      test: () =>
        /\b(beautiful|stunning|amazing)\b/i.test(prompt) &&
        !/EMOTIONAL INTENT|CREATIVE TREATMENT/i.test(prompt),
      issue: "Vague aesthetic adjectives without cinematic structure",
      suggestion: "Replace vague words with specific sensory details: what exactly makes it beautiful?",
    },
  ];

  for (const check of checks) {
    if (check.test()) {
      issues.push(check.issue);
      suggestions.push(check.suggestion);
    }
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { score, issues, suggestions };
}
