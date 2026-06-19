/**
 * Director → Editor → Validation pipeline for performance ad films.
 * Thinks in beats, not disconnected shots.
 */

export type StoryboardSceneRef = {
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

export type DirectorPipelineInput = {
  brandName?: string;
  productName?: string;
  category?: string;
  userDescription?: string;
  campaignGoal?: string;
  hookType?: string;
  clipDurationSeconds: number;
  totalDurationSeconds?: number;
  voiceoverScript?: string;
  creativeStrategy?: {
    targetAudience?: string;
    corePainPoint?: string;
    coreDesire?: string;
    creativeAngle?: string;
    hookType?: string;
    cta?: string;
    campaignGoal?: string;
    conversionObjective?: string;
  };
};

export type ExtendedStoryboardScene = StoryboardSceneRef;

export const FILM_GRAMMAR_BLOCK = `
FILM GRAMMAR (GLOBAL):

This is a commercial film.
Not a slideshow.
Not a montage.
Not a collection of product shots.

Every shot must connect logically to the previous shot.
Every cut must have motivation.
The viewer should feel they watched one continuous story.
`.trim();

/** Standard ad beats — human editors think in beats, not arbitrary scenes. */
export const AD_BEAT_SEQUENCE = [
  {
    id: "hook",
    label: "Hook",
    purpose: "Stop the scroll — pattern interrupt, curiosity, or bold claim",
    emotion: "Curiosity",
    zone: "0-20%",
  },
  {
    id: "problem",
    label: "Problem",
    purpose: "Name the pain, frustration, or unmet desire",
    emotion: "Tension",
    zone: "20-40%",
  },
  {
    id: "discovery",
    label: "Discovery",
    purpose: "Introduce the insight or moment of realization",
    emotion: "Discovery",
    zone: "40-50%",
  },
  {
    id: "product",
    label: "Product",
    purpose: "Reveal product within the story — not a random insert",
    emotion: "Discovery",
    zone: "50-60%",
  },
  {
    id: "transformation",
    label: "Transformation",
    purpose: "Demonstrate benefit, usage, or proof",
    emotion: "Satisfaction",
    zone: "60-80%",
  },
  {
    id: "payoff",
    label: "Payoff",
    purpose: "Emotional resolution + brand hero + CTA energy",
    emotion: "Resolution",
    zone: "80-100%",
  },
] as const;

export const EMOTIONAL_CURVE_ZONES = [
  { range: "0-20%", label: "Curiosity", direction: "Pattern interrupt, intrigue, open loop" },
  { range: "20-40%", label: "Tension", direction: "Problem agitation, stakes, relatable struggle" },
  { range: "40-60%", label: "Discovery", direction: "Insight, product reveal, aha moment" },
  { range: "60-80%", label: "Satisfaction", direction: "Proof, transformation, benefit landed" },
  { range: "80-100%", label: "Resolution", direction: "Payoff, confidence, brand lock-in" },
] as const;

const PRODUCT_SHOT_TEMPLATES: Record<string, string[]> = {
  beard_oil: [
    "Problem / mirror look",
    "Pick up bottle",
    "Unscrew cap / open dropper",
    "Dispense drops",
    "Apply to beard",
    "Texture close-up",
    "Result / confidence",
    "Hero product shot",
  ],
  instant_food: [
    "Hunger / craving hook",
    "Hold packet",
    "Tear seal open",
    "Pour contents",
    "Cook / steam rising",
    "Plated result",
    "Taste reaction",
    "Pack hero shot",
  ],
  bottle_liquid: [
    "Problem moment",
    "Reach for bottle",
    "Open cap",
    "Pour / dispense",
    "Product in use",
    "Benefit result",
    "Hero bottle shot",
  ],
  coffee_jar: [
    "Morning need / craving",
    "Open jar lid",
    "Scoop powder",
    "Pour into cup",
    "Stir / steam",
    "First sip reaction",
    "Hero jar shot",
  ],
  pump_dispenser: [
    "Need moment",
    "Hand to pump",
    "Press pump",
    "Product on hands",
    "Apply / use",
    "Satisfied result",
    "Hero dispenser shot",
  ],
  generic: [
    "Hook / problem",
    "Context / agitation",
    "Product introduction",
    "Demonstration",
    "Proof / result",
    "Brand payoff",
  ],
};

function detectShotTemplateKey(
  input: Pick<DirectorPipelineInput, "category" | "productName" | "userDescription">
): string {
  const haystack = `${input.category || ""} ${input.productName || ""} ${input.userDescription || ""}`.toLowerCase();
  if (/beard|face oil|hair oil/i.test(haystack)) return "beard_oil";
  if (/\b(facewash|face wash|cleanser|foaming)\b/i.test(haystack)) return "pump_dispenser";
  if (/\b(noodle|packet|snack|chips)\b/i.test(haystack) || /\binstant\s+(food|meal|noodle|ramen|snack)/i.test(haystack))
    return "instant_food";
  if (/coffee|protein powder|jar|canister/i.test(haystack)) return "coffee_jar";
  if (/pump|soap|sanitizer|dispenser|facewash/i.test(haystack)) return "pump_dispenser";
  if (/bottle|shampoo|lotion|juice/i.test(haystack)) return "bottle_liquid";
  return "generic";
}

function parseSceneStartSeconds(scene: StoryboardSceneRef, idx: number, total: number, totalDuration: number): number {
  const tr = scene.time_range || "";
  const m = tr.match(/^(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return (idx / Math.max(1, total)) * totalDuration;
}

function emotionalZoneForProgress(pct: number): (typeof EMOTIONAL_CURVE_ZONES)[number] {
  if (pct < 20) return EMOTIONAL_CURVE_ZONES[0];
  if (pct < 40) return EMOTIONAL_CURVE_ZONES[1];
  if (pct < 60) return EMOTIONAL_CURVE_ZONES[2];
  if (pct < 80) return EMOTIONAL_CURVE_ZONES[3];
  return EMOTIONAL_CURVE_ZONES[4];
}

function normalizeBeatLabel(beat?: string): string {
  if (!beat?.trim()) return "";
  const b = beat.trim().toLowerCase();
  if (/hook|curiosity|interrupt/i.test(b)) return "Hook";
  if (/problem|pain|struggle/i.test(b)) return "Problem";
  if (/discover|realiz|insight/i.test(b)) return "Discovery";
  if (/product|demo|reveal/i.test(b)) return "Product";
  if (/transform|benefit|proof|result|before|after/i.test(b)) return "Transformation";
  if (/payoff|cta|brand|close/i.test(b)) return "Payoff";
  return beat.trim();
}

function groupScenesByBeat(scenes: ExtendedStoryboardScene[]): Map<string, ExtendedStoryboardScene[]> {
  const groups = new Map<string, ExtendedStoryboardScene[]>();
  for (const beat of AD_BEAT_SEQUENCE) {
    groups.set(beat.label, []);
  }

  const hasBeatFields = scenes.some((s) => s.beat?.trim());
  if (hasBeatFields) {
    for (const scene of scenes) {
      const label = normalizeBeatLabel(scene.beat) || "Product";
      const list = groups.get(label) || groups.get("Product")!;
      list.push(scene);
    }
    return groups;
  }

  // Distribute scenes across beats when beat field missing
  const beatLabels = AD_BEAT_SEQUENCE.map((b) => b.label);
  scenes.forEach((scene, idx) => {
    const beatIdx = Math.min(beatLabels.length - 1, Math.floor((idx / scenes.length) * beatLabels.length));
    groups.get(beatLabels[beatIdx])!.push(scene);
  });
  return groups;
}

function inferTransitionType(prev: ExtendedStoryboardScene, next: ExtendedStoryboardScene): string {
  const pv = (prev.visual_description || "").toLowerCase();
  const nv = (next.visual_description || "").toLowerCase();
  if (next.transition_to_next?.trim()) return next.transition_to_next.trim();
  if (/hand reach|grab|pick/i.test(pv) && /open|unscrew|tear|press/i.test(nv)) return "Object Continuity";
  if (/push|dolly|zoom/i.test(pv)) return "Camera Continuation";
  if (/turn|look|glance|eye/i.test(pv)) return "Eye Line Match";
  if (/pour|dispense|scoop/i.test(pv)) return "Motion Continuity";
  if (/whip|pan|swish/i.test(pv) || /whip|pan/i.test(nv)) return "Whip Transition";
  return "Match Cut";
}

/** Layer 1 — Director decides why each shot exists before storyboard execution. */
export function buildDirectorLayerBlock(input: DirectorPipelineInput): string {
  const s = input.creativeStrategy;
  const templateKey = detectShotTemplateKey(input);
  const shotTemplate = PRODUCT_SHOT_TEMPLATES[templateKey] || PRODUCT_SHOT_TEMPLATES.generic;
  const total = input.totalDurationSeconds ?? input.clipDurationSeconds;
  const productRevealAt = Math.round(total * 0.55);

  return `
DIRECTOR LAYER (decide before shooting — strategist + film director):

You are directing a ${total}s performance ad film for ${input.productName || "the product"}.
Think in BEATS, not random shots. Every frame must earn its place.

Creative angle: ${s?.creativeAngle || input.userDescription || "Drive product desire and conversion"}
Campaign goal: ${s?.campaignGoal || input.campaignGoal || "Drive Sales"}
Hook mechanism: ${s?.hookType || input.hookType || "Auto"}
Target audience: ${s?.targetAudience || "Infer from product"}

DIRECTOR DECISIONS:
• Why each shot exists: advance story | reveal product | build emotion | create proof | deliver payoff
• Emotional progression: Curiosity (0-20%) → Tension (20-40%) → Discovery (40-60%) → Satisfaction (60-80%) → Resolution (80-100%)
• Narrative flow: one continuous story — not stitched clips
• Product reveal timing: first clear product moment by ~${productRevealAt}s (50-60% mark), earned by story
• Camera motivation: camera follows action and emotion — never unmotivated beauty shots

PRODUCT-CENTRIC SHOT TEMPLATE (${templateKey.replace(/_/g, " ")}):
${shotTemplate.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Do not invent random sequences outside this template unless the story demands it.
`.trim();
}

/** Veo API digest — full director layer is for script generation only (~1024 token cap). */
export function buildDirectorLayerCompact(input: DirectorPipelineInput): string {
  const s = input.creativeStrategy;
  const total = input.totalDurationSeconds ?? input.clipDurationSeconds;
  const reveal = Math.round(total * 0.55);
  const hook = s?.hookType || input.hookType || "pattern interrupt";
  const cta = s?.cta || "Shop now";
  const angle = s?.creativeAngle || input.userDescription || "drive product desire";
  return (
    `Director (${total}s beat-driven ad, ${input.productName || "product"}): ${angle}. ` +
    `Hook=${hook}. Product reveal ~${reveal}s. Arc: Curiosity→Tension→Discovery→Satisfaction→Resolution. ` +
    `Motivated cuts only — one continuous story. CTA: ${cta}.`
  );
}

/** Compact per-shot lines for Veo prompts. */
export function buildCompactStoryboardLines(
  scenes: ExtendedStoryboardScene[],
  mode: "performance" | "cinematic" = "cinematic"
): string {
  return scenes
    .map((s, idx) => {
      const n = s.scene ?? idx + 1;
      const beat = normalizeBeatLabel(s.beat) || "—";
      const tr = s.time_range?.trim();
      const vis = (s.visual_description || s.description || "").replace(/\s+/g, " ").trim();
      const shortVis = vis.length > 100 ? `${vis.slice(0, 97)}…` : vis;
      const emo = s.emotion || s.emotional_zone || "";
      const vo = (s.voiceover_line || s.voiceover_script || "").trim();
      const transition = s.transition_to_next ? ` Cut→${s.transition_to_next}.` : "";
      const state =
        s.product_state && s.container_state ? ` [${s.container_state}]` : "";

      if (mode === "performance") {
        const msg = (s.marketing_message || "").replace(/\s+/g, " ").trim();
        const purpose = s.shot_purpose ? ` Why: ${s.shot_purpose}.` : "";
        return (
          `${n}${tr ? ` [${tr}]` : ""} (${beat}): ${msg || shortVis}. ${shortVis}${state}.${purpose}` +
          `${emo ? ` Emotion: ${emo}.` : ""}${vo ? ` VO: "${vo}".` : ""}${transition}`
        );
      }

      const cam = s.motion_style || s.camera;
      return (
        `${n}${tr ? ` [${tr}]` : ""} (${beat}): ${shortVis}${state}.` +
        `${cam ? ` Cam: ${cam}.` : ""}${emo ? ` Emotion: ${emo}.` : ""}` +
        `${vo ? ` VO: "${vo}".` : ""}${transition}`
      );
    })
    .join("\n");
}

/** One-paragraph digest of validation layers for Veo. */
export function buildCompactPipelineDigest(
  input: DirectorPipelineInput,
  scenes?: ExtendedStoryboardScene[]
): string {
  const parts = [
    "Continuity: same actor, wardrobe, location, lighting, and product in every shot.",
    "Physics: complete open→dispense→apply; no liquid from closed containers.",
    "Behavior: natural blinks, grip shifts, micro-expressions — not mannequin stillness.",
    "Editing: motivated match cuts — every shot advances story, product, emotion, proof, or payoff.",
  ];

  if (scenes?.length && scenes.length > 1) {
    const transitions = scenes
      .slice(0, -1)
      .map((s, i) => inferTransitionType(s, scenes[i + 1]))
      .slice(0, 4);
    if (transitions.length) parts.push(`Transitions: ${transitions.join(" → ")}.`);
  }

  if (input.productName) {
    parts.push(`Product hero: ${input.productName} label exact in every frame.`);
  }

  return parts.join(" ");
}

/** Layer 2 — Editor brain: reject "looks cool" shots. */
export function buildEditorBrainBlock(scenes?: ExtendedStoryboardScene[]): string {
  const validPurposes = [
    "advance story",
    "reveal product",
    "build emotion",
    "create proof",
    "deliver payoff",
  ];

  const sceneAudits = (scenes || [])
    .map((scene, idx) => {
      const num = scene.scene ?? idx + 1;
      const beat = normalizeBeatLabel(scene.beat) || "—";
      const purpose =
        scene.shot_purpose?.trim() ||
        scene.marketing_message?.trim() ||
        scene.visual_description?.slice(0, 80) ||
        "unspecified";
      const why =
        beat === "Hook"
          ? "Stop scroll / open loop"
          : beat === "Problem"
            ? "Agitate pain"
            : beat === "Product"
              ? "Reveal product in story"
              : beat === "Transformation"
                ? "Show transformation / proof"
                : beat === "Payoff"
                  ? "Deliver payoff + brand"
                  : purpose;

      return `  Shot ${num} [${beat}]: WHY = ${why}. Must advance story, reveal product, build emotion, create proof, or deliver payoff. REJECT if answer is only "looks cool".`;
    })
    .filter(Boolean);

  return `
EDITOR BRAIN (highest ROI — cut ruthlessly):

Before rendering every shot, ask: Why is this shot here?
If the answer is only "looks cool" — DELETE IT and replace with a motivated story beat.

Every shot MUST do at least one:
• Advance story
• Reveal product
• Build emotion
• Create proof
• Deliver payoff

${sceneAudits.length ? `Per-shot editorial mandate:\n${sceneAudits.join("\n")}` : "Apply to every shot in this clip."}
`.trim();
}

export const HUMAN_BEHAVIOR_ENGINE_BLOCK = `
HUMAN BEHAVIOR ENGINE:

Generate natural micro-actions. Avoid mannequin behavior.

Every person on screen should:
• Blink naturally (not frozen stare)
• Adjust grip when handling objects
• Shift posture and weight subtly
• Look around or react to stimuli
• React emotionally to product/results (micro-expressions)
• Breathe naturally (visible chest/shoulder movement in medium shots)

Dialogue delivery:
• Natural pauses and breath points — not robotic ad-read
• Slight imperfection is good (UGC) or controlled confidence (commercial)
• Lip sync must match spoken rhythm
• React while speaking — not static talking head

Reject: frozen poses, dead eyes, robotic symmetry, unnatural stillness during action.
`.trim();

/** Layer 5 — Continuity validation before render. */
export function buildContinuityEngineBlock(
  input: Pick<DirectorPipelineInput, "productName" | "brandName" | "category">,
  scenes?: ExtendedStoryboardScene[]
): string {
  const sceneNotes = (scenes || [])
    .map((s, i) => {
      const n = s.scene ?? i + 1;
      return `  Scene ${n}: Lock character, wardrobe, location, lighting, product (${input.productName || "product"}), props, time of day — must match scene ${n > 1 ? n - 1 : n}.`;
    })
    .join("\n");

  return `
CONTINUITY ENGINE + CONTINUITY VALIDATION:

Track and LOCK across every shot:
• Character (same person, same face, same hair)
• Wardrobe (no shirt color jumps)
• Location / environment
• Lighting direction and color grade
• Product (same label, cap, fill level, packaging)
• Time of day
• Props in frame

REJECT continuity breaks:
Shot 1 black shirt → Shot 2 blue shirt → Shot 3 black shirt = INVALID.

${sceneNotes || "Validate continuity across full film before rendering."}

Brand: ${input.brandName || "—"} | Product: ${input.productName || "—"} | Category: ${input.category || "—"}
`.trim();
}

/** Layer 6 — Transition planner for every scene change. */
export function buildTransitionPlannerBlock(scenes?: ExtendedStoryboardScene[]): string {
  if (!scenes || scenes.length < 2) {
    return `
TRANSITION PLANNER:
Every scene change must use a motivated transition: Match Cut | Whip Transition | Object Continuity | Motion Continuity | Eye Line Match | Sound Bridge.
Never cut randomly between unrelated images.
`.trim();
  }

  const plans: string[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    const prev = scenes[i];
    const next = scenes[i + 1];
    const from = prev.scene ?? i + 1;
    const to = next.scene ?? i + 2;
    const type = inferTransitionType(prev, next);
    const prevVis = (prev.visual_description || "").slice(0, 60);
    const nextVis = (next.visual_description || "").slice(0, 60);
    plans.push(
      `  Cut ${from}→${to}: ${type}\n    Out: ${prevVis}...\n    In: ${nextVis}...\n    Rule: next shot must continue the action, object, camera, or eye-line — not a random jump.`
    );
  }

  return `
TRANSITION PLANNER (every scene change):

Allowed transition types:
• Match Cut
• Whip Transition
• Object Continuity
• Motion Continuity
• Eye Line Match
• Sound Bridge

Example: Hand reaches for bottle → next shot begins with bottle opening (Object Continuity).
NOT: Bottle → random face → random macro.

Planned transitions:
${plans.join("\n")}
`.trim();
}

/** Layer 7 — Emotional curve mapped to each shot. */
export function buildEmotionalCurveBlock(
  totalDurationSeconds: number,
  scenes?: ExtendedStoryboardScene[]
): string {
  const zoneLines = EMOTIONAL_CURVE_ZONES.map(
    (z) => `  ${z.range} = ${z.label} — ${z.direction}`
  ).join("\n");

  const sceneZones = (scenes || [])
    .map((scene, idx) => {
      const start = parseSceneStartSeconds(scene, idx, scenes!.length, totalDurationSeconds);
      const pct = (start / Math.max(1, totalDurationSeconds)) * 100;
      const zone = emotionalZoneForProgress(pct);
      const num = scene.scene ?? idx + 1;
      const targetEmotion = scene.emotion || scene.emotional_zone || zone.label;
      return `  Shot ${num} (~${Math.round(pct)}%): zone=${zone.label} | render emotion: ${targetEmotion} — do NOT stay emotionally neutral`;
    })
    .join("\n");

  return `
EMOTIONAL CURVE SYSTEM:

Force every shot to match its emotional zone. Most AI ads fail because every shot feels identical.

${zoneLines}

${sceneZones ? `Per-shot emotional assignment:\n${sceneZones}` : ""}

Emotion must gradually increase across the film — never flatline.
`.trim();
}

/** Expanded product interaction validation with state tracking. */
export function buildExpandedProductInteractionBlock(
  input: Pick<DirectorPipelineInput, "category" | "productName" | "userDescription">,
  scenes?: ExtendedStoryboardScene[]
): string {
  const product = input.productName || "the product";
  const sceneStates = (scenes || [])
    .map((s, i) => {
      const n = s.scene ?? i + 1;
      const ps = s.product_state || "track from prior scene";
      const cs = s.container_state || "track from prior scene";
      return `  Scene ${n}: product_state=${ps} | container_state=${cs} | liquid/food/object state must follow logically`;
    })
    .join("\n");

  return `
PRODUCT INTERACTION VALIDATION (expanded):

Track product state. Track container state. Track liquid state. Track food state. Track object state.
Prevent impossible actions.

REJECT:
❌ Oil from closed bottle
❌ Powder from sealed packet
❌ Coffee from closed jar
❌ Shampoo without pressing pump
❌ Liquid with no visible pour source
❌ Food appearing without package opening

Product: ${product}
${sceneStates || "Enforce state machine across all product interactions."}

Validate BEFORE rendering each frame. Only proceed when cause-and-effect chain is complete.
`.trim();
}

/** Dialogue / voiceover direction tied to beats and emotion. */
export function buildDialogueDirectionBlock(
  voiceoverScript?: string,
  scenes?: ExtendedStoryboardScene[],
  strategy?: DirectorPipelineInput["creativeStrategy"]
): string {
  const lines = (scenes || [])
    .map((s, i) => {
      const vo = (s.voiceover_line || s.voiceover_script || "").trim();
      if (!vo) return null;
      const beat = normalizeBeatLabel(s.beat) || "—";
      const dir = s.dialogue_direction || s.emotion || "natural, conversational";
      return `  [${beat}] "${vo}" — deliver with ${dir}; sync lip movement if on camera`;
    })
    .filter(Boolean);

  const fullScript = voiceoverScript?.trim();
  const hookLine = strategy?.creativeAngle || strategy?.hookType || "pattern interrupt";

  return `
DIALOGUE & VOICEOVER DIRECTION:

Full script must sound like a real person selling a real product — not AI ad copy.

Rules:
• Scene 1 line = scroll-stopping hook (${hookLine}) — short, punchy, spoken within 2s
• Problem beats = relatable tension, first or second person ("I used to...", "Tired of...")
• Product beats = clarity over poetry — say what it does
• Proof beats = specificity (numbers, results, social proof) not vague claims
• Payoff = confident CTA matched to goal: ${strategy?.cta || "Shop now / Try today"}
• Natural breath pauses between beats — do not rush
• Match dialogue energy to emotional zone of each shot

${fullScript ? `Full voiceover arc:\n"${fullScript}"` : ""}
${lines.length ? `\nPer-beat delivery:\n${lines.join("\n")}` : ""}
`.trim();
}

/** Beat-based storyboard section (replaces scene-only breakdown). */
export function buildBeatBasedStoryboardSection(
  scenes: ExtendedStoryboardScene[],
  formatShot: (scene: ExtendedStoryboardScene, globalIdx: number) => string
): string {
  if (!scenes.length) return "";

  const groups = groupScenesByBeat(scenes);
  const parts: string[] = [
    "BEAT-BASED STORYBOARD (beats first, shots second):",
    "",
    "Standard arc: Hook → Problem → Discovery → Product → Transformation → Payoff",
    "",
  ];

  for (const beat of AD_BEAT_SEQUENCE) {
    const beatScenes = groups.get(beat.label) || [];
    if (!beatScenes.length) continue;
    parts.push(`BEAT: ${beat.label.toUpperCase()} (${beat.zone} — ${beat.emotion})`);
    parts.push(`Purpose: ${beat.purpose}`);
    for (const scene of beatScenes) {
      const globalIdx = scenes.indexOf(scene);
      parts.push(formatShot(scene, globalIdx));
    }
    parts.push("");
  }

  parts.push("Every shot lives under a beat. No orphan shots without narrative purpose.");
  return parts.join("\n");
}

/** Script-generation instructions for generate-script API. */
export function buildScriptGenerationPipelineInstructions(options: {
  productName?: string;
  category?: string;
  durationSeconds: number;
  campaignGoal?: string;
  creativeFormat?: string;
}): string {
  const templateKey = detectShotTemplateKey({
    productName: options.productName,
    category: options.category,
    userDescription: "",
  });
  const template = PRODUCT_SHOT_TEMPLATES[templateKey] || PRODUCT_SHOT_TEMPLATES.generic;

  return `
GENERATION PIPELINE (follow this order):

1. CREATIVE STRATEGY — audience, pain, desire, angle, hook, CTA
2. DIRECTOR LAYER — why each beat exists, emotional arc, product reveal timing (~${Math.round(options.durationSeconds * 0.55)}s), camera motivation
3. BEAT PLAN — Hook → Problem → Discovery → Product → Transformation → Payoff (NOT random scenes)
4. STORYBOARD — create scenes UNDER each beat; each scene needs: beat, marketing_message, visual_description, shot_purpose, emotional_zone, transition_to_next, product_state, container_state, voiceover_line, dialogue_direction
5. EDITOR BRAIN — delete any shot that only "looks cool"
6. PRODUCT INTERACTION VALIDATION — track container/liquid/food/object state; no impossible actions
7. HUMAN BEHAVIOR — natural micro-actions, blinks, grip shifts, emotional reactions
8. CONTINUITY — same character, wardrobe, location, lighting, product across all scenes
9. TRANSITION PLAN — motivated cut between every scene
10. DIALOGUE — hook-first, beat-matched, natural delivery

PRODUCT SHOT TEMPLATE (${templateKey}):
${template.map((s, i) => `${i + 1}. ${s}`).join("\n")}

JSON storyboard fields REQUIRED per scene:
beat, marketing_message, visual_description, shot_purpose, emotional_zone, transition_to_next, product_state, container_state, voiceover_line, dialogue_direction, time_range, emotion, motion_style

Voiceover must improve: conversational hooks, specific benefits, proof lines, clear CTA — never generic filler.
`.trim();
}

/** Assemble all post-director layers in pipeline order. */
export function buildPostDirectorPipelineLayers(
  input: DirectorPipelineInput,
  scenes?: ExtendedStoryboardScene[]
): string {
  const total = input.totalDurationSeconds ?? input.clipDurationSeconds;
  return [
    buildEditorBrainBlock(scenes),
    buildExpandedProductInteractionBlock(input, scenes),
    HUMAN_BEHAVIOR_ENGINE_BLOCK,
    buildContinuityEngineBlock(input, scenes),
    buildTransitionPlannerBlock(scenes),
    buildEmotionalCurveBlock(total, scenes),
    buildDialogueDirectionBlock(input.voiceoverScript, scenes, input.creativeStrategy),
  ]
    .filter(Boolean)
    .join("\n\n");
}
