/**
 * Generate a spoken commercial voiceover script in the target language
 * for Gemini TTS (when Seedance native VO is disabled).
 *
 * Uses GEMINI_API_KEY + gemini-3.8-flash for text.
 * Never uses GEMINI_TTS_API_KEY (that key is only for speech audio).
 */

import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import {
  computeVoiceoverBudget,
  VOICEOVER_WORDS_PER_SECOND,
} from "@/lib/creative-studio/video-prompt-utils";
import {
  normalizeVoiceoverLanguage,
  voiceoverLanguageDisplayName,
  type VoiceoverLanguage,
} from "./voiceover-languages";
import {
  buildSpokenLanguageStyleInstructions,
  resolveSpokenLanguageStyle,
  type SpokenLanguageStyle,
} from "./spoken-language-style";

/** Text model for writing the spoken script (NOT the TTS model). */
export const VOICEOVER_SCRIPT_MODEL = "gemini-3.8-flash";

export interface GenerateVoiceoverScriptInput {
  language: VoiceoverLanguage | string;
  durationSeconds: number;
  brandName: string;
  productName: string;
  keyMessage?: string;
  cta?: string;
  ctaEnabled?: boolean;
  tone?: string;
  campaignMessage?: string;
  userConcept?: string;
  targetAudience?: string;
  /** Prefer this script if already in the target language. */
  existingScript?: string;
  /**
   * Spoken register (natural_spoken / formal / pure_native).
   * Tamil defaults to natural_spoken when omitted.
   */
  spokenLanguageStyle?: SpokenLanguageStyle | string;
}

function looksLikeTargetScript(script: string, language: VoiceoverLanguage): boolean {
  const trimmed = script.trim();
  if (trimmed.length < 12) return false;
  if (language === "english") return /[A-Za-z]/.test(trimmed);

  // Tamil / Malayalam / Kannada / Hindi typically use Indic scripts.
  // Mixed-script natural_spoken (Tamil + Latin English) still matches via Indic chars.
  if (language === "tamil") return /[\u0B80-\u0BFF]/.test(trimmed);
  if (language === "malayalam") return /[\u0D00-\u0D7F]/.test(trimmed);
  if (language === "kannada") return /[\u0C80-\u0CFF]/.test(trimmed);
  if (language === "hindi") return /[\u0900-\u097F]/.test(trimmed);
  return false;
}

/**
 * Returns a TTS-ready voiceover script in the requested language.
 * Uses GEMINI_API_KEY + gemini-3.8-flash — never GEMINI_TTS_API_KEY.
 */
export async function resolveVoiceoverScriptForTts(
  input: GenerateVoiceoverScriptInput
): Promise<string> {
  const language = normalizeVoiceoverLanguage(input.language);
  const spokenStyle = resolveSpokenLanguageStyle({
    language,
    spokenLanguageStyle: input.spokenLanguageStyle,
  });
  const existing = input.existingScript?.trim();
  if (existing && looksLikeTargetScript(existing, language)) {
    return existing;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required to write the voiceover script (text model). GEMINI_TTS_API_KEY is only for speech audio."
    );
  }

  const budget = computeVoiceoverBudget(input.durationSeconds);
  const langName = voiceoverLanguageDisplayName(language);
  const includeCta = input.ctaEnabled !== false;
  const ctaLine = includeCta
    ? input.cta?.trim() || "Shop now"
    : null;
  const styleBlock = buildSpokenLanguageStyleInstructions({
    language,
    style: spokenStyle,
    langDisplayName: langName,
  });

  const allowsNaturalEnglish = spokenStyle === "natural_spoken";

  const prompt = `Write a complete ${input.durationSeconds}-second commercial voiceover script primarily in ${langName}.

Brand: ${input.brandName}
Product: ${input.productName}
Tone: ${input.tone || "Energetic"}
Target audience: ${input.targetAudience?.trim() || "not provided"}
Key message: ${input.keyMessage || input.campaignMessage || "not provided"}
Creative concept: ${input.userConcept || "not provided"}
${ctaLine ? `End with this CTA intent (adapt phrasing to the spoken style; do not invent a different offer): "${ctaLine}"` : "Do NOT include a hard CTA."}

${styleBlock}

Rules:
- Output ONLY the spoken transcript — what the voice actor should say aloud.
- No stage directions, no tone notes, no speaker labels, no quotes wrapping the whole script.
- Structure: hook → brand+product → one specific benefit → ${ctaLine ? "CTA" : "soft close"}.
- Target about ${budget.targetWords} words (min ${budget.minWords}, max ${budget.maxWords}).
- Speaking must finish by ~${budget.finishBySecond}s at ~${VOICEOVER_WORDS_PER_SECOND} words/sec.
- Complete commercial sentences — never stop after the hook.
- Preserve brand name "${input.brandName}" and product name "${input.productName}" exactly.
- Do not invent prices, discounts, or claims not implied by the inputs.
${
  allowsNaturalEnglish
    ? `- ${langName} remains dominant; English appears only where natural for this audience.`
    : `- Write spoken lines in ${langName} script. No decorative English (brand/product names excepted).`
}

Return JSON only: { "voiceover_script": "..." }`;

  const res = await fetch(
    `${GEMINI_REST_BASE}/models/${VOICEOVER_SCRIPT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ||
        `Gemini voiceover script generation failed (HTTP ${res.status})`
    );
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let script = "";
  try {
    const parsed = JSON.parse(text) as { voiceover_script?: string };
    script = String(parsed.voiceover_script || "").trim();
  } catch {
    script = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  if (!script) {
    throw new Error(`Failed to generate ${langName} voiceover script for Gemini TTS.`);
  }

  return script;
}
