/**
 * Gemini 3.8 Flash TTS — generate commercial voiceover audio.
 * Uses Interactions API (gemini-3.8-flash-tts).
 */

import { GoogleGenAI } from "@google/genai";
import { getGeminiTtsApiKeyCandidates, GEMINI_REST_BASE } from "@/lib/gemini-config";
import {
  defaultTtsVoiceForLanguage,
  normalizeVoiceoverLanguage,
  type VoiceoverLanguage,
  voiceoverLanguageDisplayName,
} from "./voiceover-languages";

export const GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";

const TTS_REQUEST_TIMEOUT_MS = 90_000;

export interface GenerateGeminiTtsInput {
  script: string;
  language: VoiceoverLanguage | string;
  tone?: string;
  voice?: string;
  /** Include CTA emphasis in delivery style. */
  ctaEnabled?: boolean;
}

export interface GenerateGeminiTtsResult {
  audioBuffer: Buffer;
  mimeType: string;
  model: string;
  voice: string;
  language: VoiceoverLanguage;
}

function styleForTone(tone?: string, ctaEnabled?: boolean): string {
  const base =
    tone === "Calm"
      ? "calm, warm, clear commercial narrator"
      : tone === "Premium"
        ? "premium, refined, confident commercial narrator"
        : tone === "Fun"
          ? "friendly, upbeat, playful commercial narrator"
          : "energetic, clear, persuasive commercial narrator";
  return ctaEnabled === false
    ? `${base}, natural pacing, no hard sell push`
    : `${base}, confident close on the call to action`;
}

function extractAudioFromInteraction(interaction: {
  outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
  output_audio?: { data?: string; mime_type?: string };
}): { data: string; mimeType: string } | null {
  const convenience = interaction.output_audio;
  if (convenience?.data) {
    return {
      data: convenience.data,
      mimeType: convenience.mime_type || "audio/wav",
    };
  }
  const outputs = interaction.outputs || [];
  for (let i = outputs.length - 1; i >= 0; i--) {
    const part = outputs[i];
    if (part?.type === "audio" && part.data) {
      return {
        data: part.data,
        mimeType: part.mime_type || "audio/wav",
      };
    }
  }
  return null;
}

async function generateViaSdk(input: {
  script: string;
  style: string;
  voice: string;
  apiKey: string;
}): Promise<GenerateGeminiTtsResult["audioBuffer"]> {
  const client = new GoogleGenAI({ apiKey: input.apiKey });
  const interaction = await client.interactions.create({
    model: GEMINI_TTS_MODEL,
    input: [
      {
        type: "user_input",
        content: [
          {
            type: "text",
            text: input.script,
            annotations: [
              {
                type: "speech_metadata",
                style: input.style,
              },
            ],
          },
        ],
      } as never,
    ],
    response_format: { type: "audio" },
    response_modalities: ["audio"],
    generation_config: {
      speech_config: [{ voice: input.voice }],
    },
  } as never);

  const extracted = extractAudioFromInteraction(interaction as never);
  if (!extracted?.data) {
    throw new Error("Gemini TTS returned no audio payload");
  }
  return Buffer.from(extracted.data, "base64");
}

/** A non-OK answer from the TTS API, keeping the status so key problems can be told apart. */
export class GeminiTtsHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GeminiTtsHttpError";
  }
}

/** The API refused this key (wrong, expired, restricted or without access to the TTS model). */
export function isKeyRejected(err: unknown): boolean {
  if (err instanceof GeminiTtsHttpError && (err.status === 401 || err.status === 403)) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /api key not valid|api_key_invalid|permission[_ ]denied|unauthenticated|invalid authentication|api key expired/i.test(msg);
}

