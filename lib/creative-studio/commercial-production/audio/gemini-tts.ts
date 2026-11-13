/**
 * Gemini 3.8 Flash TTS — generate commercial voiceover audio.
 * Uses Interactions API (gemini-3.8-flash-tts).
 */

import { GoogleGenAI } from "@google/genai";
import { getGeminiTtsApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
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
    throw new Error(json.error?.message || `Gemini TTS HTTP ${res.status}`);
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
 * Synthesize voiceover WAV for an Indian-language commercial script.
 */
export async function generateGeminiTtsVoiceover(
  input: GenerateGeminiTtsInput
): Promise<GenerateGeminiTtsResult> {
  const apiKey = getGeminiTtsApiKey();
  if (!apiKey) {
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

  // REST first: the @google/genai 1.x SDK path is rejected by the API
  // ("legacy Interactions API"), so trying it first only adds latency.
  // One retry covers transient 5xx / timeouts; the SDK stays as a last resort.
  let audioBuffer: Buffer;
  try {
    audioBuffer = await generateViaRest({ script, style, voice, apiKey });
  } catch (firstErr) {
    console.warn("[gemini-tts] REST attempt 1 failed, retrying:", firstErr instanceof Error ? firstErr.message : firstErr);
    try {
      audioBuffer = await generateViaRest({ script, style, voice, apiKey });
    } catch (restErr) {
      console.warn("[gemini-tts] REST attempt 2 failed, trying SDK:", restErr instanceof Error ? restErr.message : restErr);
      try {
        audioBuffer = await generateViaSdk({ script, style, voice, apiKey });
      } catch {
        throw restErr;
      }
    }
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
