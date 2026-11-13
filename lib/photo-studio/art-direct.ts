/**
 * The art director: writes the scene for ONE shot of ONE product.
 *
 * The shot library says what kind of photo it is ("kitchen counter", "flat lay");
 * a fixed template can only fill in a few props, so every product got the same
 * set. Here a text model plans the photo the way a stylist would — a setting, props,
 * camera angle, product pose and light chosen for this product and its buyer.
 *
 * Non-fatal: any failure returns null and the shot falls back to its template.
 */

import sharp from "sharp";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { parseJsonLoose } from "@/lib/research/gemini";
import type { ProductProfile, ShootSettings, ShotBrief, ShotDefinition, ShotMethod } from "./types";

export type ArtDirectorInput = {
  shot: ShotDefinition;
  /** How the shot will be made (a shot without a cut-out is rendered guided) */
  method: ShotMethod;
  profile: ProductProfile;
  settings: ShootSettings;
  /** The shot's template direction — the brief must stay this kind of photo */
  template: string;
  /** Lighting the person picked, in words; null = the art director chooses */
  lighting: string | null;
  /** Who appears in people shots, in words */
  person: string | null;
  /** 0 = first take, 1 = a clearly different second take */
  variation?: number;
  /** Product photo (the clean master when there is one) */
  image?: Buffer;
};

export type ArtDirector = (input: ArtDirectorInput) => Promise<ShotBrief | null>;

const REQUEST_TIMEOUT_MS = 25_000;
const MIN_SCENE_CHARS = 60;
const MAX_SCENE_CHARS = 900;

