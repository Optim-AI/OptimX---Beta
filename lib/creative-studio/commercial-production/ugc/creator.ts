/**
 * UGC creator helpers: draw a creator from a description (Nano Banana), and
 * check an uploaded photo before it is used in a video.
 */

import sharp from "sharp";
import { generateGeminiImage } from "@/lib/creative-studio/nano-banana";
import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import type { UgcCreatorKind } from "../campaign/ugc";

export const CREATOR_PORTRAIT_SIZE = 768;
const CHECK_MODEL = "gemini-3.8-flash";
const CHECK_TIMEOUT_MS = 30_000;

export function buildCreatorPortraitPrompt(kind: UgcCreatorKind, description: string): string {
  const subject = description.trim();
  if (kind === "mascot") {
    return `A clean character portrait of ${subject}. Friendly, appealing, high-quality 3D animated character style, head and shoulders, facing the camera, soft plain light-grey background, even soft lighting. No text, no logos.`;
  }
  if (kind === "animal") {
    return `A natural, realistic smartphone-style portrait photo of ${subject}, head and shoulders, looking at the camera, soft daylight, plain softly blurred home background. Photorealistic, sharp eyes. No text, no logos, no people.`;
  }
  return `A natural, realistic smartphone-style portrait photo of a ${subject}. Head and shoulders, looking at the camera with a friendly, relaxed expression, soft window daylight, plain softly blurred home background. Real skin texture, no heavy retouching, no glamour lighting. This is a fictional person, not anyone famous. No text, no logos.`;
}

/** Square JPEG, small enough to save with the session and send as a reference. */
export async function toCreatorJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(CREATOR_PORTRAIT_SIZE, CREATOR_PORTRAIT_SIZE, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function generateCreatorPortrait(input: {
  kind: UgcCreatorKind;
  description: string;
  operationLabel?: string;
}): Promise<Buffer> {
  const result = await generateGeminiImage({
    prompt: buildCreatorPortraitPrompt(input.kind, input.description),
    aspectRatio: "1:1",
    operationLabel: input.operationLabel || "ugc-creator-portrait",
    maxRetries: 2,
  });
  return toCreatorJpeg(result.buffer);
}

export interface CreatorPhotoCheck {
  ok: boolean;
  /** Plain message for the owner when the photo can't be used. */
  reason?: string;
  kind?: UgcCreatorKind;
}

export function parseCreatorPhotoCheck(raw: string): CreatorPhotoCheck {
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as {
      subject?: string;
      famous?: boolean;
      child?: boolean;
      clear?: boolean;
    };
    const kind: UgcCreatorKind | undefined =
      parsed.subject === "animal" ? "animal" : parsed.subject === "cartoon" ? "mascot" : parsed.subject === "person" ? "person" : undefined;
    if (!kind) return { ok: false, reason: "We couldn't find a person, animal or character in this photo. Please try a clearer photo." };
    if (parsed.famous) return { ok: false, reason: "This looks like a well-known person. Please use a photo of someone who has given you permission." };
    if (parsed.child) return { ok: false, reason: "Photos of children can't be used as the creator. Please choose an adult, an animal or a mascot." };
    if (parsed.clear === false) return { ok: false, reason: "The face isn't clear enough. Please use a well-lit photo looking at the camera.", kind };
    return { ok: true, kind };
  } catch {
    return { ok: false, reason: "We couldn't check this photo right now. Please try again." };
  }
}

/** Gemini vision check: what is in the photo, and is it safe and usable as a creator? */
export async function checkCreatorPhoto(image: { mimeType: string; data: string }): Promise<CreatorPhotoCheck> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to check the photo.");
  const res = await fetch(`${GEMINI_REST_BASE}/models/${CHECK_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: image.mimeType, data: image.data } },
            {
              text: `This photo will be the on-screen creator in a short ad video. Answer as JSON only:
{"subject": "person" | "animal" | "cartoon" | "none", "famous": boolean, "child": boolean, "clear": boolean}
- subject: the main subject.
- famous: true only if the person is clearly a celebrity, politician or other widely recognised public figure.
- child: true if the main person looks under 18.
- clear: true if the main face (or animal/character) is visible and reasonably sharp.`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Photo check failed (HTTP ${res.status})`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return parseCreatorPhotoCheck(json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "");
}
