/**
 * Fit a TTS voiceover inside the commercial's length.
 *
 * The voiceover must finish before the video ends (with a short tail of
 * music / silence) — it is never truncated mid-word.
 */

import type { VoiceoverLanguage } from "./voiceover-languages";

/** Silence left after the last spoken word before the video ends. */
export const VOICEOVER_TAIL_SECONDS = 1.2;
/** Speed-ups up to this stay natural; beyond it the script is rewritten shorter. */
export const MAX_NATURAL_TEMPO = 1.12;
/** Hard ceiling used only when rewrites still overrun. */
export const MAX_FORCED_TEMPO = 1.35;

/**
 * Rough share of the English word budget per language. Indic words are longer
 * (agglutinative), so the same word count takes longer to speak. Tamil was
 * measured on Gemini TTS (natural spoken style: ~2.2 words/s); the others are
 * estimates. Measured TTS duration corrects whatever this misses.
 */
const WORD_BUDGET_FACTOR: Record<VoiceoverLanguage, number> = {
  english: 1,
  hindi: 0.9,
  tamil: 0.85,
  kannada: 0.8,
  telugu: 0.8,
  malayalam: 0.75,
};

export function voiceoverWordBudgetFactor(language: VoiceoverLanguage): number {
  return WORD_BUDGET_FACTOR[language] ?? 0.7;
}

export function voiceoverSpeechWindowSeconds(videoSeconds: number): number {
  return Math.max(1, videoSeconds - VOICEOVER_TAIL_SECONDS);
}

export type VoiceoverFitPlan =
  | { action: "fits"; tempo: 1; windowSeconds: number }
  | { action: "speed_up"; tempo: number; windowSeconds: number }
  | {
      action: "rewrite";
      /** Fraction of the current script length to aim for. */
      lengthRatio: number;
      windowSeconds: number;
    };

export function planVoiceoverFit(input: {
  speechSeconds: number;
  videoSeconds: number;
  /** When false, never ask for a rewrite — speed up as far as needed. */
  allowRewrite?: boolean;
}): VoiceoverFitPlan {
  const windowSeconds = voiceoverSpeechWindowSeconds(input.videoSeconds);
  if (input.speechSeconds <= windowSeconds) {
    return { action: "fits", tempo: 1, windowSeconds };
  }
  const tempo = input.speechSeconds / windowSeconds;
  if (tempo <= MAX_NATURAL_TEMPO || input.allowRewrite === false) {
    return { action: "speed_up", tempo: roundTempo(tempo), windowSeconds };
  }
  return {
    action: "rewrite",
    // Aim slightly under the window so the rewrite usually fits without a speed-up.
    lengthRatio: Math.max(0.3, (windowSeconds / input.speechSeconds) * 0.92),
    windowSeconds,
  };
}

/** Round up so the sped-up audio never lands a hair over the window. */
function roundTempo(tempo: number): number {
  return Math.ceil(tempo * 1000) / 1000;
}
