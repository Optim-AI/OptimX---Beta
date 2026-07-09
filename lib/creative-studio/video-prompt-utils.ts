/** Shared helpers for Veo video generation prompts and voiceover pacing. */

import type { BrandPromptContext } from "./brand-context";
import { buildBrandContextBlock } from "./brand-context";
import {
  applicationSiteDirective,
  resolveApplicationSite,
} from "./film-engine/application-site";
import { anatomyLockDirective } from "./film-engine/prompt-compressor";
import type { ReferenceImageSlots } from "./reference-labels";
import { buildLabeledReferenceBlock } from "./reference-labels";
import {
  buildSpokenBrandedProductPhrase,
  VEO_STRICT_NO_TEXT_BLOCK,
} from "./veo-output-rules";
import {
  buildBeatBasedStoryboardSection,
  buildCompactPipelineDigest,
  buildCompactStoryboardLines,
  buildDirectorLayerBlock,
  buildDirectorLayerCompact,
  buildPostDirectorPipelineLayers,
  buildScriptGenerationPipelineInstructions,
  FILM_GRAMMAR_BLOCK,
  type ExtendedStoryboardScene,
} from "./director-pipeline";

export {
  buildScriptGenerationPipelineInstructions,
  buildDirectorLayerBlock,
  buildDirectorLayerCompact,
  AD_BEAT_SEQUENCE,
  FILM_GRAMMAR_BLOCK,
} from "./director-pipeline";

export { buildSpokenBrandedProductPhrase, VEO_STRICT_NO_TEXT_BLOCK } from "./veo-output-rules";

export const VEO_SEGMENT_SECONDS = 8;
export const SEGMENT_SECONDS = VEO_SEGMENT_SECONDS;
export const VEO_ALLOWED_DURATIONS = [4, 6, 8] as const;
/** Gemini Veo 3.1 text input limit (tokens). */
export const VEO_PROMPT_MAX_TOKENS = 1024;
export type VeoDuration = (typeof VEO_ALLOWED_DURATIONS)[number];

