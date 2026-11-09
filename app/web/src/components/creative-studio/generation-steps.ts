/**
 * Progress steps shown while a commercial is produced. They mirror the real
 * server pipeline (product read → plan → film → voice → end card → check).
 * The API answers once at the end, so the active step is estimated from
 * elapsed time using typical durations.
 */

import {
  VOICEOVER_LANGUAGE_LABELS,
  normalizeVoiceoverLanguage,
  usesGeminiTts,
} from '@/lib/creative-studio/commercial-production/audio/voiceover-languages';
import type { CommercialProductionStatus } from './types';

export type GenerationStep = {
  label: string;
  status: CommercialProductionStatus;
  /** Typical seconds this step takes. */
  seconds: number;
};

export function buildGenerationSteps(input: {
  durationSeconds: number;
  voiceoverLanguage?: string;
  voiceoverEnabled?: boolean;
  endCardEnabled?: boolean;
  /** UGC Studio: the voice is added after filming unless the creator speaks English on camera. */
  ugcSpeech?: 'native' | 'presenter' | 'voiceover';
}): GenerationStep[] {
  const steps: GenerationStep[] = [
    { label: 'Reading your product photo', status: 'planning', seconds: 15 },
    { label: 'Planning the scenes', status: 'preparing', seconds: 45 },
    {
      label: `Filming your ${input.durationSeconds}-second video`,
      status: 'generating',
      seconds: input.durationSeconds >= 30 ? 420 : 240,
    },
  ];
  const voiceAddedLater = input.ugcSpeech
    ? input.ugcSpeech !== 'native'
    : usesGeminiTts(input.voiceoverLanguage);
  if (input.voiceoverEnabled !== false && voiceAddedLater) {
    const language = VOICEOVER_LANGUAGE_LABELS[normalizeVoiceoverLanguage(input.voiceoverLanguage)];
    steps.push({ label: `Adding your ${language} voice`, status: 'generating', seconds: 40 });
  }
  if (input.endCardEnabled !== false) {
    steps.push({ label: 'Adding your end card', status: 'evaluating', seconds: 25 });
  }
  steps.push({ label: 'Final check', status: 'evaluating', seconds: 10 });
  return steps;
}

/** Index of the step running after `elapsedSeconds`, and rough minutes left. */
export function generationProgress(
  steps: GenerationStep[],
  elapsedSeconds: number
): { index: number; minutesLeft: number } {
  let start = 0;
  let index = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (elapsedSeconds < start + steps[i].seconds) {
      index = i;
      break;
    }
    start += steps[i].seconds;
  }
  const total = steps.reduce((sum, s) => sum + s.seconds, 0);
  return { index, minutesLeft: Math.max(0, Math.ceil((total - elapsedSeconds) / 60)) };
}
