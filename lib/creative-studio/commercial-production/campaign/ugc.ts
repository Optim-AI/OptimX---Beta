/**
 * UGC Studio — user-generated-content style ads built around one on-screen
 * "creator" (a person, an animal or a mascot) from the owner's photo, a preset
 * face, or one we generated from a description.
 *
 * How the words are delivered (UgcSpeech):
 * - native: talk to camera in English — the video model speaks, lips match.
 * - presenter: talk to camera in an Indian language. The video model only speaks
 *   English, so the creator says a short English hello on camera ("Hey friends!" —
 *   people mix English in naturally), then shows and reacts with closed-mouth
 *   expressions while our voice continues in their language from that same hello.
 * - voiceover: the creator acts and reacts silently while the voice is added.
 * Presenter and voice-over videos can be re-voiced into other languages without
 * generating them again.
 */

import type { StoredAssetRef } from "../assets";
import { normalizeVoiceoverLanguage, usesGeminiTts } from "../audio/voiceover-languages";

export type UgcCreatorKind = "person" | "animal" | "mascot";
export type UgcDelivery = "talk_to_camera" | "voiceover";
export type UgcVoiceGender = "female" | "male";
export type UgcFormatId =
  | "review"
  | "unboxing"
  | "problem_solution"
  | "how_i_use"
  | "reaction"
  | "day_in_life";

export interface UgcCreator {
  kind: UgcCreatorKind;
  /** Shown to the owner, e.g. "Meera" or "Bruno the beagle". */
  name?: string;
  /** What they look like, used when there is no photo and to steady the look. */
  description?: string;
  /** Reference photo of the creator — kept identical in the video. */
  image?: StoredAssetRef;
  /** Preset library id when picked from our faces. */
  presetId?: string;
  /** Voice for the voice-over. Animals and mascots get a playful voice. */
  voiceGender?: UgcVoiceGender;
}

export type UgcSpeech = "native" | "presenter" | "voiceover";

export interface CampaignUgcInput {
  creator: UgcCreator;
  format: UgcFormatId;
  delivery: UgcDelivery;
  /** Resolved from delivery + language (see the header). */
  speech: UgcSpeech;
}

/** The English hello said on camera in presenter videos; the voice-over starts with it too. */
export const UGC_PRESENTER_GREETING = "Hey friends!";

export const UGC_FORMATS: Record<UgcFormatId, { label: string; hint: string; prompt: string }> = {
  review: {
    label: "Honest review",
    hint: "Tells friends why they love it",
    prompt:
      "An honest customer review: the creator holds the product close, shows it, uses it once and gives a genuine thumbs-up moment.",
  },
  unboxing: {
    label: "Unboxing",
    hint: "Opens it for the first time",
    prompt:
      "A first-time unboxing: the parcel or pack is opened in real hands, the product is revealed and turned to the camera, then tried for the first time.",
  },
  problem_solution: {
    label: "Problem → solution",
    hint: "A daily problem, fixed by your product",
    prompt:
      "Problem then solution: the creator shows a small everyday frustration, then the product fixes it and their mood lifts.",
  },
  how_i_use: {
    label: "How I use it",
    hint: "A quick real-life demo",
    prompt:
      "A quick how-I-use-it demo: the creator shows the real steps of using the product, close to the camera, in their own space.",
  },
  reaction: {
    label: "First reaction",
    hint: "Tries it and reacts",
    prompt:
      "A first-try reaction: the creator tries the product on camera and reacts with a natural, genuine surprise or delight.",
  },
  day_in_life: {
    label: "Day in my life",
    hint: "Your product in their routine",
    prompt:
      "A day-in-my-life snippet: a few quick moments of the creator's routine where the product naturally fits in.",
  },
};

const KINDS: UgcCreatorKind[] = ["person", "animal", "mascot"];
const MAX_TEXT = 300;

function pick<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT) : undefined;
}

/** Runway speaks English only, so talking in other languages becomes the presenter style. */
export function ugcSpeechFor(delivery: UgcDelivery, language: string | undefined): UgcSpeech {
  if (delivery === "voiceover") return "voiceover";
  return usesGeminiTts(normalizeVoiceoverLanguage(language)) ? "presenter" : "native";
}

/**
 * Keep known values only. `image` must already be a StoredAssetRef (the studio
 * mapper builds it from the photo URL).
 */
export function normalizeUgc(
  raw: unknown,
  language: string | undefined,
  image?: StoredAssetRef | null
): CampaignUgcInput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const c = (r.creator && typeof r.creator === "object" ? r.creator : {}) as Record<string, unknown>;
  const creator: UgcCreator = {
    kind: pick(KINDS, c.kind) ?? "person",
    name: text(c.name),
    description: text(c.description),
    image: image ?? undefined,
    presetId: text(c.presetId),
    voiceGender: pick(["female", "male"] as const, c.voiceGender),
  };
  if (!creator.image && !creator.description) return undefined;
  const format = pick(Object.keys(UGC_FORMATS) as UgcFormatId[], r.format) ?? "review";
  const delivery = pick(["talk_to_camera", "voiceover"] as const, r.delivery) ?? "voiceover";
  return { creator, format, delivery, speech: ugcSpeechFor(delivery, language) };
}