/** Conservative token estimate for Veo prompt budgeting (~1.35 tokens/word). */
export function estimateVeoPromptTokens(text: string): number {
  if (!text?.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (estimateVeoPromptTokens(trimmed) <= maxTokens) return trimmed;
  const maxWords = Math.max(1, Math.floor(maxTokens / 1.35));
  return `${trimmed.split(/\s+/).slice(0, maxWords).join(" ")}…`;
}

export function stripEmbeddedDialogueDirections(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  return trimmed
    .replace(
      /(?:^|\n)(?:SPOKEN_DIALOGUE|VOICEOVER(?:\s+SCRIPT)?|DIALOGUE)(?:\s*:|\s*\n)([\s\S]*?)(?=\n[A-Z][A-Z _-]{2,}(?:\s*:|\n)|$)/gi,
      "\n"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip treatment blocks that cause Veo to render typography (headlines, end cards, overlays). */
export function sanitizeVisualTreatmentForVeo(text: string): string {
  let out = stripEmbeddedDialogueDirections(text);
  out = out
    .replace(
      /(?:^|\n)(?:HEADLINE|SUBTEXT|TITLE\s*CARD|LOWER\s*THIRD|END\s*CARD|ON[-\s]?SCREEN\s*TEXT|TEXT\s*OVERLAY|CAPTIONS?|TYPOGRAPHY|SUPER(?:TITLE)?|CHYRON|TICKER|WATERMARK|CTA\s*CARD|KINETIC\s*TEXT)(?:\s*:|\s*\n)([\s\S]*?)(?=\n[A-Z][A-Z0-9 _-]{2,}(?:\s*:|\n)|$)/gi,
      "\n"
    )
    .replace(
      /\b(?:show|display|overlay|superimpose|render|add|animate|float|super)\s+(?:the\s+)?(?:brand|product|flavor|headline|caption|title|slogan|CTA|logo|tagline|price|offer|text\s+card)\s+(?:as\s+)?(?:on[-\s]?screen\s+)?(?:text|typography|words?|letters?|graphics?|overlay)\b/gi,
      ""
    )
    .replace(
      /\b(?:on[-\s]?screen|floating|animated|kinetic|bold|large)\s+(?:text|typography|headline|caption|title|CTA|logo\s+text|brand\s+name)\b/gi,
      "visual-only (no on-screen text)"
    )
    .replace(/\b(?:end\s+card|title\s+card|lower\s+third|text\s+slate)\s+(?:with|showing|reading|saying)\b[^.\n]*/gi, "")
    .replace(/\btext\s+(?:that\s+)?(?:reads?|says?)\s*["'][^"']+["']/gi, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Strip dialogue and copy fields from storyboard before Veo — prevents on-screen text / VO leaks. */
export function stripStoryboardDialogue<T extends StoryboardScene>(scenes?: T[]): T[] | undefined {
  if (!Array.isArray(scenes)) return undefined;
  return scenes.map((scene) => ({
    ...scene,
    voiceover_line: "",
    voiceover_script: "",
    dialogue_direction: "",
    on_screen_text: "",
    marketing_message: "",
    proof_element: "",
  }));
}

/** Join prompt sections, dropping or truncating lowest-priority tail to stay under Veo limit. */
function joinWithinVeoTokenBudget(parts: string[], maxTokens = VEO_PROMPT_MAX_TOKENS): string {
  const sections = parts.map((p) => p.trim()).filter(Boolean);
  let result = "";
  let used = 0;

  for (const part of sections) {
    const partTokens = estimateVeoPromptTokens(part);
    if (used + partTokens <= maxTokens) {
      result = result ? `${result}\n\n${part}` : part;
      used += partTokens;
      continue;
    }
    const remaining = maxTokens - used;
    if (remaining < 20) break;
    const truncated = truncateToTokenBudget(part, remaining);
    if (truncated) result = result ? `${result}\n\n${truncated}` : truncated;
    break;
  }

  return result;
}

/** Clamp any prompt to Veo's token limit (section-aware when double-newline blocks exist). */
export function enforceVeoPromptBudget(
  prompt: string,
  maxTokens = VEO_PROMPT_MAX_TOKENS
): string {
  const trimmed = prompt.trim();
  if (!trimmed || estimateVeoPromptTokens(trimmed) <= maxTokens) return trimmed;
  const sections = trimmed.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (sections.length > 1) {
    return joinWithinVeoTokenBudget(sections, maxTokens);
  }
  return truncateToTokenBudget(trimmed, maxTokens);
}

export type StoryboardScene = {
  scene?: number;
  time_range?: string;
  duration?: string | number;
  visual_description?: string;
  description?: string;
  emotion?: string;
  mood?: string;
  motion_style?: string;
  camera?: string;
  voiceover_line?: string;
  voiceover_script?: string;
  on_screen_text?: string;
  /** Performance ad beat: Hook, Problem, Discovery, Product, Transformation, Payoff */
  beat?: string;
  marketing_message?: string;
  proof_element?: string;
  shot_purpose?: string;
  transition_to_next?: string;
  emotional_zone?: string;
  dialogue_direction?: string;
  product_state?: string;
  container_state?: string;
};

export type StyleDirectorSpec = {
  role: string;
  aesthetic: string;
  cinematography: string;
  lighting: string;
  pacing: string;
  lensFeel: string;
  references: string;
};

export type VeoPromptInput = {
  brandName?: string;
  productName?: string;
  category?: string;
  userDescription?: string;
  style?: string;
  creativeFormat?: string;
  hookType?: string;
  campaignGoal?: string;
  creativeStrategy?: {
    targetAudience?: string;
    corePainPoint?: string;
    coreDesire?: string;
    biggestObjection?: string;
    campaignGoal?: string;
    hookType?: string;
    creativeAngle?: string;
    cta?: string;
    conversionObjective?: string;
  };
  clipDurationSeconds: number;
  totalDurationSeconds?: number;
  aspectRatio: string;
  segmentIndex?: number;
  segmentCount?: number;
  finalVideoPrompt?: string;
  fallbackPrompt?: string;
  voiceoverScript?: string;
  storyboard?: StoryboardScene[];
  hasReferenceImages: boolean;
  headline?: string;
  subtext?: string;
  keyMessage?: string;
  cta?: string;
  brandContext?: BrandPromptContext;
  referenceSlots?: ReferenceImageSlots;
  filmStyleId?: string;
  /** Voiceover / ad tone (Energetic, Calm, Premium, Fun) — Envato formula. */
  adTone?: string;
};

/** Alias for cinematic prompt builder options */
export type BuildVeoVideoPromptOptions = VeoPromptInput;

/** Map requested duration to a Veo-supported clip length (4, 6, or 8). Reference-image mode requires 8s. */
export function normalizeVeoDuration(
  requestedSeconds: number,
  hasReferenceImages = false
): VeoDuration {
  if (hasReferenceImages) return 8;
  const clamped = Math.max(4, Math.min(8, Math.round(requestedSeconds)));
  if (clamped <= 5) return 4;
  if (clamped <= 7) return 6;
  return 8;
}

/** Mandatory completion rule — every VO must read as a finished commercial. */
export const VOICEOVER_COMPLETION_RULES = `
VOICEOVER COMPLETION RULE (MANDATORY):
The voiceover must always sound like a complete commercial — never an incomplete sentence or problem-only setup.

Every voiceover MUST contain, in order:
1. A compelling hook (scroll-stopping pain, curiosity, or bold claim)
2. The brand name (spoken clearly)
3. The product name (spoken clearly — brand + product as one natural phrase is ideal)
4. One specific benefit or proof (ingredient, stat, result, transformation)
5. A natural closing or CTA (complete thought — never trail off)

The narration must end on a closed sentence. NEVER stop after introducing the problem or halfway through a thought.
Generate a natural commercial script that comfortably fits the speaking window — do NOT minimize word count.
The audience must never feel the narration was cut off or left unfinished.
`.trim();


/** Natural commercial speaking rate (~2.2 words/sec) for timing guidance. */
export const VOICEOVER_WORDS_PER_SECOND = 2.2;

export type VoiceoverBrief = {
  brandName?: string;
  productName?: string;
  keyMessage?: string;
  cta?: string;
  creativeStrategy?: VeoPromptInput["creativeStrategy"];
  userDescription?: string;
};

export type VoiceoverStructureKey =
  | "hook"
  | "brand"
  | "product"
  | "benefit"
  | "cta"
  | "complete_ending";

export type VoiceoverValidationResult = {
  valid: boolean;
  wordCount: number;
  estimatedSpeakingSeconds: number;
  missing: VoiceoverStructureKey[];
  issues: string[];
};

/** Estimate how long the script takes to speak at natural commercial pace. */
export function estimateVoiceoverSpeakingSeconds(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return wordCount / VOICEOVER_WORDS_PER_SECOND;
}

function shortenPhrase(text: string, maxWords: number): string {
  return text
    .replace(/\.$/, "")
    .split(/[.!,—–-]/)
    .map((s) => s.trim())
    .filter(Boolean)[0]
    ?.split(/\s+/)
    .slice(0, maxWords)
    .join(" ") || text;
}

function hasVoiceoverCta(script: string, cta?: string): boolean {
  const haystack = script.toLowerCase();
  const explicit = cta?.trim().toLowerCase().replace(/\.$/, "");
  if (explicit && haystack.includes(explicit)) return true;
  return /\b(shop now|try it today|try it|buy now|order now|get yours|grab yours|start today|learn more|sign up|download now|discover)\b/i.test(
    script
  );
}

function hasVoiceoverBenefit(script: string, benefitHint?: string): boolean {
  const haystack = script.toLowerCase();
  const hint = benefitHint?.trim().toLowerCase().replace(/\.$/, "");
  if (hint && hint.length > 8 && haystack.includes(hint.slice(0, Math.min(24, hint.length)))) {
    return true;
  }
  return /\b(protein|results?|sugar|fuel|morning|workout|transform|proof|real|better|faster|easier|\d+%|\d+g)\b/i.test(
    script
  );
}

function hasScrollStoppingHook(script: string): boolean {
  const first = script.split(/(?<=[.!?।])\s+/)[0]?.trim() || script;
  if (first.length < 8) return false;
  return (
    /[?]/.test(first) ||
    /\b(still|tired|craving|waiting|struggling|skipping|every|never|stop|imagine|what if)\b/i.test(
      first
    )
  );
}

/** Validate that VO reads as a complete commercial, not a fragment or problem-only setup. */
export function validateVoiceoverCommercial(
  script: string,
  input: VoiceoverBrief & {
    minWords?: number;
    maxWords?: number;
    maxSpokenSeconds?: number;
  } = {}
): VoiceoverValidationResult {
  const trimmed = script.trim();
  const wordCount = countWords(trimmed);
  const estimatedSpeakingSeconds = estimateVoiceoverSpeakingSeconds(wordCount);
  const missing: VoiceoverStructureKey[] = [];
  const issues: string[] = [];

  if (!trimmed) {
    return {
      valid: false,
      wordCount: 0,
      estimatedSpeakingSeconds: 0,
      missing: ["hook", "brand", "product", "benefit", "cta", "complete_ending"],
      issues: ["Voiceover is empty."],
    };
  }

  const brand = input.brandName?.trim() || "";
  const product = input.productName?.trim() || "";
  const haystack = trimmed.toLowerCase();
  const normalizedHaystack = haystack.replace(/[^\w\s]/g, " ");
  const brandedPhrase = buildSpokenBrandedProductPhrase(input.brandName, input.productName)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ");

  if (!hasScrollStoppingHook(trimmed)) missing.push("hook");
  if (brand && !normalizedHaystack.includes(brand.toLowerCase().replace(/[^\w\s]/g, " "))) {
    missing.push("brand");
  }
  if (product) {
    const productTokens = product
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hasProduct =
      normalizedHaystack.includes(brandedPhrase) ||
      productTokens.every((w) => normalizedHaystack.includes(w));
    if (!hasProduct) missing.push("product");
  }
  if (!hasVoiceoverBenefit(trimmed, input.keyMessage || input.creativeStrategy?.coreDesire)) {
    missing.push("benefit");
  }
  if (!hasVoiceoverCta(trimmed, input.cta || input.creativeStrategy?.cta)) missing.push("cta");
  if (!/[.!?।]$/.test(trimmed)) missing.push("complete_ending");

  if (input.minWords != null && wordCount < input.minWords) {
    issues.push(`Too short (${wordCount} words; need at least ${input.minWords}).`);
  }
  if (input.maxWords != null && wordCount > input.maxWords) {
    issues.push(`Too long (${wordCount} words; max ${input.maxWords}).`);
  }
  if (
    input.maxSpokenSeconds != null &&
    estimatedSpeakingSeconds > input.maxSpokenSeconds + 0.35
  ) {
    issues.push(
      `Estimated ${estimatedSpeakingSeconds.toFixed(1)}s speech exceeds ${input.maxSpokenSeconds}s window.`
    );
  }

  const sentences = trimmed.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const endsOnQuestion = /[?]\s*$/.test(trimmed);
  const hasResolution = !missing.includes("benefit") && !missing.includes("cta") && !missing.includes("product");

  if (sentences.length === 1 && endsOnQuestion && !hasResolution) {
    issues.push(
      "Voiceover stops after the hook/problem — must continue with brand, product, benefit, and CTA."
    );
  }
  if (sentences.length === 1 && missing.includes("benefit") && missing.includes("cta")) {
    issues.push("Script stops after the hook/problem without resolving the sale.");
  }
  if (missing.includes("brand") && missing.includes("product")) {
    issues.push("Must name both the brand and the product — not a generic product reference.");
  }

  const valid = missing.length === 0 && issues.length === 0;
  return { valid, wordCount, estimatedSpeakingSeconds, missing, issues };
}

/** Voiceover budget from natural speaking windows — not arbitrary word minimization. */
export function computeVoiceoverBudget(durationSeconds: number): {
  minSpokenSeconds: number;
  maxSpokenSeconds: number;
  minWords: number;
  maxWords: number;
  targetWords: number;
  tailSilenceSeconds: number;
  finishBySecond: number;
} {
  const duration = Math.max(4, Math.min(120, durationSeconds));

  if (duration <= 8) {
    const minSpokenSeconds = 5.5;
    const maxSpokenSeconds = 6.5;
    const tailSilenceSeconds = 1.5;
    return {
      minSpokenSeconds,
      maxSpokenSeconds,
      minWords: 16,
      maxWords: 20,
      targetWords: 18,
      tailSilenceSeconds,
      finishBySecond: 6.5,
    };
  }
  if (duration <= 16) {
    const minSpokenSeconds = 13;
    const maxSpokenSeconds = 14;
    const tailSilenceSeconds = 2;
    return {
      minSpokenSeconds,
      maxSpokenSeconds,
      minWords: 32,
      maxWords: 40,
      targetWords: 36,
      tailSilenceSeconds,
      finishBySecond: 14,
    };
  }

  const tailSilenceSeconds = Math.min(2, Math.max(1, Math.round(duration * 0.08)));
  const finishBySecond = duration - tailSilenceSeconds;
  const minSpokenSeconds = Math.max(5.5, finishBySecond - 1);
  const maxSpokenSeconds = finishBySecond;
  const minWords = Math.max(16, Math.floor(minSpokenSeconds * 2.2));
  const maxWords = Math.max(minWords + 4, Math.floor(maxSpokenSeconds * 2.5));
  const targetWords = Math.round((minWords + maxWords) / 2);
  return {
    minSpokenSeconds,
    maxSpokenSeconds,
    minWords,
    maxWords,
    targetWords,
    tailSilenceSeconds,
    finishBySecond,
  };
}

/** Build a complete commercial script sized for the speaking window. */
export function buildStructuredCommercialVoiceover(
  input: VoiceoverBrief,
  budget: Pick<
    ReturnType<typeof computeVoiceoverBudget>,
    "minWords" | "maxWords" | "targetWords"
  >
): string {
  const brand = input.brandName?.trim() || "";
  const product = input.productName?.trim() || "this product";
  const brandedProduct = buildSpokenBrandedProductPhrase(brand, product);
  const pain =
    input.creativeStrategy?.corePainPoint?.replace(/\.$/, "") || "everyday struggles";
  const benefit = shortenPhrase(
    input.keyMessage ||
      input.creativeStrategy?.coreDesire?.replace(/\.$/, "") ||
      input.userDescription?.replace(/\.$/, "") ||
      `real results from ${product}`,
    10
  );
  const cta = (input.cta || input.creativeStrategy?.cta || "Try it today").replace(/\.$/, "");

  const hooks = [
    `Still dealing with ${pain.toLowerCase()} every day?`,
    `Craving something better every day?`,
    `Tired of settling for less?`,
  ];

  const variants = [
    `${hooks[0]} ${brandedProduct} — ${benefit}. ${cta}.`,
    `${hooks[0]} ${brandedProduct}, ${benefit}. ${cta}.`,
    `${hooks[1]} ${brandedProduct} — ${benefit}. ${cta}.`,
    `Meet ${brandedProduct} — ${benefit}. ${cta}.`,
    `${brandedProduct} — ${benefit}. ${cta}.`,
  ];

  let best = "";
  let bestScore = -Infinity;
  let fallback = "";
  let fallbackScore = -Infinity;
  for (const variant of variants) {
    const normalized = variant.replace(/\s+/g, " ").trim();
    const wc = countWords(normalized);
    if (wc > budget.maxWords) continue;
    const distance = Math.abs(wc - budget.targetWords);
    const meetsMin = wc >= budget.minWords;
    const score = meetsMin ? 2000 - distance : wc - distance - 500;
    if (meetsMin && score > bestScore) {
      best = normalized;
      bestScore = score;
    }
    if (score > fallbackScore) {
      fallback = normalized;
      fallbackScore = score;
    }
  }

  if (best) return best;
  if (fallback) return fallback;
  const fallbackVariant = variants[0].replace(/\s+/g, " ").trim();
  return fitVoiceoverToWordBudget(fallbackVariant, budget.maxWords);
}

/** Compress long scripts by rebuilding — never mid-sentence word chops that drop CTA. */
export function compressVoiceoverPreservingStructure(
  script: string,
  maxWords: number,
  input: VoiceoverBrief,
  minWords?: number
): string {
  const budget = {
    minWords: minWords ?? Math.max(12, Math.floor(maxWords * 0.75)),
    maxWords,
    targetWords: Math.min(maxWords, Math.max(minWords ?? 12, Math.floor(maxWords * 0.9))),
  };

  const fitted = fitVoiceoverToWordBudget(script, maxWords);
  if (fitted) {
    const validation = validateVoiceoverCommercial(fitted, {
      ...input,
      maxWords,
      minWords: budget.minWords,
    });
    if (validation.valid) return fitted;
  }

  const rebuilt = buildStructuredCommercialVoiceover(input, budget);
  const rebuiltFitted = fitVoiceoverToWordBudget(rebuilt, maxWords);

  const existingHook = script.split(/[.!?।]/)[0]?.trim() || "";
  if (existingHook.length > 8 && /[?]/.test(existingHook)) {
    const body =
      rebuiltFitted
        .split(/[.!?।]/)
        .slice(1)
        .join(".")
        .trim() || rebuiltFitted;
    const withHook = `${existingHook.replace(/[.!?।]$/, "")}. ${body}`
      .replace(/\s+/g, " ")
      .trim();
    if (countWords(withHook) <= maxWords) {
      const validation = validateVoiceoverCommercial(withHook, { ...input, maxWords });
      if (validation.valid || validation.missing.length <= 1) {
        return ensureCompleteSentence(withHook);
      }
    }
  }

  return rebuiltFitted || rebuilt;
}

/** Hard server-side cap — use at video API boundary so stale UI scripts cannot overrun. */
export function finalizeVoiceoverForClip(
  script: string,
  clipDurationSeconds: number,
  opts?: VoiceoverBrief & {
    totalDurationSeconds?: number;
    segmentIndex?: number;
    segmentCount?: number;
  }
): string {
  const trimmed = script.trim();
  if (!trimmed) return "";

  const total = opts?.totalDurationSeconds ?? clipDurationSeconds;
  const perClipBudget = computeVoiceoverBudget(clipDurationSeconds);
  const adInput: VoiceoverBrief = {
    brandName: opts?.brandName,
    productName: opts?.productName,
    keyMessage: opts?.keyMessage,
    cta: opts?.cta,
    creativeStrategy: opts?.creativeStrategy,
    userDescription: opts?.userDescription,
  };

  let working = trimmed;
  if (opts?.segmentCount && opts.segmentCount > 1 && opts.segmentIndex != null) {
    const perClipMax = perClipBudget.maxWords;
    if (countWords(working) > perClipMax) {
      const fullBudget = computeVoiceoverBudget(total);
      working = truncateVoiceover(working, fullBudget.maxWords, adInput);
      const split = splitVoiceoverForStitch(working, perClipMax, adInput);
      working = opts.segmentIndex === 0 ? split.part1 : split.part2;
    }
  } else if (total > clipDurationSeconds) {
    working = truncateVoiceover(working, computeVoiceoverBudget(total).maxWords, adInput);
  }

  return ensurePerformanceAdVoiceover(
    adInput,
    working,
    perClipBudget.maxWords,
    perClipBudget.minWords,
    perClipBudget
  );
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function ensureCompleteSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/[.!?।]$/.test(trimmed)) return trimmed;
  return `${trimmed.replace(/[,;—–-]\s*$/, "")}.`;
}

/** Sentence-safe word cap — never calls rebuild/compress (avoids recursion loops). */
function fitVoiceoverToWordBudget(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return "";
  if (countWords(trimmed) <= maxWords) return ensureCompleteSentence(trimmed);

  const sentences = trimmed
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let result = "";
  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (countWords(candidate) <= maxWords) {
      result = candidate;
    } else {
      break;
    }
  }
  if (result) return result;

  const words = trimmed.split(/\s+/).filter(Boolean);
  return ensureCompleteSentence(words.slice(0, maxWords).join(" "));
}

/** Trim voiceover to max words — preserve commercial structure; never chop into fragments. */
export function truncateVoiceover(
  text: string,
  maxWords: number,
  brief?: VoiceoverBrief
): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return "";
  if (countWords(trimmed) <= maxWords) {
    const completed = ensureCompleteSentence(trimmed);
    if (brief) {
      const validation = validateVoiceoverCommercial(completed, { ...brief, maxWords });
      if (!validation.valid) {
        return compressVoiceoverPreservingStructure(
          completed,
          maxWords,
          brief,
          Math.max(12, Math.floor(maxWords * 0.75))
        );
      }
    }
    return completed;
  }

  const sentences = trimmed
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    let result = "";
    for (const sentence of sentences) {
      const candidate = result ? `${result} ${sentence}` : sentence;
      if (countWords(candidate) <= maxWords) {
        result = candidate;
      } else {
        break;
      }
    }
    if (result) {
      const validation = brief
        ? validateVoiceoverCommercial(result, { ...brief, maxWords })
        : { valid: true, missing: [] as VoiceoverStructureKey[] };
      if (validation.valid) return result;
    }
    if (sentences[0] && countWords(sentences[0]) <= maxWords) {
      const firstOnly = sentences[0];
      if (!brief || validateVoiceoverCommercial(firstOnly, { ...brief, maxWords }).valid) {
        return firstOnly;
      }
    }
  }

  if (brief) {
    return compressVoiceoverPreservingStructure(
      trimmed,
      maxWords,
      brief,
      Math.max(12, Math.floor(maxWords * 0.75))
    );
  }

  if (sentences[0] && countWords(sentences[0]) <= maxWords) return sentences[0];
  return ensureCompleteSentence(sentences[0] || trimmed);
}

/** Timing rules for script generation and Veo prompts. */
export function buildVoiceoverTimingDirective(durationSeconds: number): string {
  const budget = computeVoiceoverBudget(durationSeconds);
  const spokenWindow =
    durationSeconds <= 8
      ? "5.5–6.5 seconds"
      : durationSeconds <= 16
        ? "13–14 seconds"
        : `${budget.minSpokenSeconds}–${budget.maxSpokenSeconds} seconds`;

  return [
    `VOICEOVER TIMING (mandatory — complete TV/social commercial, never fragments):`,
    `- Total video: ${durationSeconds}s. Speak naturally for ${spokenWindow}; finish by ${budget.finishBySecond}s latest.`,
    `- Target ${budget.minWords}–${budget.maxWords} words (~${budget.targetWords} at ~${VOICEOVER_WORDS_PER_SECOND} words/sec).`,
    `- REQUIRED ORDER: hook → brand name → product name → benefit/proof → natural CTA → complete ending.`,
    `- Last ${budget.tailSilenceSeconds}s (${budget.finishBySecond}–${durationSeconds}s): SILENT — hero product shot + music only.`,
    `- Never stop after the problem/hook. Never end mid-sentence. Never minimize word count.`,
    `- Every voiceover must include: hook, brand name, product name, benefit, CTA, and a complete ending.`,
  ].join("\n");
}

/** Instructions for LLM script generation — spoken ad, not silent montage. */
export const AD_VOICEOVER_COPY_RULES = `
${VOICEOVER_COMPLETION_RULES}

VOICEOVER AD COPY (MANDATORY when voiceover is enabled):
Write a professionally structured TV/social commercial — a person SELLING the product out loud.

REQUIRED ORDER in voiceover_script AND the combined narration:
1. HOOK (first ~2s): scroll-stopping pain, curiosity, or bold claim
2. BRAND NAME: say the full brand name clearly
3. PRODUCT NAME: say the full product name (with brand as one natural phrase)
4. BENEFIT / PROOF: one specific reason to buy — ingredient, result, stat, or transformation
5. CTA: clear action ("Shop now", "Try it today", etc.)
6. COMPLETE ENDING: finish on a closed sentence — never trail off

GOOD 8s (~18 words): "Craving something sweet? Yoga Bar protein mango shake — 26g protein, no added sugar. Try it today."
GOOD 16s (~36 words): "Still skipping breakfast? Yoga Bar protein mango shake fuels your morning — 26g protein, no added sugar, real results you can feel. Grab yours and try it today."

BAD (reject): problem-only hooks with no product resolution / "Yoga Bar. Try it." / flavor-only / three-word fragments / ending on a question with no CTA.

TIMING:
- 8s video: speak 5.5–6.5s (${16}–${20} words), last 1–2s silent.
- 16s video: speak 13–14s (${32}–${40} words), last 1–2s silent.
- Fill the speaking window with one complete message — not the fewest words.

Rules:
- Conversational but confident. Complete thoughts only.
- Name brand AND product. Say them together naturally (e.g. "Yoga Bar protein mango shake").
- Include concrete benefit — not vague fluff.
- voiceover_script = full narration; distribute voiceover_line across scenes without breaking sentences awkwardly.
`.trim();

function isWeakAdVoiceover(
  script: string,
  brandName?: string,
  productName?: string,
  brief?: VoiceoverBrief
): boolean {
  const validation = validateVoiceoverCommercial(script, {
    ...brief,
    brandName: brandName ?? brief?.brandName,
    productName: productName ?? brief?.productName,
    minWords: 10,
  });
  if (!validation.valid) return true;

  const trimmed = script.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 10) return true;

  const haystack = trimmed.toLowerCase();
  const generic =
    /^(discover|experience|transform|elevate|unlock|premium quality|sets us apart|the difference)/i.test(
      trimmed
    ) || /\b(premium quality|sets us apart|transform your)\b/i.test(haystack);
  if (generic) return true;

  const product = productName?.trim().toLowerCase() || "";
  const brand = brandName?.trim().toLowerCase() || "";
  const normalizedHaystack = haystack.replace(/[^\w\s]/g, " ");
  const normalizedProduct = product.replace(/[^\w\s]/g, " ");
  const normalizedBrand = brand.replace(/[^\w\s]/g, " ");
  const brandedPhrase = buildSpokenBrandedProductPhrase(brandName, productName)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ");
  const hasBrandedPhrase =
    !brand || !product || normalizedHaystack.includes(brandedPhrase);
  const hasExactProduct = !normalizedProduct || normalizedHaystack.includes(normalizedProduct);
  const hasExactBrand = !normalizedBrand || normalizedHaystack.includes(normalizedBrand);
  const hasProductWords =
    hasExactProduct ||
    normalizedProduct
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .every((w) => normalizedHaystack.includes(w));

  return !hasExactBrand || !hasProductWords || !hasBrandedPhrase;
}