async function generateViaRest(input: {
  script: string;
  style: string;
  voice: string;
  apiKey: string;
}): Promise<Buffer> {
  const res = await fetch(`${GEMINI_REST_BASE}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    signal: AbortSignal.timeout(TTS_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: input.script,
              annotations: [
                {
                  type: "speech_metadata",
                  style: input.style,
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{ voice: input.voice }],
      },
    }),
  });

  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Gemini TTS HTTP ${res.status}: non-JSON response`);
  }
  const json = parsed as {
    error?: { message?: string };
    output_audio?: { data?: string; mime_type?: string };
    outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
    steps?: Array<{
      type?: string;
      content?: Array<{ type?: string; data?: string; mime_type?: string }>;
    }>;
  };

  if (!res.ok) {
    throw new GeminiTtsHttpError(res.status, json.error?.message || `Gemini TTS HTTP ${res.status}`);
  }

  const fromOutputs = extractAudioFromInteraction(json);
  if (fromOutputs?.data) {
    return Buffer.from(fromOutputs.data, "base64");
  }

  // Raw REST sometimes nests audio under steps[].content[]
  const steps = json.steps || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const contents = steps[i]?.content || [];
    for (let j = contents.length - 1; j >= 0; j--) {
      const part = contents[j];
      if (part?.type === "audio" && part.data) {
        return Buffer.from(part.data, "base64");
      }
    }
  }

  throw new Error("Gemini TTS response contained no audio data");
}

/**
 * One key: REST first (the @google/genai 1.x SDK path is rejected by the API as
 * "legacy Interactions API"), one retry for transient 5xx / timeouts, SDK last.
 * A rejected key fails straight away — retrying it can't help.
 */
async function generateWithKey(input: { script: string; style: string; voice: string; apiKey: string }): Promise<Buffer> {
  try {
    return await generateViaRest(input);
  } catch (firstErr) {
    if (isKeyRejected(firstErr)) throw firstErr;
    console.warn("[gemini-tts] REST attempt 1 failed, retrying:", firstErr instanceof Error ? firstErr.message : firstErr);
    try {
      return await generateViaRest(input);
    } catch (restErr) {
      if (isKeyRejected(restErr)) throw restErr;
      console.warn("[gemini-tts] REST attempt 2 failed, trying SDK:", restErr instanceof Error ? restErr.message : restErr);
      try {
        return await generateViaSdk(input);
      } catch {
        throw restErr;
      }
    }
  }
}

/**
 * Synthesize voiceover WAV for an Indian-language commercial script.
 */
export async function generateGeminiTtsVoiceover(
  input: GenerateGeminiTtsInput
): Promise<GenerateGeminiTtsResult> {
  const keys = getGeminiTtsApiKeyCandidates();
  if (!keys.length) {
    throw new Error(
      "GEMINI_TTS_API_KEY (or GEMINI_API_KEY) is required for Tamil/Hindi/Malayalam/Kannada voiceover (Gemini 3.8 Flash TTS)."
    );
  }

  const language = normalizeVoiceoverLanguage(input.language);
  const script = input.script?.trim();
  if (!script) {
    throw new Error(
      `Voiceover script is empty for ${voiceoverLanguageDisplayName(language)} TTS.`
    );
  }

  const voice = input.voice || defaultTtsVoiceForLanguage(language);
  const style = styleForTone(input.tone, input.ctaEnabled);

  // A rejected key (401/403) won't succeed on retry: move to the next configured
  // key instead, and log which variable failed so it can be fixed in Vercel.
  let audioBuffer: Buffer | null = null;
  let lastErr: unknown = null;
  for (const { source, key } of keys) {
    try {
      audioBuffer = await generateWithKey({ script, style, voice, apiKey: key });
      if (source !== keys[0].source) {
        console.warn(`[gemini-tts] ${keys[0].source} was rejected; voiceover used ${source}. Update ${keys[0].source} in the environment.`);
      }
      break;
    } catch (err) {
      lastErr = err;
      if (!isKeyRejected(err)) throw err;
      console.error(`[gemini-tts] ${source} was rejected by Gemini TTS (${err instanceof Error ? err.message : err}); trying the next key.`);
    }
  }
  if (!audioBuffer) {
    throw new Error(
      `The voiceover service rejected every configured Gemini key (${keys.map((k) => k.source).join(", ")}). ${lastErr instanceof Error ? lastErr.message : ""}`.trim()
    );
  }

  if (!audioBuffer.length) {
    throw new Error("Gemini TTS produced an empty audio buffer");
  }

  return {
    audioBuffer,
    mimeType: "audio/wav",
    model: GEMINI_TTS_MODEL,
    voice,
    language,
  };
}