function productLines(p: ProductProfile): string {
  return [
    `Product: ${p.name} — ${p.productType || p.category || "product"}.`,
    p.look ? `Looks like: ${p.look}.` : "",
    `Category: ${p.category || "unspecified"}. Finish: ${p.finish || "unspecified"}. Real-world size: ${p.sizeClass}.`,
    p.audience ? `Bought by: ${p.audience}.` : "",
    p.usageContexts.length ? `Used in: ${p.usageContexts.join("; ")}.` : "",
    p.storyProps.length ? `Things that tell its story: ${p.storyProps.join(", ")}.` : "",
    p.notes ? `Photographer's notes: ${p.notes}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** A different mood per shot (stable for a shot), so one shoot has range. */
const MOODS = [
  "warm and rustic — aged wood, brass and earthy browns, low golden side light",
  "dark and moody — black stone or slate, deep shadows, one soft shaft of light on the product",
  "traditional and homely — terracotta, banana leaf, woven cane and steel, warm afternoon sun",
  "fresh and airy — pale linen or stone, soft morning daylight, green accents",
];

export function moodFor(shot: ShotDefinition): string {
  // Themed sets and studio shots bring their own look.
  if (shot.group === "creative") return "as the template describes";
  let h = 0;
  for (const ch of shot.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOODS[h % MOODS.length];
}

/** What the method can and cannot do — the brief must be shootable. */
function methodRules(method: ShotMethod, pose: ShotDefinition["pose"]): string {
  if (method === "scene" && pose === "laid") {
    return [
      "HOW THIS SHOT IS MADE: a top-down flat lay. The camera looks straight down. The real product photo is placed lying flat on the surface, label up, turned at a slight angle, and the set is built around it. The product cannot be opened, poured, held or stood up.",
      "Everything else is yours: the surface, and the props lying flat around the product with deliberate spacing. Nothing overlaps the product. No people or hands.",
      'Set "placement" to "centre".',
    ].join("\n");
  }
  if (method === "scene") {
    return [
      "HOW THIS SHOT IS MADE: the real product photo is placed in the frame and the set is built around it. So the product MUST stand upright, closed, facing the camera at eye level, exactly as in the photo. It cannot be tilted, opened, poured, held, laid down or seen from above.",
      "Everything else is yours: the place, the surface it stands on, the props beside and behind it, depth and light. Keep a clear hand's width around the product: props sit beside or behind it, never touching or in front of it. No people or hands.",
      'Also choose "placement": where the product stands — "left", "centre" or "right" — and compose the scene to balance it (for example the product on the left third and the dish it goes with on the right). Do not always choose the centre.',
    ].join("\n");
  }
  return [
    "HOW THIS SHOT IS MADE: the whole photograph is rendered from the product photo, so the camera angle and the product's pose are free: three-quarter view, low angle, top-down, lying on its side, tilted, open, being poured, scooped, held or worn.",
    "Use that freedom. Do NOT write the product standing upright in the centre facing the camera — the other shots in this shoot already do that. Follow the angle, pose and action the house template asks for (a macro shot is a tight macro; an in-use shot shows the action).",
    "Keep the front label towards the camera — except in a close-up of material, texture or contents, where the label's printed text must be out of the frame or far out of focus. Never plan a close-up of printed text.",
    'Set "placement" to "centre".',
  ].join("\n");
}

/** Two briefs at the level of detail and styling we want (other products, so they are not copied). */
const EXAMPLES = [
  'Example for a masala pouch, upright product: "On a weathered teak kitchen ledge in an old Chettinad house, the product stands on the left third. To its right, a black clay pot of chicken curry sends up a thin curl of steam, a brass ladle resting on its rim; behind, out of focus, a row of steel dabbas and a bunch of curry leaves. Low morning light rakes in from a window on the right, warm on the wood, with deep soft shadows."',
  'Example for a snack pouch, free pose: "Shot from the passenger seat of a car on a bright afternoon: a hand holds the open product at chest height, tilted towards the camera with the label readable, two fingers of the other hand lifting out a piece. A denim jacket sleeve, the steering wheel and a sunlit street blur softly behind. Natural side light through the window, shallow depth of field."',
].join("\n");

export function artDirectorPrompt(input: ArtDirectorInput): string {
  const { shot, profile, settings } = input;
  const second = (input.variation ?? 0) % 2 === 1;
  return [
    "You are the art director and prop stylist on a product shoot for an Indian brand. Plan ONE photograph.",
    "",
    productLines(profile),
    "",
    `THE SHOT: "${shot.label}" — ${shot.description} It is used for: ${shot.purpose}.`,
    `The house template for this shot: ${input.template}`,
    "The template decides the kind of place, the surface, the mood and the light — keep those (a rustic wooden table stays a rustic wooden table). Your job is to make it specific to this product: the exact props, the dish, the details, the composition.",
    `Where the template leaves the look open, lean this way, so the shots in one shoot don't all look alike: ${moodFor(shot)}.`,
    "",
    methodRules(input.method, shot.pose),
    "",
    "WRITE THE SCENE like a brief to the photographer, in 60 to 110 words, one paragraph:",
    "- A specific, believable place and surface that this product's buyer would recognise from their own life (Indian homes, kitchens, shops and streets where it fits; never a generic stock set).",
    "- Styling with character: tactile natural surfaces (aged wood, stone, brass, steel, linen, clay, banana leaf), layers in front of and behind the product softly out of focus, directional light with real shadows. Rich, warm and appetising beats clean and empty: no bare counters, no plain tiled or white walls, no bright modern showroom kitchens.",
    "- Three to five named props that belong with THIS product — the dish it is cooked into, the ingredient it is made from, the thing it is used with. Name real things (\"a steel kadai of quinoa upma with curry leaves\"), not categories (\"some food\").",
    "- The camera angle and how the product sits or is handled, within the rules above.",
    input.lighting
      ? `- Lighting is already decided: ${input.lighting}. Describe the scene to suit it.`
      : "- The light: its direction, quality and time of day, chosen to flatter this product.",
    shot.group === "studio" || shot.group === "catalogue" ? `- The set's colours harmonise with the brand colour ${settings.backdrop}.` : "",
    input.person ? `- The person in the shot: ${input.person}. Natural and candid, plain unbranded clothing.` : "",
    "- Refer to it only as \"the product\". No other brands, logos, packaging or readable text anywhere in the scene.",
    second
      ? "- This is the SECOND TAKE: do not write the obvious first idea. Choose a clearly different place, surface, props and camera angle from the one most people would pick first."
      : "",
    "",
    EXAMPLES,
    "",
    'Return JSON only: {"scene": "...", "placement": "left|centre|right"}',
  ]
    .filter((line) => line !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function parseShotBrief(text: string): ShotBrief | null {
  const raw = parseJsonLoose<{ scene?: unknown; placement?: unknown }>(text);
  const scene = typeof raw?.scene === "string" ? raw.scene.replace(/\s+/g, " ").trim() : "";
  if (scene.length < MIN_SCENE_CHARS) return null;
  const placement = raw?.placement === "left" || raw?.placement === "right" || raw?.placement === "centre" ? raw.placement : undefined;
  return { scene: scene.slice(0, MAX_SCENE_CHARS), placement };
}

/** Live art director (Gemini). Null when no key, on timeout or on a bad answer. */
export const writeShotBrief: ArtDirector = async (input) => {
  const key = getGeminiApiKey();
  if (!key) return null;
  try {
    const parts: Array<Record<string, unknown>> = [];
    if (input.image) {
      const small = await sharp(input.image).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      parts.push({ inline_data: { mime_type: "image/jpeg", data: small.toString("base64") } });
    }
    parts.push({ text: artDirectorPrompt(input) });
    const res = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_REST_BASE}/models/${process.env.PHOTO_STUDIO_VISION_MODEL || "gemini-3.8-flash"}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          // A little warmth so two shoots of similar products don't get the same set.
          generationConfig: { temperature: (input.variation ?? 0) % 2 ? 1 : 0.8, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
      { maxRetries: 1, operationLabel: "photo-studio-art-director" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return parseShotBrief((json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
  } catch {
    return null;
  }
};