/** Ensure VO includes hook, brand, product, benefit, CTA, and a complete close. */
export function ensurePerformanceAdVoiceover(
  input: VoiceoverBrief,
  script: string,
  maxWords: number,
  minWords?: number,
  budgetOverride?: Pick<
    ReturnType<typeof computeVoiceoverBudget>,
    "minWords" | "maxWords" | "targetWords"
  >
): string {
  const brand = input.brandName?.trim() || "";
  const product = input.productName?.trim() || "this product";
  const trimmed = script.trim();
  const floor = minWords ?? Math.max(12, Math.floor(maxWords * 0.75));
  const budget = budgetOverride ?? {
    minWords: floor,
    maxWords,
    targetWords: Math.round((floor + maxWords) / 2),
  };

  if (trimmed) {
    const wordCount = countWords(trimmed);
    if (wordCount > maxWords) {
      return compressVoiceoverPreservingStructure(trimmed, maxWords, input, floor);
    }
    const validation = validateVoiceoverCommercial(trimmed, {
      ...input,
      minWords: floor,
      maxWords,
    });
    if (
      wordCount >= floor &&
      validation.valid &&
      !isWeakAdVoiceover(trimmed, brand, product, input)
    ) {
      return ensureCompleteSentence(trimmed);
    }
  }

  const rebuilt = buildStructuredCommercialVoiceover(input, budget);
  const rebuiltValidation = validateVoiceoverCommercial(rebuilt, {
    ...input,
    minWords: floor,
    maxWords,
  });
  if (rebuiltValidation.valid && countWords(rebuilt) <= maxWords) {
    return rebuilt;
  }

  const forced = buildStructuredCommercialVoiceover(input, {
    minWords: floor,
    maxWords,
    targetWords: budget.targetWords,
  });
  return ensureCompleteSentence(forced);
}

/** Split voiceover for stitched clips — part 2 keeps benefit + CTA when possible. */
export function splitVoiceoverForStitch(
  script: string,
  maxWordsPerHalf: number,
  brief?: VoiceoverBrief
): { part1: string; part2: string } {
  const trimmed = script.trim();
  if (!trimmed) return { part1: "", part2: "" };

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWordsPerHalf) {
    return { part1: trimmed, part2: "" };
  }

  const sentences = trimmed
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length >= 2) {
    let part1 = "";
    for (let i = 0; i < sentences.length - 1; i++) {
      const candidate = sentences.slice(0, i + 1).join(" ");
      if (countWords(candidate) <= maxWordsPerHalf) part1 = candidate;
      else break;
    }

    const part1SentenceCount = part1
      ? part1.split(/(?<=[.!?।])\s+/).filter(Boolean).length
      : 0;
    const part2Raw = sentences.slice(Math.max(part1SentenceCount, 1)).join(" ");

    if (part1 && part2Raw) {
      return {
        part1: truncateVoiceover(part1, maxWordsPerHalf, brief),
        part2: ensurePerformanceAdVoiceover(
          brief || {},
          truncateVoiceover(part2Raw, maxWordsPerHalf, brief),
          maxWordsPerHalf,
          Math.max(10, Math.floor(maxWordsPerHalf * 0.65))
        ),
      };
    }
  }

  const midpoint = Math.ceil(words.length / 2);
  const textUpToMid = words.slice(0, midpoint).join(" ");
  const lastSentenceEnd = Math.max(
    textUpToMid.lastIndexOf(". "),
    textUpToMid.lastIndexOf("! "),
    textUpToMid.lastIndexOf("? ")
  );
  if (lastSentenceEnd > 0) {
    const part1Candidate = textUpToMid.slice(0, lastSentenceEnd + 1).trim();
    if (part1Candidate && countWords(part1Candidate) <= maxWordsPerHalf) {
      const part2Raw = words.slice(countWords(part1Candidate)).join(" ");
      return {
        part1: truncateVoiceover(part1Candidate, maxWordsPerHalf, brief),
        part2: ensurePerformanceAdVoiceover(
          brief || {},
          truncateVoiceover(part2Raw, maxWordsPerHalf, brief),
          maxWordsPerHalf,
          Math.max(10, Math.floor(maxWordsPerHalf * 0.65))
        ),
      };
    }
  }

  return {
    part1: truncateVoiceover(words.slice(0, midpoint).join(" "), maxWordsPerHalf, brief),
    part2: ensurePerformanceAdVoiceover(
      brief || {},
      truncateVoiceover(words.slice(midpoint).join(" "), maxWordsPerHalf, brief),
      maxWordsPerHalf,
      Math.max(10, Math.floor(maxWordsPerHalf * 0.65))
    ),
  };
}

export function redistributeVoiceoverToStoryboard(
  storyboard: StoryboardScene[],
  voiceoverScript: string
): StoryboardScene[] {
  const script = voiceoverScript.trim();
  if (!storyboard.length) return storyboard;

  if (!script) {
    return storyboard.map((scene) => ({
      ...scene,
      voiceover_line: "",
      voiceover_script: "",
    }));
  }

  const sentences = script
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return storyboard.map((scene) => ({
      ...scene,
      voiceover_line: "",
      voiceover_script: "",
    }));
  }

  const sceneCount = storyboard.length;
  const lines: string[] = Array.from({ length: sceneCount }, () => "");
  sentences.forEach((sentence, idx) => {
    const target = Math.min(sceneCount - 1, Math.floor((idx / sentences.length) * sceneCount));
    lines[target] = lines[target] ? `${lines[target]} ${sentence}` : sentence;
  });

  return storyboard.map((scene, idx) => ({
    ...scene,
    voiceover_line: lines[idx] || "",
    voiceover_script: lines[idx] || "",
  }));
}

