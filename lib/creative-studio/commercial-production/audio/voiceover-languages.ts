/**
 * Commercial voiceover language routing.
 *
 * English → Seedance native spoken audio
 * Tamil / Hindi / Malayalam / Kannada → silent Seedance + Gemini 3.8 Flash TTS
 */

export const VOICEOVER_LANGUAGES = [
  "english",
  "tamil",
  "hindi",
  "malayalam",
  "kannada",
] as const;

export type VoiceoverLanguage = (typeof VOICEOVER_LANGUAGES)[number];

/** Languages that use Gemini TTS instead of Seedance spoken audio. */
export const GEMINI_TTS_LANGUAGES = [
  "tamil",
  "hindi",
  "malayalam",
  "kannada",
] as const;

export type GeminiTtsLanguage = (typeof GEMINI_TTS_LANGUAGES)[number];

export const VOICEOVER_LANGUAGE_LABELS: Record<VoiceoverLanguage, string> = {
  english: "English",
  tamil: "Tamil",
  hindi: "Hindi",
  malayalam: "Malayalam",
  kannada: "Kannada",
};

/** Common CTA chips shown under the language selector. */
export const VOICEOVER_CTA_OPTIONS = [
  "Shop Now",
  "Learn More",
  "Try Now",
  "Order Now",
  "Get Started",
  "Buy Now",
] as const;

export function isVoiceoverLanguage(value: unknown): value is VoiceoverLanguage {
  return (
    typeof value === "string" &&
    (VOICEOVER_LANGUAGES as readonly string[]).includes(value)
  );
}

export function normalizeVoiceoverLanguage(
  value: unknown,
  fallback: VoiceoverLanguage = "english"
): VoiceoverLanguage {
  if (isVoiceoverLanguage(value)) return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (isVoiceoverLanguage(lower)) return lower;
  }
  return fallback;
}

export function usesGeminiTts(language: VoiceoverLanguage | string | undefined): boolean {
  const normalized = normalizeVoiceoverLanguage(language);
  return (GEMINI_TTS_LANGUAGES as readonly string[]).includes(normalized);
}

export function usesSeedanceNativeVoiceover(
  language: VoiceoverLanguage | string | undefined
): boolean {
  return !usesGeminiTts(language);
}

/** Display / prompt name for script generation. */
export function voiceoverLanguageDisplayName(
  language: VoiceoverLanguage | string | undefined
): string {
  const normalized = normalizeVoiceoverLanguage(language);
  return VOICEOVER_LANGUAGE_LABELS[normalized];
}

/** Prefer voices that read well for Indian-language commercials. */
export function defaultTtsVoiceForLanguage(
  language: VoiceoverLanguage | string | undefined
): string {
  const normalized = normalizeVoiceoverLanguage(language);
  switch (normalized) {
    case "tamil":
    case "malayalam":
    case "kannada":
      return "Kore";
    case "hindi":
      return "Aoede";
    default:
      return "Kore";
  }
}
