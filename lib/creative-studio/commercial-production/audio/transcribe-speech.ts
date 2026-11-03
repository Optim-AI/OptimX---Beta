/**
 * Speech → text for "Speak instead" in the studio.
 *
 * Browser speech recognition only works in desktop Chrome (Safari, Brave,
 * Firefox and in-app browsers fail silently), so the studio records audio and
 * Gemini transcribes it here. Text stays in the language and script spoken.
 */

import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { VOICEOVER_LANGUAGE_LABELS, normalizeVoiceoverLanguage } from "./voiceover-languages";

const MODEL = "gemini-3.8-flash";
/** ~2 minutes of compressed speech. */
export const MAX_SPEECH_BYTES = 6 * 1024 * 1024;

export class SpeechTranscriptionError extends Error {}

export async function transcribeSpeech(input: {
  audioBase64: string;
  mimeType: string;
  /** Voiceover language picked in the studio — a hint, not a constraint. */
  language?: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new SpeechTranscriptionError("Speech service is not configured");
  const mimeType = input.mimeType.split(";")[0].trim() || "audio/webm";
  const hint = VOICEOVER_LANGUAGE_LABELS[normalizeVoiceoverLanguage(input.language)];

  const response = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: input.audioBase64 } },
              {
                text:
                  `Transcribe what the speaker says. They are a small-business owner describing the ad they want. ` +
                  `They probably speak ${hint}, possibly mixed with English. Write each word in the script it was spoken in ` +
                  `(Tamil in Tamil script, English words in English). Fix obvious filler ("umm", repeats) but do not add, ` +
                  `translate or summarise. Return only the transcript text. If there is no speech, return nothing.`,
              },
            ],
          },
        ],
        generation_config: { temperature: 0, max_output_tokens: 2048, thinking_config: { thinking_budget: 0 } },
      }),
    },
    { operationLabel: "studio:transcribe-speech", maxRetries: 2 }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SpeechTranscriptionError(`Transcription failed (${response.status}) ${detail.slice(0, 200)}`);
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  };
  return (json.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
}