function parseSceneTimeRange(timeRange: string): { start: number; end: number } | null {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
}

/** Return storyboard scenes that fall within a clip segment (for stitched videos). */
export function filterStoryboardForSegment(
  storyboard: StoryboardScene[] | undefined,
  segmentIndex: number,
  segmentDurationSeconds: number
): StoryboardScene[] {
  if (!storyboard?.length) return [];
  const segStart = segmentIndex * segmentDurationSeconds;
  const segEnd = segStart + segmentDurationSeconds;

  return storyboard.filter((scene) => {
    const range = scene.time_range || "";
    const parsed = parseSceneTimeRange(range);
    if (!parsed) return segmentIndex === 0;
    const midpoint = (parsed.start + parsed.end) / 2;
    return midpoint >= segStart && midpoint < segEnd;
  });
}

/** Director-grade style specs — Tier-1 commercial / ad film level. */
export const VIDEO_STYLE_DIRECTOR_SPECS: Record<string, StyleDirectorSpec> = {
  Hook: {
    role: "Performance creative director — scroll-stopping direct response",
    aesthetic: "High-contrast, punchy, conversion-first. Every frame sells.",
    cinematography: "Tight framing, snap zooms, whip-pans, macro product inserts, handheld energy on hooks",
    lighting: "Hard key light, strong rim, high contrast, bold shadows — never flat or ambient",
    pacing: "Fast cuts every 1–2s. Zero dead air. Hook in frame 1.",
    lensFeel: "35mm wide for impact shots, 85mm macro for product detail",
    references: "high-energy short-form commerce ads, direct-response social, scroll-stopping product promos",
  },
  Commercial: {
    role: "Premium brand film director — broadcast-quality paid media",
    aesthetic: "Polished, aspirational, product-as-hero. Feels like a Super Bowl spot compressed.",
    cinematography: "Slider dolly moves, slow push-ins, rack focus reveals, hero product orbit, controlled pans",
    lighting: "Three-point studio lighting, soft highlights, controlled specular on product, clean whites",
    pacing: "Confident rhythm: hook → demo → payoff → brand lock. Motivated cuts on beats.",
    lensFeel: "50mm natural perspective for lifestyle, 100mm macro for product texture, shallow T1.8 DOF",
    references: "premium minimalist product films, kinetic brand spots, polished broadcast-style commerce ads",
  },
  "UGC Style": {
    role: "Native social creator director — authentic, not polished",
    aesthetic: "Phone-filmed realism. Imperfect but believable. Trust-first.",
    cinematography: "Selfie angle, slight handheld shake, jump cuts, reaction zooms, POV product handling",
    lighting: "Natural window light or room light — never studio-polished",
    pacing: "Conversational rhythm with jump-cut energy. Feels unscripted.",
    lensFeel: "Phone camera wide (~24mm equivalent), eye-level, arm's length",
    references: "authentic short-form creator reviews, natural handheld testimonials",
  },
  "Product Close-up": {
    role: "Product cinematographer — texture, detail, craft",
    aesthetic: "Macro beauty shots. Product is sculpture. Every surface tells quality.",
    cinematography: "Extreme close-ups, slow orbit, rack focus across product features, detail inserts",
    lighting: "Soft box key, gradient backdrop, controlled reflections, highlight roll-off on edges",
    pacing: "Deliberate, luxurious. Let each detail breathe 1–2s before cut.",
    lensFeel: "100mm macro, T2.8 shallow DOF, creamy bokeh background",
    references: "luxury macro product films, premium detail-driven commercials",
  },
  Lifestyle: {
    role: "Lifestyle film director — human stories around the product",
    aesthetic: "Warm, relatable, aspirational everyday moments. Product integrated naturally.",
    cinematography: "Medium shots in real environments, follow-cam, over-shoulder, golden-hour exteriors",
    lighting: "Natural golden hour or soft window light, warm color temperature (~4800K)",
    pacing: "Flowing narrative arc. Emotional build to product moment.",
    lensFeel: "35mm documentary feel, natural depth, gentle movement",
    references: "aspirational lifestyle brand films, warm human-centered storytelling",
  },
  Cinematic: {
    role: "Cinematic film director — narrative-driven visual poetry",
    aesthetic: "Film-grade production. Anamorphic feel. Story through light and motion.",
    cinematography: "Crane shots, slow dolly, dramatic reveals, silhouette moments, depth layering",
    lighting: "Motivated cinematic lighting, volumetric rays, chiaroscuro contrast, color-motivated gels",
    pacing: "Deliberate build with emotional crescendo. Cuts serve story beats.",
    lensFeel: "Anamorphic 2.39:1 feel, 35mm/50mm spherical, lens flare on highlights",
    references: "cinematic premium brand films, dramatic narrative lighting, high-end automotive-style visuals",
  },
  Luxury: {
    role: "Luxury brand director — exclusivity, refinement, desire",
    aesthetic: "Understated opulence. Slow confidence. Every frame whispers premium.",
    cinematography: "Static hero compositions, imperceptibly slow push-ins, elegant reveals",
    lighting: "Low-key elegant lighting, warm gold accents, deep shadows, silk-smooth gradients",
    pacing: "Slow, deliberate. Minimum 2s per shot. Never rushed.",
    lensFeel: "85mm portrait compression, T1.4 ultra-shallow DOF, creamy falloff",
    references: "high-fashion luxury brand films, understated prestige visuals",
  },
  Minimalist: {
    role: "Minimal design director — restraint as power",
    aesthetic: "Clean negative space. Product isolated. Zero visual noise.",
    cinematography: "Centered compositions, slow subtle moves, geometric framing",
    lighting: "High-key soft light, white/neutral backgrounds, single soft shadow",
    pacing: "Calm, measured. Long holds. Breathing room between beats.",
    lensFeel: "50mm straight-on, deep focus, clinical precision",
    references: "minimal design-led product films, Scandinavian-style clean composition",
  },
  "Bold & Energetic": {
    role: "High-energy sports/ad director — maximum visual impact",
    aesthetic: "Kinetic, vibrant, adrenaline. Colors pop. Motion never stops.",
    cinematography: "Whip-pans, speed ramps, dutch angles, rapid match cuts, dynamic tracking",
    lighting: "Saturated colors, bold gel accents, high energy contrast",
    pacing: "Sub-1.5s cuts. Relentless forward momentum. Beat-synced editing.",
    lensFeel: "24mm wide for impact, fast shutter for crisp motion",
    references: "high-energy drink spots, festival-style motion, adrenaline-led promos",
  },
  "2D Animation": {
    role: "Animation director — illustrated brand storytelling",
    aesthetic: "Clean vector/flat illustration. Expressive motion graphics storytelling.",
    cinematography: "Smooth animated camera pans, scale transitions, parallax layers",
    lighting: "Illustrated light/shadow, gradient backgrounds, stylized highlights",
    pacing: "Snappy animated beats. Squash-and-stretch on transitions.",
    lensFeel: "N/A — flat/2.5D illustrated perspective",
    references: "premium motion design reels, polished animated explainer spots",
  },
  "Motion Graphics": {
    role: "Motion design director — design-forward kinetic visuals",
    aesthetic: "Graphic elements, shape transitions, dynamic visual flow. No live-action.",
    cinematography: "Element-driven camera, zoom-through transitions, particle reveals",
    lighting: "Neon accents, gradient backgrounds, glow effects",
    pacing: "Rhythmic, design-synced. Every transition is intentional.",
    lensFeel: "N/A — graphic/3D camera space",
    references: "modern tech launch videos, design-forward product motion reels",
  },
  Retro: {
    role: "Vintage film director — nostalgic analog warmth",
    aesthetic: "Film grain, faded colors, VHS/analog artifacts, nostalgic mood",
    cinematography: "Static or gentle handheld, period-appropriate framing",
    lighting: "Warm tungsten, soft halation, lifted blacks, faded highlights",
    pacing: "Relaxed vintage rhythm. Longer holds with grain texture.",
    lensFeel: "Vintage 50mm soft focus, slight vignette, chromatic aberration",
    references: "retro broadcast-commercial aesthetic, analog film nostalgia",
  },
  "Stop Motion": {
    role: "Stop-motion animation director — tactile craft",
    aesthetic: "Physical, handcrafted feel. Frame-by-frame charm.",
    cinematography: "Locked camera, subtle frame-by-frame object movement",
    lighting: "Even studio lighting, soft shadows, craft-table aesthetic",
    pacing: "Playful stop-motion rhythm. Satisfying object transitions.",
    lensFeel: "50mm tabletop macro perspective",
    references: "premium stop-motion product ads, handcrafted tactile brand films",
  },
  "3D Animation": {
    role: "CGI director — photoreal or stylized 3D product world",
    aesthetic: "Polished CGI environments. Product as 3D hero asset.",
    cinematography: "Virtual camera orbit, fly-through, particle simulations",
    lighting: "HDRI studio lighting, caustics, realistic material shaders",
    pacing: "Cinematic CGI reveal sequence with build-up.",
    lensFeel: "Virtual 35mm with depth of field pass",
    references: "premium 3D product renders, polished CGI launch films",
  },
};

const DEFAULT_STYLE_SPEC: StyleDirectorSpec = {
  role: "Award-winning commercial film director",
  aesthetic: "Broadcast-quality brand film. Premium, intentional, every frame composed.",
  cinematography: "Professional multi-shot edit with motivated cuts, dolly/slider moves, rack focus",
  lighting: "Controlled three-point or motivated natural light, consistent color grade",
  pacing: "Clear narrative arc: hook → product → payoff → brand lock-in",
  lensFeel: "35mm/50mm cinematic perspective, shallow DOF on product hero moments",
  references: "premium agency-grade brand films, polished direct-to-consumer commercials",
};

export function getStyleDirectorSpec(style?: string): StyleDirectorSpec {
  if (!style) return DEFAULT_STYLE_SPEC;
  return VIDEO_STYLE_DIRECTOR_SPECS[style] || DEFAULT_STYLE_SPEC;
}

export const FILM_MODE_FLAG = "FILM_MODE = true";

export const FILMMAKING_RULE_BLOCK = `
FILMMAKING RULE (CRITICAL):

This is not a montage.

This advertisement must feel like a single cohesive short film.

Every scene must be visually and emotionally connected to the previous scene.

The viewer should feel they are watching one continuous story unfold naturally, not separate clips stitched together.

Each shot must have:
1. Cause from the previous shot
2. Visual continuity
3. Motivated camera movement
4. Emotional progression

Transitions must be motivated by action, movement, eye-line, object interaction, or camera motion.

Avoid random scene jumps.
Avoid slideshow-style storytelling.
Avoid isolated hero shots with no narrative context.

The camera should feel like it is following the story, not generating unrelated visuals.
`.trim();

export const STORY_FLOW_MANDATORY = `
STORY FLOW (MANDATORY):

Scene 1 introduces a problem, desire, or curiosity.
Scene 2 develops that moment naturally.
Scene 3 reveals the product within the story.
Scene 4 demonstrates transformation.
Scene 5 resolves emotionally.
Scene 6 lands on the brand payoff.

Every scene must feel like the next logical moment of the same story.
No disconnected shots.
`.trim();

export const TRANSITION_DESIGN_BLOCK = `
TRANSITION DESIGN:

Scene changes must use:
• Match cuts
• Object continuity
• Camera continuation
• Motion continuation
• Eye-line continuation

Examples:
A hand reaches for the product → next scene begins with that same hand opening it.
Camera pushes toward the product → next scene starts from a closer angle of that same movement.
Character turns → next shot begins completing that turn.

Every cut should feel invisible.
`.trim();