/** True when the words are added after generation (Indian languages, UGC presenter or voice-over). */
export function usesExternalVoiceover(brief: {
  voiceover?: { language?: string };
  ugc?: CampaignUgcInput;
}): boolean {
  if (brief.ugc) return brief.ugc.speech !== "native";
  return usesGeminiTts(brief.voiceover?.language);
}

/** Presenter videos: the voice-over opens with the same English hello the creator says on camera. */
export function withPresenterGreeting(script: string, ugc: CampaignUgcInput | undefined): string {
  if (ugc?.speech !== "presenter") return script;
  const trimmed = script.trim();
  return trimmed.toLowerCase().startsWith(UGC_PRESENTER_GREETING.toLowerCase().replace(/!$/, ""))
    ? trimmed
    : `${UGC_PRESENTER_GREETING} ${trimmed}`;
}

/** Gemini TTS voice that suits the creator. */
export function ugcVoiceFor(creator: UgcCreator): string | undefined {
  if (creator.kind !== "person") return "Puck";
  if (creator.voiceGender === "male") return "Charon";
  if (creator.voiceGender === "female") return "Kore";
  return undefined;
}

const UGC_SPEECH_DIRECTION: Record<UgcSpeech, string> = {
  native:
    "The creator looks into the lens and SPEAKS the lines to the viewer, like a friend recommending it; their mouth movement matches the speech.",
  presenter: `The creator talks to the camera like a vlogger: looking into the lens, they say ONLY "${UGC_PRESENTER_GREETING}" in English in the first 1–2 seconds, with a warm wave or smile. After that they do NOT speak — mouth closed or smiling, no lip movement — and keep facing the camera, showing, using and reacting to the product with expressive faces (raised eyebrows, nods, delighted smiles, pointing at the product, a thumbs-up) as if their own voice-over is playing.`,
  voiceover:
    "The creator does NOT speak — mouth closed or smiling, no lip movement. They show, use and react to the product while an unseen voice is added later.",
};

/**
 * Runway's Seedance refuses realistic human faces as reference images
 * (INPUT_PREPROCESSING.SAFETY.THIRD_PARTY), so people are described in words;
 * animals and mascots still send their photo.
 */
export function creatorPhotoGoesToVideo(creator: UgcCreator | undefined): boolean {
  return Boolean(creator?.image?.url) && creator?.kind !== "person";
}

function creatorLabel(creator: UgcCreator): string {
  const what =
    creator.kind === "animal" ? "an animal" : creator.kind === "mascot" ? "a cartoon mascot character" : "a real person";
  return [creator.name ? `"${creator.name}"` : undefined, `(${what})`, creator.description ? `— ${creator.description}` : undefined]
    .filter(Boolean)
    .join(" ");
}

export function ugcToPromptBlock(ugc: CampaignUgcInput | undefined, opts: { hasProductPhotos?: boolean } = {}): string {
  if (!ugc) return "";
  const { creator } = ugc;
  const lines = [
    `UGC CREATOR VIDEO (CRITICAL): a user-generated-content style ad starring ONE creator: ${creatorLabel(creator)}.`,
    creatorPhotoGoesToVideo(creator)
      ? `The creator reference image${opts.hasProductPhotos ? " comes after the product reference image(s)" : ""} — keep the creator's face, body, colouring and look exactly the same as that photo in every moment. Do not swap or add other main characters.`
      : `Keep the creator's look identical from start to end${creator.description ? ` — always the same ${creator.description}` : ""}. Do not swap or add other main characters.`,
    `Format: ${UGC_FORMATS[ugc.format].prompt}`,
    "Shot like a real creator's phone video: vertical, handheld or propped-up phone, front-camera framing, natural room or outdoor light, the product close to the lens and clearly readable.",
  ];
  if (creator.kind === "animal") {
    lines.push("The animal behaves like a lovable character — expressive face and paws, interacting with the product playfully — but stays the same real-looking animal.");
  }
  if (creator.kind === "mascot") {
    lines.push("The mascot is a stylised animated character interacting with the real product in a real place.");
  }
  lines.push(UGC_SPEECH_DIRECTION[ugc.speech]);
  return lines.join("\n");
}

/** One line for the voice-over script writer. */
export function ugcVoiceoverContext(ugc: CampaignUgcInput | undefined): string | undefined {
  if (!ugc) return undefined;
  const persona =
    ugc.creator.kind === "person"
      ? "the creator talking to friends"
      : `the ${ugc.creator.kind === "animal" ? "animal" : "mascot"} as a fun first-person character`;
  const opening =
    ugc.speech === "presenter"
      ? `. Start with exactly "${UGC_PRESENTER_GREETING}" in English, then continue in the chosen language, mixing in everyday English words the way people really talk`
      : "";
  return `UGC ${UGC_FORMATS[ugc.format].label}: write in first person as ${persona} — casual, honest, like a real social post, not an announcer${opening}`;
}
