/**
 * Spoken-language style layer for Gemini TTS voiceover scripts.
 *
 * Separates *how* a language should sound (spoken register / code-switching)
 * from *which* language is selected and from TTS delivery style.
 *
 * Defaults:
 * - Tamil → natural_spoken (contemporary spoken Tamil + natural English mix)
 * - Hindi / Malayalam / Kannada → pure_native (preserve prior formal-native behavior)
 *
 * Future styles (formal, pure_native for Tamil, etc.) can plug in here
 * without rewriting the script-generation prompt architecture.
 */

import {
  normalizeVoiceoverLanguage,
  type VoiceoverLanguage,
} from "./voiceover-languages";

export const SPOKEN_LANGUAGE_STYLES = [
  "natural_spoken",
  "formal",
  "pure_native",
] as const;

export type SpokenLanguageStyle = (typeof SPOKEN_LANGUAGE_STYLES)[number];

export function isSpokenLanguageStyle(
  value: unknown
): value is SpokenLanguageStyle {
  return (
    typeof value === "string" &&
    (SPOKEN_LANGUAGE_STYLES as readonly string[]).includes(value)
  );
}

export function normalizeSpokenLanguageStyle(
  value: unknown,
  fallback: SpokenLanguageStyle
): SpokenLanguageStyle {
  if (isSpokenLanguageStyle(value)) return value;
  return fallback;
}

/** Default spoken style per voiceover language. No UI control yet. */
export function defaultSpokenLanguageStyle(
  language: VoiceoverLanguage | string | undefined
): SpokenLanguageStyle {
  const normalized = normalizeVoiceoverLanguage(language);
  switch (normalized) {
    case "tamil":
      return "natural_spoken";
    case "hindi":
    case "malayalam":
    case "kannada":
      return "pure_native";
    default:
      return "pure_native";
  }
}

export function resolveSpokenLanguageStyle(input: {
  language: VoiceoverLanguage | string | undefined;
  spokenLanguageStyle?: SpokenLanguageStyle | string | null;
}): SpokenLanguageStyle {
  const language = normalizeVoiceoverLanguage(input.language);
  const fallback = defaultSpokenLanguageStyle(language);
  return normalizeSpokenLanguageStyle(input.spokenLanguageStyle, fallback);
}

/**
 * Prompt block injected into voiceover script generation.
 * Returns empty string for English (Seedance path — not used here).
 */
export function buildSpokenLanguageStyleInstructions(input: {
  language: VoiceoverLanguage | string | undefined;
  style: SpokenLanguageStyle;
  langDisplayName: string;
}): string {
  const language = normalizeVoiceoverLanguage(input.language);
  if (language === "english") return "";

  const { style, langDisplayName } = input;

  if (style === "natural_spoken") {
    if (language === "tamil") {
      return `Spoken-language style: natural_spoken (contemporary Tamil advertising)

Generate natural contemporary spoken Tamil for a modern advertisement.

Tamil must remain the dominant language.

Use English words or short English phrases naturally when a modern
Tamil speaker would realistically use them in everyday conversation.

Do not force English into every sentence.

Do not translate common English product, technology, lifestyle,
marketing or commerce vocabulary into awkward formal Tamil when
Tamil speakers commonly use the English term.

Avoid literary Tamil.
Avoid textbook Tamil.
Avoid newsreader Tamil.
Avoid overly formal Tamil.
Avoid unnatural word-for-word translations.

Use conversational Tamil grammar and phrasing.

The script should sound like something a real Tamil person would
say aloud to another person, not something written for an essay.

English code-switching should feel intentional and natural,
not decorative.

Script orthography:
- Write Tamil words in Tamil Unicode script.
- Write English words in English (Latin) letters.
- Do NOT transliterate the whole script into Tanglish / Latin-only Tamil
  (bad: "Indha product unga everyday life ah romba easy ah maathum").
- Good mixed-script example shape:
  "இந்த product உங்க everyday life-ஐ ரொம்ப easy-ஆ மாற்றும்."

Code-switching intensity must follow audience and brand context:
- Young / urban / D2C / e-commerce → light natural English mix is fine.
- Traditional / family / older audience → more Tamil, less English.
- Never maximize English for its own sake.

Natural English vocabulary may appear when appropriate (examples only —
not a whitelist): product, brand, offer, order, delivery, online, app,
website, quality, premium, fresh, easy, simple, smart, experience,
design, style, deal, price, today, now, try, shop, check, available.

CTAs may be mixed-language when natural for the brand, e.g.:
"இப்பவே order பண்ணுங்க." / "Shop now." / "இன்னைக்கே try பண்ணிப் பாருங்க."
Do not automatically translate every CTA into formal Tamil.

Preserve brand names, product names, model names, technical terms,
URLs, promo codes, and proper nouns exactly — do not translate them.

Keep pronunciation-friendly wording for TTS.
Maintain meaning, product claims, CTA, and campaign intent.
Do not invent claims.`;
    }

    // Extensible placeholder for future Hindi/Kannada/Malayalam natural_spoken.
    return `Spoken-language style: natural_spoken

Generate natural contemporary spoken ${langDisplayName} for a modern advertisement.
${langDisplayName} must remain the dominant language.
Use English words or short phrases only where a modern ${langDisplayName}
speaker would realistically use them in everyday conversation.
Do not force English into every sentence.
Avoid literary, textbook, or newsreader register.
Write ${langDisplayName} in its native script; keep English words in Latin letters.
Do NOT Latin-transliterate the whole script.
Preserve brand/product names and proper nouns exactly.
Keep TTS-friendly wording. Maintain factual claims and CTA intent.`;
  }

  if (style === "formal") {
    return `Spoken-language style: formal

Write polished formal ${langDisplayName} suitable for a premium / institutional advertisement.
Prefer ${langDisplayName}-native vocabulary. Minimize casual English slang.
Keep brand/product names in their original form.
Write in ${langDisplayName} script only for ${langDisplayName} words.
No stage directions. TTS-friendly complete sentences.`;
  }

  // pure_native — preserves prior Gemini-TTS script behavior for non-Tamil languages
  return `Spoken-language style: pure_native

Write the spoken lines in ${langDisplayName} ONLY using ${langDisplayName} script.
Do not insert English words except unavoidable brand/product names, model names,
URLs, promo codes, and proper nouns (keep those exact).
Avoid English code-switching for common vocabulary.
No stage directions. No quotes around the whole script.`;
}