export const CONTINUITY_RULES_BLOCK = `
CONTINUITY RULES:

Maintain the same throughout the film:
• Character appearance
• Clothing
• Hairstyle
• Environment
• Lighting direction
• Color grade
• Time of day

Do not generate different actors.
Do not change environments without narrative reason.
Do not change wardrobe between scenes.

The film should feel captured on the same production day.
`.trim();

export const EMOTIONAL_ARC_BLOCK = `
EMOTIONAL ARC (see EMOTIONAL CURVE SYSTEM for per-shot assignment):

0-20% = Curiosity — pattern interrupt, intrigue
20-40% = Tension — problem, stakes, struggle
40-60% = Discovery — insight, product reveal
60-80% = Satisfaction — proof, transformation
80-100% = Resolution — payoff, brand lock-in

Emotion must gradually increase throughout the film.
Do not keep every shot emotionally neutral.
`.trim();

export const PHYSICAL_REALISM_BLOCK = `
PHYSICAL REALISM (CRITICAL):

All objects must behave according to real-world physics.

Every interaction must follow the complete sequence of actions.
Do not skip mechanical steps.

Examples:

Bottle:
1. Hand grabs bottle
2. Cap is unscrewed
3. Cap is removed
4. Bottle is tilted
5. Liquid pours out

Food Packet:
1. Packet is held
2. Seal is torn open
3. Opening becomes visible
4. Contents are poured

Coffee Jar:
1. Lid is opened
2. Spoon enters jar
3. Coffee is scooped
4. Coffee is transferred

Never show contents exiting a sealed container.
Never show liquids, powders, food, or ingredients appearing magically.
Every output must have a visible source.
`.trim();

export const OBJECT_STATE_TRACKING_BLOCK = `
OBJECT STATE TRACKING:

Every product must maintain logical state. Never jump between states.

Bottle (pour):
Closed → Opened → Pouring → Empty

RTD protein shake bottle (screw cap):
Cap on → Cap unscrewed → Cap removed → At lips → Sipping
(Never sip while cap is still on the neck.)

Food Packet:
Sealed → Torn Open → Open → Pouring

Coffee Cup:
Empty → Filling → Full → Drinking

Jar (powder/granules):
Closed → Lid Removed → Open → Scooping → Transferring

Pump Dispenser:
Idle → Pressed → Dispensing → Released

Tube (toothpaste, cream):
Sealed → Cap Removed → Squeezed → Product Extrudes

Atomizer (perfume, spray):
Capped → Uncapped → Pressed → Mist Disperses

Track state across every scene. The product in scene N must reflect the state earned by scene N-1.
`.trim();

export const REALITY_CHECK_BLOCK = `
REALITY CHECK (PHYSICS SUPERVISOR):

Before rendering every scene, verify: Can this action happen in real life?
If not, regenerate the action.

Reject:
• Liquids leaving closed bottles
• Drinking or sipping from a bottle while the screw cap is still on
• Mouth on bottle neck before cap is visibly removed
• Food exiting unopened packages
• Floating products
• Teleporting objects
• Instant transformations
• Missing cause-and-effect actions
• Different product appearance between scenes (label, color, cap, fill level)
• Powder, liquid, or food with no visible source container

Cause-and-effect gates:
- Did the cap get removed? If NO → liquid cannot pour.
- Did the packet get opened? If NO → powder/food cannot appear.
- Did the person press the pump? If NO → soap/lotion cannot dispense.
- Did the lid get unscrewed? If NO → contents cannot be scooped or poured.
`.trim();

type ProductInteractionProfile = {
  id: string;
  label: string;
  states: string[];
  sequence: string[];
  match: RegExp;
};

const PRODUCT_INTERACTION_PROFILES: ProductInteractionProfile[] = [
  {
    id: "beard_oil",
    label: "Beard oil / dropper bottle",
    states: ["Closed", "Cap removed", "Dropper out", "Tilted", "Drops dispensed", "Applied"],
    sequence: [
      "Pick up bottle",
      "Unscrew cap",
      "Remove dropper",
      "Tilt bottle",
      "Dispense drops into palm or dropper",
      "Apply to beard/skin",
    ],
    match: /beard oil|face oil|hair oil|serum|dropper|essential oil/i,
  },
  {
    id: "protein_shake_rtd",
    label: "Ready-to-drink protein shake (screw-cap bottle)",
    states: ["Cap on", "Cap unscrewed", "Cap removed", "At lips", "Sipping"],
    sequence: [
      "Hand picks up sealed bottle",
      "Unscrew and remove cap completely",
      "Open neck visible — cap off bottle",
      "Raise open bottle to lips",
      "Take a visible sip",
    ],
    match:
      /protein\s*shake|ready[\s-]?to[\s-]?drink|\brtd\b|\b(protein|vitamin)\s+(shake|drink)\b|\bshake\s+bottle/i,
  },
  {
    id: "bottle_liquid",
    label: "Bottle (liquid pour)",
    states: ["Closed", "Cap unscrewed", "Cap removed", "Tilted", "Pouring", "Empty"],
    sequence: [
      "Hand grabs bottle",
      "Cap is unscrewed",
      "Cap is removed",
      "Bottle is tilted",
      "Liquid pours into target",
    ],
    match: /bottle|shampoo|conditioner|lotion|body wash|juice|drink|beverage|oil/i,
  },
  {
    id: "facewash_pump",
    label: "Foaming facewash / pump bottle",
    states: ["Closed", "Picked up", "Pump pressed", "Foam dispensing", "Applied"],
    sequence: ["Pick up bottle", "Press pump", "Foam dispenses to palm", "Apply to face"],
    match: /\b(facewash|face wash|cleanser|foaming)\b/i,
  },
  {
    id: "food_packet",
    label: "Food / snack packet",
    states: ["Sealed", "Torn open", "Opening visible", "Pouring", "Empty"],
    sequence: [
      "Hold packet",
      "Tear seal open",
      "Opening becomes visible",
      "Pour or tip contents out",
    ],
    match: /(?:\b(packet|pouch|chips|snack|noodle|granola|cereal)\b|\binstant\s+(food|meal|noodle|ramen|snack))/i,
  },
  {
    id: "coffee_jar",
    label: "Coffee jar / powder container",
    states: ["Closed", "Lid opened", "Open", "Scooping", "Transferring"],
    sequence: [
      "Open lid",
      "Spoon enters jar",
      "Coffee/powder is scooped",
      "Transferred to cup or vessel",
    ],
    match: /coffee|instant coffee|protein powder|powder|jar|canister/i,
  },
  {
    id: "toothpaste",
    label: "Toothpaste / squeeze tube",
    states: ["Sealed", "Cap removed", "Squeezed", "Paste extrudes"],
    sequence: ["Open cap", "Squeeze tube", "Paste extrudes onto brush"],
    match: /toothpaste|tooth paste|tube/i,
  },
  {
    id: "perfume",
    label: "Perfume / atomizer spray",
    states: ["Capped", "Uncapped", "Atomizer pressed", "Mist disperses"],
    sequence: ["Remove cap", "Press atomizer", "Mist sprays onto skin or air"],
    match: /perfume|cologne|fragrance|mist|spray/i,
  },
  {
    id: "pump_dispenser",
    label: "Pump dispenser (soap, lotion)",
    states: ["Idle", "Hand on pump", "Pressed", "Dispensing", "Released"],
    sequence: ["Hand positions on pump", "Press pump head", "Product dispenses", "Release"],
    match: /pump|hand soap|hand wash|dispenser|sanitizer/i,
  },
  {
    id: "cup_fill",
    label: "Cup / mug (fill and drink)",
    states: ["Empty", "Filling", "Full", "Lifting", "Drinking"],
    sequence: ["Cup empty on surface", "Liquid poured in", "Cup fills", "Hand lifts cup", "Sip"],
    match: /cup|mug|glass|tumbler/i,
  },
];

const DEFAULT_PRODUCT_INTERACTION_PROFILE: ProductInteractionProfile = {
  id: "generic",
  label: "General product",
  states: ["Idle", "Handled", "Activated", "In use", "Result visible"],
  sequence: [
    "Identify the product object",
    "Show hand/body contact before use",
    "Complete all mechanical steps to activate (open, unscrew, tear, press, scoop)",
    "Show the product working with visible cause and effect",
    "Show the result only after the action sequence",
  ],
  match: /$/,
};

function detectProductInteractionProfile(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): ProductInteractionProfile {
  const haystack = `${input.category || ""} ${input.productName || ""} ${input.userDescription || ""}`;
  return (
    PRODUCT_INTERACTION_PROFILES.find((p) => p.match.test(haystack)) ||
    DEFAULT_PRODUCT_INTERACTION_PROFILE
  );
}

