/**
 * Visual style playbooks — how each creative format is actually shot.
 *
 * The user's "Creative format" choice decides shot grammar, structure, pacing,
 * lighting and performance. Without it every commercial defaulted to one
 * continuous live-action scene. The director and the Seedance prompt both read
 * the playbook for the chosen style.
 */

export const CREATIVE_STYLE_IDS = [
  "commercial",
  "ugc",
  "lifestyle",
  "product_showcase",
  "motion_graphics",
  "cinematic",
] as const;

export type CreativeStyleId = (typeof CREATIVE_STYLE_IDS)[number];

/**
 * continuous: one unbroken scene of narrative time.
 * edited: one generation that plays as an edited sequence of shots with cuts.
 */
export type CreativeStructure = "continuous" | "edited";

export interface CreativeStylePlaybook {
  id: CreativeStyleId;
  label: string;
  structure: CreativeStructure;
  /** Approximate shot count for a 15s / 30s commercial in edited structure. */
  shotsPer15s?: [number, number];
  shotGrammar: string;
  pacing: string;
  lighting: string;
  performance: string;
  /** Production values that keep this style honest. */
  mustHave: string[];
}

const PLAYBOOKS: Record<CreativeStyleId, CreativeStylePlaybook> = {
  commercial: {
    id: "commercial",
    label: "Commercial",
    structure: "edited",
    shotsPer15s: [4, 6],
    shotGrammar:
      "Paid-ad grammar: a strong opening image, a mix of wide, medium and close shots, at least one tight product detail, and a clean product hero near the end. Motivated cuts on action.",
    pacing: "Punchy: a new shot every 2–3 seconds, accelerating into the product reveal, settling on the hero.",
    lighting: "Bright, clean, high production value; product well lit and colour-accurate.",
    performance: "Natural, expressive but not exaggerated; people react to the product, not to the camera.",
    mustHave: ["product clearly readable at least twice", "a hero shot of the real packaging"],
  },
  ugc: {
    id: "ugc",
    label: "UGC",
    structure: "continuous",
    shotGrammar:
      "Handheld phone footage from a real person's point of view or a front-camera selfie framing; slight natural shake, real home or street location, product held close to the lens.",
    pacing: "Casual and quick, like a Reel; no glossy transitions.",
    lighting: "Available light only — window light, room light; nothing that looks like a studio.",
    performance: "Relaxed, authentic, everyday body language; looks like a customer, not a model.",
    mustHave: ["vertical phone look", "product shown in a real hand in a real place"],
  },
  lifestyle: {
    id: "lifestyle",
    label: "Lifestyle",
    structure: "edited",
    shotsPer15s: [3, 5],
    shotGrammar:
      "The product inside real life: medium shots of people in a believable setting, the product used naturally, a couple of warm detail inserts.",
    pacing: "Relaxed rhythm, shots of 3–4 seconds, gentle cuts.",
    lighting: "Soft natural daylight or practical home light, warm and inviting.",
    performance: "Small, true moments — sharing, using, enjoying — never posed.",
    mustHave: ["a recognisable everyday setting", "the product used the way customers really use it"],
  },
  product_showcase: {
    id: "product_showcase",
    label: "Product Showcase",
    structure: "edited",
    shotsPer15s: [4, 6],
    shotGrammar:
      "Tabletop / studio product film: macro close-ups of texture and details, slow controlled camera moves (push-in, orbit, slider), ingredient or material inserts, a final centred hero shot. People optional — hands only if needed.",
    pacing: "Smooth and deliberate; each shot 2–3 seconds with clean match cuts.",
    lighting: "Controlled studio lighting with soft key and rim light; rich, true product colours on a simple surface or backdrop.",
    performance: "No acting — the product is the performer. Hands, if shown, move precisely and slowly.",
    mustHave: ["texture close-ups", "packaging shown accurately from the reference", "clean hero shot"],
  },
  motion_graphics: {
    id: "motion_graphics",
    label: "Motion Graphics",
    structure: "edited",
    shotsPer15s: [4, 7],
    shotGrammar:
      "Design-led motion piece: the real product photographed cleanly and animated against bold colour fields, geometric shapes, graphic wipes and transitions, rhythmic camera moves. Leave clean empty space for text that will be added in post — do not draw any text or letters.",
    pacing: "Rhythmic and beat-driven; snappy graphic transitions every 1.5–2.5 seconds.",
    lighting: "Flat, graphic, high-key lighting with strong brand-colour backgrounds.",
    performance: "Usually no people; if present, stylised and brief.",
    mustHave: ["bold brand colours", "graphic transitions", "empty negative space for later text"],
  },
  cinematic: {
    id: "cinematic",
    label: "Cinematic",
    structure: "continuous",
    shotGrammar:
      "Film-style storytelling: composed frames, motivated camera moves, depth and atmosphere; the story leads and the product lands as its resolution.",
    pacing: "Measured, emotional; lets moments breathe before the product resolve.",
    lighting: "Motivated, filmic lighting with real light sources and contrast; grounded, not fantasy.",
    performance: "Restrained, emotionally truthful acting.",
    mustHave: ["a clear emotional turn", "the product as the story's payoff"],
  },
};

const UI_FORMAT_TO_STYLE: Record<string, CreativeStyleId> = {
  commercial: "commercial",
  ugc: "ugc",
  lifestyle: "lifestyle",
  "product showcase": "product_showcase",
  product_showcase: "product_showcase",
  "motion graphics": "motion_graphics",
  motion_graphics: "motion_graphics",
  cinematic: "cinematic",
};

/** Map a Studio "Creative format" label (or style id) to a style id. */
export function normalizeCreativeStyle(value: unknown): CreativeStyleId | undefined {
  if (typeof value !== "string") return undefined;
  return UI_FORMAT_TO_STYLE[value.trim().toLowerCase()];
}

export function getCreativeStylePlaybook(id: CreativeStyleId | undefined): CreativeStylePlaybook {
  return PLAYBOOKS[id ?? "commercial"];
}

/**
 * Grounding rule for every style: generic "warmth" or "magic" language in a
 * concept otherwise turns into glowing light rays and sparkles from the product.
 */
export const REALISM_RULE =
  "Keep everything physically real: no glowing light rays, sparkles, auras, beams or magical effects coming from the product or people, unless the brief explicitly asks for fantasy. Express emotion through performance, light and colour that exist in the scene.";

/** Prompt block shared by the director and the video prompt. */
export function creativeStyleToPromptBlock(playbook: CreativeStylePlaybook, durationSeconds: number): string {
  const shots =
    playbook.structure === "edited" && playbook.shotsPer15s
      ? `${Math.round((playbook.shotsPer15s[0] * durationSeconds) / 15)}–${Math.round(
          (playbook.shotsPer15s[1] * durationSeconds) / 15
        )} shots`
      : "one continuous scene";
  return [
    `Style: ${playbook.label} (${shots}).`,
    `Shot grammar: ${playbook.shotGrammar}`,
    `Pacing: ${playbook.pacing}`,
    `Lighting: ${playbook.lighting}`,
    `Performance: ${playbook.performance}`,
    `Must have: ${playbook.mustHave.join("; ")}.`,
  ].join(" ");
}