/** Hidden pre-render layer — prop master + continuity + physics checker. */
export function buildProductInteractionValidationBlock(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">,
  scenes?: StoryboardScene[]
): string {
  const profile = detectProductInteractionProfile(input);
  const productLabel = input.productName || "the product";

  const sceneChecklist = (scenes || [])
    .map((scene, idx) => {
      const sceneNum = scene.scene ?? idx + 1;
      const visual = (scene.visual_description || scene.description || "").trim();
      const message =
        (scene as StoryboardScene & { marketing_message?: string }).marketing_message || "";
      if (!visual && !message) return null;
      return [
        `  Scene ${sceneNum}:`,
        `    Visual: ${visual || "(none)"}`,
        message ? `    Intent: ${message}` : "",
        `    Validate: What object? What state is it in? Can this action happen now? If not, insert required mechanical steps first.`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  return `
PRODUCT INTERACTION VALIDATION (INTERNAL — do not skip; validate before rendering):

This is a pre-generation reasoning layer. Act as prop master + continuity supervisor + physics checker.
Do not render any frame until every check passes.

Product: ${productLabel}
Product type: ${profile.label}
Valid state progression: ${profile.states.join(" → ")}

Required interaction sequence for this product type:
${profile.sequence.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Validation chain (apply to EVERY product interaction):
1. What object is being used?
2. What state is it currently in?
3. What action is the scene requesting?
4. Can that action happen in the current state?
5. If NO — list required mechanical steps before rendering.

Example — beard oil:
  Object: beard oil bottle | State: Closed | Action: oil in hand | Can oil come out? NO (bottle closed)
  Required: pick up → unscrew cap → remove dropper → tilt → dispense → apply.

Example — instant noodles:
  Object: noodle packet | State: Sealed | Action: noodles in bowl | Can noodles leave? NO (packet sealed)
  Required: hold packet → tear open → opening visible → pour noodles → add water → stir → serve.

Example — protein shake bottle:
  Object: shake bottle | State: Cap on | Action: sip from bottle | Can she drink? NO (cap still on)
  Required: pick up → unscrew cap → remove cap → open neck visible → raise to lips → sip.

${sceneChecklist.length ? `Per-scene validation checklist:\n${sceneChecklist.join("\n")}` : "No storyboard scenes — still enforce full mechanical sequences for any product use shown."}

REJECT and revise any visual that shows:
- Liquids leaving closed containers
- Drinking through a sealed screw cap
- Food/powder exiting unopened packages
- Contents with no visible source
- Skipped steps (cap removal, seal tear, pump press, lid open)
- State jumps (e.g. Sealed → Pouring without Open)
- Product appearance changes between scenes (label, color, cap, fill level)

Only render after the complete cause-and-effect chain is satisfied.
`.trim();
}

function buildPhysicsSupervisorBlock(): string {
  return [PHYSICAL_REALISM_BLOCK, OBJECT_STATE_TRACKING_BLOCK, REALITY_CHECK_BLOCK].join("\n\n");
}

function buildPostStoryboardPhysicsLayer(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription" | "brandName" | "campaignGoal" | "hookType" | "clipDurationSeconds" | "totalDurationSeconds" | "voiceoverScript" | "creativeStrategy">,
  scenes?: StoryboardScene[]
): string {
  const extended = scenes as ExtendedStoryboardScene[] | undefined;
  return [
    buildPostDirectorPipelineLayers(input, extended),
    buildProductInteractionValidationBlock(input, scenes),
    buildPhysicsSupervisorBlock(),
  ].join("\n\n");
}

function buildPreStoryboardFilmDirectives(): string {
  return [
    FILM_MODE_FLAG,
    FILM_GRAMMAR_BLOCK,
    FILMMAKING_RULE_BLOCK,
    TRANSITION_DESIGN_BLOCK,
    CONTINUITY_RULES_BLOCK,
    EMOTIONAL_ARC_BLOCK,
  ].join("\n\n");
}

export function buildShotByShotBlock(
  storyboard: StoryboardScene[] | undefined,
  clipDurationSeconds: number,
  segmentOffsetSeconds = 0,
  productContext?: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): string {
  if (!storyboard?.length) return "";

  const lines = storyboard
    .map((scene, idx) => {
      const timeRange = scene.time_range || `${segmentOffsetSeconds + idx * 2}-${segmentOffsetSeconds + (idx + 1) * 2}s`;
      const visual = scene.visual_description?.trim();
      if (!visual) return null;

      const parts = [
        `  Shot ${scene.scene ?? idx + 1} [${timeRange}]: ${visual}`,
      ];
      if (scene.motion_style?.trim()) parts.push(`    Camera: ${scene.motion_style.trim()}`);
      if (scene.emotion?.trim()) parts.push(`    Emotion: ${scene.emotion.trim()}`);
      const vo = (scene.voiceover_line || scene.voiceover_script || "").trim();
      if (vo) parts.push(`    VO line: "${vo}"`);

      return parts.join("\n");
    })
    .filter(Boolean);

  if (!lines.length) return "";

  return [
    buildPreStoryboardFilmDirectives(),
    "",
    buildDirectorLayerBlock({
      ...(productContext || {}),
      clipDurationSeconds,
    }),
    "",
    `STORY FLOW (MANDATORY — ${clipDurationSeconds}s cohesive short film):`,
    STORY_FLOW_MANDATORY,
    "",
    lines.join("\n"),
    "",
    buildPostStoryboardPhysicsLayer(
      { ...productContext, clipDurationSeconds } as VeoPromptInput,
      storyboard
    ),
    "",
    "Execute each shot at its time_range. Every cut must be motivated — match cuts, object/camera/motion/eye-line continuation.",
    "No random scene jumps. No slideshow storytelling. One continuous story unfolding naturally.",
  ].join("\n");
}

export function buildSoundDesignBlock(hasVoiceover: boolean, clipDurationSeconds: number): string {
  const tailStart = Math.max(0, clipDurationSeconds - 2);
  return `
SOUND DESIGN (broadcast mix):
${hasVoiceover ? "- Voiceover: warm, confident commercial VO. Clean studio recording. Slight compression. No echo/reverb on speech." : "- No voiceover."}
- Music: premium licensed-style underscore. Builds subtly, swells at ${tailStart}s for the hero close.
- SFX: subtle product foley (clicks, pours, textures) synced to visual actions — never overpowering.
- Mix: VO forward in center, music ducked under speech (-6dB), ambient bed fills gaps.
- Final ${clipDurationSeconds - tailStart}s: music-forward finish, VO silent, satisfying audio resolve.
`.trim();
}

export function buildVoiceoverPromptBlock(
  voiceoverScript: string | undefined,
  clipDurationSeconds: number,
  brief?: VoiceoverBrief
): string {
  if (!voiceoverScript?.trim()) {
    return "No voiceover — use premium background music and subtle sound design only.";
  }

  const budget = computeVoiceoverBudget(clipDurationSeconds);
  const script = finalizeVoiceoverForClip(voiceoverScript, clipDurationSeconds, brief);
  const wordCount = countWords(script);
  const finishBySecond = budget.finishBySecond;

  return `
VOICEOVER DIRECTION (CRITICAL — DO NOT CUT OFF SPEECH):
- This clip is exactly ${clipDurationSeconds} seconds. Script: ${wordCount} words — ALL speech MUST finish by ${finishBySecond}s.
- Speak EXACTLY: "${script}"
- Delivery: natural commercial VO — conversational but confident. NOT robotic, NOT rushed, NOT monotone.
- Dialogue quality: hook-first line, specific product benefits, proof where possible, clear CTA before the finish line.
- Use natural breath pauses between phrases. Micro-reactions while speaking if talent is on camera.
- Lip sync must match spoken rhythm if face is visible.
- Start within 0.3s. Steady pacing (~${VOICEOVER_WORDS_PER_SECOND} words/sec). Final word lands cleanly before ${finishBySecond}s — never mid-sentence.
- Last ${budget.tailSilenceSeconds}s (${finishBySecond}–${clipDurationSeconds}s): COMPLETELY SILENT. Hero frame + music swell only.
`.trim();
}

export function buildOpeningClosingPromptBlock(clipDurationSeconds: number): string {
  const holdStart = Math.max(0, clipDurationSeconds - 1);
  return `
OPENING & CLOSING (film-grade bookends):
- OPENING (0–1s): Immediate visual hook — no fade from black, no empty drift. Frame 1 must stop the scroll.
- MID-FILM: Every transition lands on action, gesture, or beat. Match cuts > dissolves. No morphing or AI-smear.
- CLOSING (${holdStart}–${clipDurationSeconds}s): Resolve on stable product hero. Camera settles (slow push-in or static hold). 1 full second of breathing room — no abrupt freeze, no cut to black.
`.trim();
}

export const AD_FILM_CRAFT_SPEC = `
PRODUCTION QUALITY (broadcast / Tier-1 agency standard):
- Photorealistic live-action (unless animation style specified). 24fps cinematic motion cadence.
- Exposure: bright, clean, well-lit. Natural skin tones. No muddy shadows or crushed blacks.
- Color grade: unified LUT across all shots — consistent temperature, contrast, and saturation.
- Camera physics: realistic motion blur, stable horizon, no jitter/wobble/warping between frames.
- Product fidelity: exact shape, label, color, packaging from reference — zero drift across shots.

EDITING GRAMMAR (professional ad cut):
- Multi-shot narrative (3–7 motivated shots). One cohesive short film — not a random montage or slideshow.
- Cut types: match cut on action, whip-pan exit/entry, rack-focus pull, speed-ramp, motivated hard cut.
- Each shot flows from the previous — cause, visual continuity, motivated camera, emotional progression.
- Forbidden: morphing transitions, random teleports, flicker, object geometry shifts, label changes.

NEGATIVE CONSTRAINTS:
- STRICT ZERO-TEXT: no captions, titles, subtitles, slogans, flavor callouts, brand typography overlays, floating logos, end-card words, or any readable lettering in the frame.
- Product pack may show only its intrinsic factory label from the reference — never duplicate branding elsewhere in the scene.
- Brand and product names are VOICEOVER ONLY — never rendered as on-screen text.
- No extra limbs, warped faces, melting objects, plastic skin, AI halos, or texture crawling.
- No voiceover cut off mid-word. No abrupt ending before script completes.
- No impossible physics: liquids from closed containers, food from sealed packets, teleporting objects, or magical product appearance.
- No nudity, partial nudity, exposed breasts, nipples, bare chest, lingerie, or revealing attire.
- No shower/bath scenes with exposed skin. No suggestive or intimate framing.
`.trim();

/** @deprecated Use AD_FILM_CRAFT_SPEC */
export const REALISM_AND_EDIT_SPEC = AD_FILM_CRAFT_SPEC;

/** Keywords woven into the text prompt (Gemini Veo API does not accept negativePrompt). */
export const VEO_NEGATIVE_SAFETY_PROMPT =
  "nudity, nude, naked, topless, bare chest, exposed breasts, nipples, areola, lingerie, underwear only, see-through clothing, sheer fabric, bikini, swimwear, sexual content, erotic, suggestive pose, intimate body parts, exposed torso, cleavage, revealing clothing, shower nudity, bath nudity, towel drop";

export const SAFETY_BLOCK = `
CONTENT SAFETY (MANDATORY — mainstream TV brand advertisement standard):
- People ARE allowed as models, spokespersons, and lifestyle talent — but MUST be fully clothed in EVERY frame.
- NO nudity, partial nudity, topless, bare chest, exposed breasts, nipples, areola, lingerie, underwear-only, see-through or sheer clothing, or revealing swimwear.
- Modest necklines only — no cleavage focus. No intimate body areas in frame.
- NO shower, bath, spa, or towel-drop scenes with exposed skin. NO bedroom intimacy vibes.
- Apply each product to its CORRECT site: FACE products (serum, facewash, cleanser, face cream, moisturizer, vitamin C, sunscreen, eye cream) on the FACE (cheeks, forehead, jawline, under-eye); HAIR products on hair/scalp; HAND products on hands; BEARD oil on the beard/jawline; BODY lotion on FOREARMS or LOWER LEGS only. NEVER rub a face product on the arm/elbow/leg.
- Regardless of site: model stays fully clothed; NEVER show application on chest, torso, back, or intimate areas.
- Model wears modest everyday clothing (full shirt, closed robe, athletic wear). Think Dove/Nivea/Olay TV commercials — professional, modest, family-friendly, safe for work.
- DO NOT DEPICT: ${VEO_NEGATIVE_SAFETY_PROMPT}.
`.trim();

/** Rules injected into script-generation prompts so storyboards avoid risky visuals. */
export const SCRIPT_CONTENT_SAFETY = `

CONTENT SAFETY (MANDATORY — every visual_description and final_video_prompt MUST comply):
- People are allowed, but MUST be fully clothed in every scene. NO nudity or partial nudity.
- NO bare chest, exposed breasts, nipples, lingerie, underwear-only, see-through clothing, or revealing swimwear.
- NO shower/bath/spa scenes with exposed skin. NO suggestive poses or intimate framing.
- Apply each product to its CORRECT site: FACE products (serum, facewash, cleanser, face cream, moisturizer, vitamin C, sunscreen, eye cream) on the FACE; HAIR products on hair/scalp; HAND products on hands; beard oil on the beard; BODY lotion on forearms/lower legs only. NEVER apply a face product to the arm, elbow, or leg.
- Model wears a modest fully closed top in every shot. NEVER bare-torso or chest application.
- Safe alternatives: product bottle hero, cream texture on palm, smiling face portrait, lifestyle in casual modest outfit.
- If the user vision implies revealing content, reinterpret it as a modest mainstream brand commercial.`;

/** Veo API config — Gemini Veo rejects negativePrompt for most API keys; safety is enforced via text prompt. */
export function buildVeoGenerateSafetyConfig(): Record<string, never> {
  return {};
}

const BODY_BEAUTY_KEYWORDS =
  /\b(body|skin|lotion|moistur|cream|beauty|cosmetic|soap|shampoo|conditioner|serum|balm|oil|bath|shower|personal care|skincare|cleanser|sunscreen|deodorant|wellness|spa)\b/i;

export function isBodyOrBeautyProduct(
  category?: string,
  productName?: string,
  userDescription?: string
): boolean {
  const text = `${category || ""} ${productName || ""} ${userDescription || ""}`;
  return BODY_BEAUTY_KEYWORDS.test(text);
}

export function buildBodyProductSafetyBlock(
  category?: string,
  productName?: string,
  userDescription?: string
): string {
  if (!isBodyOrBeautyProduct(category, productName, userDescription)) return "";
  return `

BODY & SKINCARE PRODUCT RULES (this product category):
- APPLY TO THE CORRECT SITE: face products (serum, facewash, cleanser, face cream, moisturizer, vitamin C, sunscreen, eye cream) go on the FACE — cheeks, forehead, jawline, under-eye. Hair products on hair/scalp. Hand products on hands. Beard oil on the beard. ONLY body lotions/butters go on forearms or lower legs. NEVER rub a face product on the arm, elbow, or leg.
- Anatomy must be correct: exactly one person, two arms, two hands, five fingers each — no extra or duplicated limbs, no warped hands, no morphing bodies (especially across cuts/transitions).
- Model wears a fully closed modest top (t-shirt, sweater, robe tied shut). Neckline must not reveal cleavage.
- Preferred shots: product bottle hero, texture on fingertips/palm, application on the correct site, smiling face close-up, casual lifestyle in everyday outfit.
- FORBIDDEN: post-shower bare shoulders, towel scenes, spa robes open at chest, body-wide application on exposed skin.`;
}

export function buildReferenceImagesBlock(hasReferenceImages: boolean): string {
  if (!hasReferenceImages) {
    return "Create visuals based on the creative treatment above.";
  }
  return `REFERENCE IMAGES (CRITICAL — source of truth):
The attached reference images show the EXACT product and/or logo. Depict with pixel-level fidelity:
same shape, colors, packaging, label text, proportions, and branding. Do NOT redesign, reimagine, or alter the product.
The product must be recognizable in every shot where it appears.
${VEO_STRICT_NO_TEXT_BLOCK}`;
}

function buildSegmentContext(input: VeoPromptInput): string {
  const { segmentIndex, segmentCount, clipDurationSeconds, totalDurationSeconds } = input;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return "";

  const total = totalDurationSeconds ?? clipDurationSeconds * segmentCount;
  if (segmentIndex === 0) {
    return `
SEGMENT 1 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
FIRST HALF — Hook, product introduction, setup. End on a resolved beat (hero product shot, pause, or held frame) for a clean stitch point.`;
  }
  return `
SEGMENT 2 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
SECOND HALF — Continue the SAME story. Match lighting, grade, location, wardrobe, and product EXACTLY from segment 1.
Start with a new motivated angle (match-cut or whip-pan from segment 1 ending). Payoff, emotional climax, brand CTA.`;
}

// ─── Cinematic style mapping (Veo 3.1 — emotion-first prompts) ───────────────

interface CinematicStyle {
  emotion: string;
  camera: string;
  light: string;
  pace: string;
  colorGrade: string;
  closingFeel: string;
}

const STYLE_MAP: Record<string, CinematicStyle> = {
  cinematic: {
    emotion: "awe-inspiring and emotionally resonant",
    camera: "slow cinematic push-in, shallow depth of field, lens breathing subtly",
    light: "golden hour practicals, deep amber fills, long horizon shadows",
    pace: "deliberate and unhurried — every second earns its place",
    colorGrade: "warm film emulation, slightly desaturated midtones, lifted blacks",
    closingFeel: "viewers should feel like they witnessed something meaningful, not just a product ad",
  },
  lifestyle: {
    emotion: "aspirational warmth — the life you want to be living",
    camera: "handheld with gentle human imperfection, floating slowly through the scene",
    light: "soft natural window light or diffused outdoor light, airy and clean",
    pace: "casual and organic — movement feels unscripted",
    colorGrade: "bright, airy, slightly warm — think magazine editorial",
    closingFeel: "the viewer should feel a quiet desire to be in this moment",
  },
  luxury: {
    emotion: "quiet confidence and understated prestige",
    camera: "locked-off wide shots alternating with extreme macro close-ups of material detail",
    light: "controlled studio practicals, strong negative fill, deep blacks, specular highlights on surfaces",
    pace: "slow and considered — silence has weight",
    colorGrade: "cool desaturated with rich shadow detail, near-monochrome with one warm accent",
    closingFeel: "viewers should feel they are in the presence of something rare and considered",
  },
  energetic: {
    emotion: "electric, alive, unstoppable momentum",
    camera: "low-angle tracking shots, dynamic whip pans, quick editorial cuts",
    light: "high contrast, rim lighting, practical light sources popping in frame",
    pace: "fast and rhythmic — synced to an invisible heartbeat",
    colorGrade: "punchy contrast, saturated primaries, deep crushed blacks",
    closingFeel: "viewers should feel a rush — an urge to move",
  },
  minimal: {
    emotion: "calm clarity — the beauty of reduction",
    camera: "static locked-off frames, perfectly composed negative space",
    light: "clean soft boxes or natural overcast, shadowless and pure",
    pace: "serene — unhurried to the point of meditative",
    colorGrade: "near-neutral, muted, breathing room in every tone",
    closingFeel: "viewers should feel peace and confidence in simplicity",
  },
  documentary: {
    emotion: "authentic, human, honest",
    camera: "observational handheld, following rather than directing — a witness not a director",
    light: "available light only — whatever the scene offers",
    pace: "naturalistic — nothing forced",
    colorGrade: "naturalistic grade, no heavy LUT, true skin tones",
    closingFeel: "viewers should feel they glimpsed something real",
  },
  bold: {
    emotion: "confrontational, confident, impossible to ignore",
    camera: "wide angle close — distortion is intentional, space is dramatic",
    light: "hard single-source lighting, stark shadows, aggressive contrast",
    pace: "abrupt and declarative — cuts land like statements",
    colorGrade: "high contrast, almost graphic — block colors, deep shadows",
    closingFeel: "viewers should feel challenged and compelled",
  },
};

const APP_STYLE_TO_CINEMATIC: Record<string, keyof typeof STYLE_MAP> = {
  commercial: "cinematic",
  ugc: "documentary",
  "product showcase": "minimal",
  lifestyle: "lifestyle",
  cinematic: "cinematic",
  "motion graphics": "minimal",
  hook: "energetic",
  "ugc style": "documentary",
  "product close-up": "minimal",
  luxury: "luxury",
  minimalist: "minimal",
  "bold & energetic": "energetic",
  energetic: "energetic",
  bold: "bold",
  documentary: "documentary",
  minimal: "minimal",
};

function getCinematicStyle(style?: string): CinematicStyle {
  const key = (style || "commercial").toLowerCase().trim();
  const mapped = APP_STYLE_TO_CINEMATIC[key] ?? (STYLE_MAP[key] ? key : "cinematic");
  return STYLE_MAP[mapped] ?? STYLE_MAP.cinematic;
}

function getCompositionGuidance(aspectRatio: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "vertical frame — compose for mobile-first viewing. Subject centered or rule-of-thirds vertical. Sky and ground as framing bands. Text-safe zones at top 15% and bottom 20%.";
    case "16:9":
      return "widescreen cinematic frame — use the full horizontal canvas. Strong horizontal leading lines. Environmental storytelling in the periphery.";
    case "4:5":
      return "social portrait frame — slightly taller than wide. Product prominent in upper two-thirds. Breathing room below. Clean for feed scrolling.";
    default:
      return "compose with intention — every element in frame should earn its place.";
  }
}

function getReferenceImageInstruction(hasReferenceImages: boolean, productName?: string): string {
  if (!hasReferenceImages) return "";
  const name = productName || "the product";
  return (
    `CRITICAL — reference images provided: ${name} must appear exactly as shown in the reference images. ` +
    `Preserve packaging shape, label design, color, and proportions with absolute fidelity. ` +
    `Do not stylize, abstract, or approximate the product — it must be photorealistic and true to the reference.`
  );
}

function parseSceneDurationSeconds(duration?: string | number, timeRange?: string): number | undefined {
  if (typeof duration === "number" && duration > 0) return duration;
  if (typeof duration === "string") {
    const n = parseFloat(duration.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const parsed = timeRange ? parseSceneTimeRange(timeRange) : null;
  if (parsed) return Math.max(0.5, parsed.end - parsed.start);
  return undefined;
}

function buildMarketingStrategyBlock(input: VeoPromptInput): string {
  const s = input.creativeStrategy;
  if (!s) return "";
  return [
    "PERFORMANCE AD BRIEF (priority #1 — sell the product, maximize CTR and conversion):",
    s.creativeAngle ? `Creative angle: ${s.creativeAngle}` : "",
    s.hookType || input.hookType ? `Hook mechanism: ${s.hookType || input.hookType}` : "",
    s.targetAudience ? `Target audience: ${s.targetAudience}` : "",
    s.corePainPoint ? `Core pain: ${s.corePainPoint}` : "",
    s.coreDesire ? `Core desire: ${s.coreDesire}` : "",
    s.biggestObjection ? `Objection to overcome: ${s.biggestObjection}` : "",
    s.conversionObjective ? `Conversion objective: ${s.conversionObjective}` : "",
    s.cta ? `CTA: ${s.cta}` : "",
    input.campaignGoal ? `Campaign goal: ${input.campaignGoal}` : "",
    "Visual priority: (1) hook execution (2) product demo (3) benefit clarity (4) proof (5) emotion (6) cinematography.",
    "Mix shot types: lifestyle usage, product close-up, benefit demonstration, social proof moment, hero product ending.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPerformanceStoryboardSection(scenes: StoryboardScene[]): string {
  return buildBeatBasedStoryboardSection(scenes as ExtendedStoryboardScene[], (s, idx) => {
    const sceneNum = s.scene ?? idx + 1;
    const msg = s.marketing_message || s.visual_description || "";
    const vis = s.visual_description || "";
    const proof = s.proof_element ? ` Proof: ${s.proof_element}.` : "";
    const dur = parseSceneDurationSeconds(s.duration, s.time_range);
    const durPart = dur ? ` (~${dur}s)` : "";
    const purpose = s.shot_purpose ? ` Purpose: ${s.shot_purpose}.` : "";
    const transition = s.transition_to_next ? ` Transition out: ${s.transition_to_next}.` : "";
    return `    Shot ${sceneNum}${durPart}: MESSAGE: ${msg}. VISUAL: ${vis}.${purpose}${proof}${transition}`;
  });
}

function buildCinematicStoryboardSection(scenes: StoryboardScene[]): string {
  return buildBeatBasedStoryboardSection(scenes as ExtendedStoryboardScene[], (s, idx) => {
    const sceneNum = s.scene ?? idx + 1;
    const description = s.visual_description || s.description || "";
    const cam = s.motion_style || s.camera;
    const mood = s.emotion || s.mood || s.emotional_zone;
    const dur = parseSceneDurationSeconds(s.duration, s.time_range);
    const camPart = cam ? ` Camera: ${cam}.` : "";
    const moodPart = mood ? ` Emotion: ${mood}.` : "";
    const durPart = dur ? ` (~${dur}s)` : "";
    return `    Shot ${sceneNum}${durPart}: ${description}.${camPart}${moodPart}`;
  });
}

function getVoiceoverPacingNote(voiceoverScript?: string, clipDurationSeconds?: number): string {
  if (!voiceoverScript?.trim()) return "";
  const wordCount = voiceoverScript.trim().split(/\s+/).length;
  const estimatedSeconds = Math.round((wordCount / 130) * 60);
  const budget = clipDurationSeconds ? computeVoiceoverBudget(clipDurationSeconds) : null;
  const budgetNote = budget
    ? ` Must finish by ${budget.finishBySecond}s (max ${budget.maxWords} words). Last ${budget.tailSilenceSeconds}s silent.`
    : "";
  return (
    `AUDIO: Voiceover present (approx. ${estimatedSeconds}s at natural pace).${budgetNote} ` +
    `Visual pacing must breathe with the spoken word — do not fight the narration. ` +
    `Cut on breath points, not arbitrary intervals.`
  );
}

function buildMarketingOneLiner(input: VeoPromptInput): string {
  const s = input.creativeStrategy;
  if (!s) return "";
  const parts = [
    s.creativeAngle,
    s.hookType || input.hookType ? `Hook: ${s.hookType || input.hookType}` : "",
    s.cta ? `CTA: ${s.cta}` : "",
    input.campaignGoal ? `Goal: ${input.campaignGoal}` : "",
  ].filter(Boolean);
  return parts.length ? `Ad brief: ${parts.join(". ")}.` : "";
}

function buildCompactSafetyForVeo(
  category?: string,
  productName?: string,
  userDescription?: string
): string {
  let block =
    `Safety: fully clothed talent, modest family-friendly TV commercial, no nudity or revealing attire. Photorealistic. ${VEO_STRICT_NO_TEXT_BLOCK}`;
  const appSpec = resolveApplicationSite(productName, category, userDescription);
  if (appSpec.site !== "none") {
    block += ` ${applicationSiteDirective(appSpec)}`;
    if (isBodyOrBeautyProduct(category, productName, userDescription)) {
      block += " Model wears a modest closed top.";
    }
  }
  // Anatomy lock — prevents extra/duplicate limbs and morphing, worst at cuts.
  block += ` ${anatomyLockDirective()}`;
  return block;
}

function buildSpokenAdCopyBlock(
  input: Pick<
    VeoPromptInput,
    | "brandName"
    | "productName"
    | "keyMessage"
    | "cta"
    | "creativeStrategy"
    | "userDescription"
    | "clipDurationSeconds"
  >,
  script: string
): string {
  const budget = computeVoiceoverBudget(input.clipDurationSeconds);
  const adScript = finalizeVoiceoverForClip(script, input.clipDurationSeconds, {
    brandName: input.brandName,
    productName: input.productName,
    keyMessage: input.keyMessage,
    cta: input.cta,
    creativeStrategy: input.creativeStrategy,
    userDescription: input.userDescription,
  });
  const finishBy = budget.finishBySecond;
  const wordCount = countWords(adScript);
  const paceWps = Math.min(
    VOICEOVER_WORDS_PER_SECOND + 0.3,
    Math.max(1.8, wordCount / Math.max(1, budget.maxSpokenSeconds))
  ).toFixed(1);

  return `
SPOKEN AD — NATIVE AUDIO REQUIRED (this is a paid commercial, NOT a silent product video):
${VOICEOVER_COMPLETION_RULES}

CLIP LENGTH: exactly ${input.clipDurationSeconds} seconds total. Speech MUST finish by ${finishBy}s — NEVER continue past ${finishBy}s.
Target ${budget.minWords}–${budget.maxWords} words. REQUIRED: hook → brand name → product name → benefit → CTA → complete ending.

Say EXACTLY word-for-word:
"${adScript}"

Delivery: natural commercial VO at ~${paceWps} words/sec — confident, conversational, complete thought. Start at 0.3s. Last syllable lands before ${finishBy}s.
If talent is on camera: lip-sync ONLY the quoted script. Never stop after the hook — finish the full sell.
Last ${budget.tailSilenceSeconds}s (${finishBy}–${input.clipDurationSeconds}s): COMPLETELY SILENT — music swell + product hero frame. No speech at all.
`.trim();
}

function buildCompactCraftForVeo(clipDurationSeconds: number): string {
  const hold = Math.max(0, clipDurationSeconds - 1);
  return `Craft: photorealistic 24fps, unified color grade, motivated match cuts, stable product label. Hook in first second. Hero product hold ${hold}-${clipDurationSeconds}s. STRICT zero on-screen text in every frame — no captions, titles, overlays, or typography.`;
}

function buildCompactSegmentContext(input: VeoPromptInput): string {
  const { segmentIndex, segmentCount, clipDurationSeconds, totalDurationSeconds, aspectRatio } = input;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return "";
  const total = totalDurationSeconds ?? clipDurationSeconds * segmentCount;
  const formatNote = aspectRatio ? ` ${aspectRatio} — no typography in this orientation.` : "";
  if (segmentIndex === 0) {
    return `Segment 1/${segmentCount}: hook + setup. End on clean stitch frame (${clipDurationSeconds}s of ${total}s ad).${formatNote} ZERO on-screen text.`;
  }
  return `Segment 2/${segmentCount}: continue same story — match lighting, wardrobe, product. Payoff + product hero (${clipDurationSeconds}s of ${total}s ad).${formatNote} ZERO on-screen text — no end-card words.`;
}

function buildCompactProductPhysicsLine(
  input: Pick<VeoPromptInput, "category" | "productName" | "userDescription">
): string {
  const profile = detectProductInteractionProfile(input);
  const steps = profile.sequence.slice(0, 5).join(" → ");
  let line = `Product physics (${profile.label}): ${steps}. No skipping mechanical steps.`;
  if (profile.id === "protein_shake_rtd") {
    line +=
      " CRITICAL: unscrew and remove cap before any sip — never drink with cap on the bottle neck.";
  }
  return line;
}

/**
 * Assemble a Veo 3.1 prompt within the 1024-token API limit.
 * Full director/validation layers are used in script generation — not duplicated here.
 */
function buildVeoCompactPrompt(input: VeoPromptInput): string {
  const {
    brandName,
    productName,
    category,
    userDescription,
    style,
    clipDurationSeconds,
    totalDurationSeconds,
    aspectRatio,
    segmentIndex,
    segmentCount,
    finalVideoPrompt,
    fallbackPrompt,
    voiceoverScript,
    storyboard,
    hasReferenceImages = false,
    creativeStrategy,
    headline,
    subtext,
    campaignGoal,
    hookType,
    keyMessage,
    cta,
  } = input;

  const visualStyle = input.creativeFormat || style;
  const totalLabel = totalDurationSeconds ?? clipDurationSeconds;
  const scopedStoryboard =
    segmentCount != null && segmentCount > 1 && segmentIndex != null
      ? filterStoryboardForSegment(storyboard, segmentIndex, clipDurationSeconds)
      : storyboard;
  const trimmedVoiceover = voiceoverScript
    ? finalizeVoiceoverForClip(voiceoverScript, clipDurationSeconds, {
        totalDurationSeconds: totalDurationSeconds ?? clipDurationSeconds,
        segmentIndex,
        segmentCount,
        brandName,
        productName,
        keyMessage,
        cta,
        creativeStrategy,
        userDescription,
      })
    : "";
  const creativeTreatment = sanitizeVisualTreatmentForVeo(
    finalVideoPrompt?.trim() || fallbackPrompt?.trim() || ""
  );
  const hasVoiceover = Boolean(trimmedVoiceover);
  const treatmentTokenBudget = hasVoiceover ? 260 : 420;

  const adCopyInput = {
    brandName,
    productName,
    keyMessage,
    cta,
    creativeStrategy,
    userDescription,
    clipDurationSeconds,
  };

  const sections: string[] = [];

  sections.push(VEO_STRICT_NO_TEXT_BLOCK);

  if (hasVoiceover) {
    sections.push(buildSpokenAdCopyBlock(adCopyInput, trimmedVoiceover));
  }

  const brandBlock = buildBrandContextBlock(input.brandContext, brandName, { videoGeneration: true });
  if (brandBlock) sections.push(brandBlock);

  if (input.referenceSlots) {
    const refBlock = buildLabeledReferenceBlock(input.referenceSlots);
    if (refBlock) sections.push(refBlock);
  } else if (hasReferenceImages) {
    const refLegacy = getReferenceImageInstruction(true, productName);
    if (refLegacy) sections.push(refLegacy);
  }

  if (creativeTreatment.length > 40) {
    sections.push(
      `VISUAL DIRECTION (support the spoken ad — visuals follow the sell):\n${truncateToTokenBudget(creativeTreatment, treatmentTokenBudget)}`
    );
  } else {
    const cine = getCinematicStyle(visualStyle);
    const subject = productName || "the product";
    const brand = brandName ? `${brandName} ` : "";
    const categoryLabel = category ? ` (${category})` : "";
    sections.push(
      [
        `EMOTION: ${cine.emotion}.`,
        `SUBJECT: ${brand}${subject}${categoryLabel}.`,
        userDescription?.trim() || "",
        `CAMERA: ${cine.camera}. LIGHT: ${cine.light}. PACE: ${cine.pace}. COLOR: ${cine.colorGrade}.`,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  sections.push(
    `FRAME: ${clipDurationSeconds}s clip (${totalLabel}s ad). ${aspectRatio}. ${getCompositionGuidance(aspectRatio)}`
  );

  if (input.referenceSlots) {
    // Labeled refs already injected above.
  } else {
    const refInstruction = getReferenceImageInstruction(hasReferenceImages, productName);
    if (refInstruction) sections.push(refInstruction);
  }

  if (scopedStoryboard?.length) {
    sections.push(
      `STORYBOARD (visual shots only — zero on-screen text; all speech is in SPOKEN AD block above):\n${buildCompactStoryboardLines(scopedStoryboard as ExtendedStoryboardScene[], "veo")}`
    );
  } else if (hasVoiceover) {
    sections.push(
      `ON-CAMERA: talent demonstrates ${productName || "product"} while speaking the ad script above.`
    );
  }

  const marketing = buildMarketingOneLiner(input);
  if (marketing) sections.push(marketing);

  sections.push(
    buildDirectorLayerCompact({
      brandName,
      productName,
      category,
      userDescription,
      campaignGoal,
      hookType,
      clipDurationSeconds,
      totalDurationSeconds: totalLabel,
      creativeStrategy,
    })
  );

  sections.push(
    buildCompactPipelineDigest(
      {
        brandName,
        productName,
        category,
        userDescription,
        campaignGoal,
        hookType,
        clipDurationSeconds,
        totalDurationSeconds: totalLabel,
        creativeStrategy,
      },
      scopedStoryboard as ExtendedStoryboardScene[] | undefined
    )
  );

  sections.push(buildCompactProductPhysicsLine(input));

  const segmentCtx = buildCompactSegmentContext(input);
  if (segmentCtx) sections.push(segmentCtx);

  sections.push(buildCompactCraftForVeo(clipDurationSeconds));
  sections.push(buildCompactSafetyForVeo(category, productName, userDescription));

  if (!hasVoiceover) {
    sections.unshift(
      `COMMERCIAL AD: Even without a script, imply a clear product sell — show ${brandName ? `${brandName} ` : ""}${productName || "product"} benefit and transformation, not a silent beauty montage.`
    );
  }

  return joinWithinVeoTokenBudget(sections, VEO_PROMPT_MAX_TOKENS);
}

/** Assemble a cinematic Veo 3.1 prompt — fits within the 1024-token API limit. */
export function buildVeoVideoPrompt(input: VeoPromptInput): string {
  return buildVeoCompactPrompt(input);
}

/** Development helper — score prompt quality before sending to Veo. */
export function auditVideoPrompt(prompt: string): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const checks = [
    {
      test: () => estimateVeoPromptTokens(prompt) > VEO_PROMPT_MAX_TOKENS,
      issue: `Prompt exceeds Veo API limit (~${VEO_PROMPT_MAX_TOKENS} tokens)`,
      suggestion: "Compress creative treatment and storyboard before sending to Veo",
    },
    {
      test: () => prompt.length < 100,
      issue: "Prompt is very short — Veo needs rich context",
      suggestion: "Add emotional intent, camera language, and lighting description",
    },
    {
      test: () => !/emotion|feel|mood|tone/i.test(prompt),
      issue: "No emotional intent stated",
      suggestion: "Lead with how you want the viewer to feel, not just what they should see",
    },
    {
      test: () => !/camera|lens|shot|handheld|tracking|push|pull|aerial|close.?up|wide/i.test(prompt),
      issue: "No camera language specified",
      suggestion: "Add camera movement: push-in, handheld, static wide, low tracking, etc.",
    },
    {
      test: () => !/light|shadow|golden|noon|neon|candle|dusk|overcast/i.test(prompt),
      issue: "No lighting description",
      suggestion: "Describe the light source and quality: golden hour, overcast, neon night, etc.",
    },
    {
      test: () => !/color|grade|tones?|palette|warm|cool|saturated|desaturated/i.test(prompt),
      issue: "No color/grade direction",
      suggestion: "Specify color temperature and grading intent: warm amber, cool desaturated, etc.",
    },
    {
      test: () => !/pace|slow|fast|rhythmic|languid|deliberate|motion/i.test(prompt),
      issue: "No pacing/motion direction",
      suggestion: "Describe the energy and speed of movement in the scene",
    },
    {
      test: () =>
        /\b(beautiful|stunning|amazing)\b/i.test(prompt) &&
        !/EMOTIONAL INTENT|CREATIVE TREATMENT/i.test(prompt),
      issue: "Vague aesthetic adjectives without cinematic structure",
      suggestion: "Replace vague words with specific sensory details: what exactly makes it beautiful?",
    },
  ];

  for (const check of checks) {
    if (check.test()) {
      issues.push(check.issue);
      suggestions.push(check.suggestion);
    }
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { score, issues, suggestions };
}
