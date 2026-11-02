/**
 * Attach Gemini 3.8 Flash TTS voiceover onto a Seedance commercial
 * for Tamil / Hindi / Malayalam / Kannada.
 */

import { uploadVideoBuffer } from "@/lib/creative-studio/video-delivery";
import type { CampaignBrief } from "../campaign/types";
import { getAdTypePlaybook } from "../campaign/ad-type";
import type { FinalCommercial } from "../campaign-executor/types";
import { generateGeminiTtsVoiceover } from "./gemini-tts";
import { resolveVoiceoverScriptForTts } from "./generate-voiceover-script";
import { downloadVideoToBuffer, muxVoiceoverOntoVideo, probeMediaBuffer } from "./mux-voiceover";
import { MAX_FORCED_TEMPO, planVoiceoverFit } from "./voiceover-fit";
import {
  usesGeminiTts,
  normalizeVoiceoverLanguage,
  type VoiceoverLanguage,
} from "./voiceover-languages";

export type VoiceoverPipelinePhase =
  | "SCRIPT_GENERATION"
  | "VOICEOVER_FIT"
  | "TTS_GENERATION"
  | "AUDIO_DECODE"
  | "FFMPEG_MUX"
  | "UPLOAD"
  | "DOWNLOAD_VIDEO";

export class VoiceoverPipelineError extends Error {
  constructor(
    public readonly phase: VoiceoverPipelinePhase,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "VoiceoverPipelineError";
  }
}

/** One line telling the script writer what kind of ad this is. */
export function voiceoverAdContext(brief: CampaignBrief): string | undefined {
  const parts: string[] = [];
  if (brief.adType && brief.adType !== "product") {
    parts.push(`${getAdTypePlaybook(brief.adType).label} — ${getAdTypePlaybook(brief.adType).job}`);
  }
  if (brief.additionalProducts?.length) {
    parts.push(`Products: ${[brief.product, ...brief.additionalProducts].map((p) => p.name).join(", ")}`);
  }
  if (brief.occasion) parts.push(`Occasion: ${brief.occasion}`);
  if (brief.endCard?.offer) parts.push(`Offer: ${brief.endCard.offer}`);
  if (brief.shopDetails) parts.push(`Shop: ${brief.shopDetails}`);
  return parts.length ? parts.join(". ") : undefined;
}

/** Shorter-script attempts before falling back to a speed-up. */
const MAX_VOICEOVER_REWRITES = 2;

export interface AttachGeminiVoiceoverResult {
  final: FinalCommercial;
  script: string;
  language: VoiceoverLanguage;
  voice: string;
  model: string;
}

function phaseMessage(phase: VoiceoverPipelinePhase, detail: string): string {
  switch (phase) {
    case "SCRIPT_GENERATION":
      return `Gemini voiceover script generation failed: ${detail}`;
    case "TTS_GENERATION":
      return `Gemini TTS audio generation failed: ${detail}`;
    case "VOICEOVER_FIT":
      return `Voiceover could not be fitted to the video length: ${detail}`;
    case "AUDIO_DECODE":
      return `Gemini TTS audio decoding failed: ${detail}`;
    case "FFMPEG_MUX":
      return `Voiceover FFmpeg mux failed: ${detail}`;
    case "UPLOAD":
      return `Voiceover video upload failed: ${detail}`;
    case "DOWNLOAD_VIDEO":
      return `Voiceover video download failed: ${detail}`;
    default:
      return detail;
  }
}

function wrapPhase(
  phase: VoiceoverPipelinePhase,
  err: unknown
): VoiceoverPipelineError {
  if (err instanceof VoiceoverPipelineError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  return new VoiceoverPipelineError(phase, phaseMessage(phase, detail), err);
}

/**
 * If the brief requests a Gemini TTS language, generate VO + remux the commercial.
 * English / Seedance-native languages leave the commercial unchanged.
 */
export async function attachGeminiVoiceoverIfNeeded(
  brief: CampaignBrief,
  final: FinalCommercial,
  options: { log?: (event: string, payload: Record<string, unknown>) => void } = {}
): Promise<AttachGeminiVoiceoverResult | null> {
  const language = normalizeVoiceoverLanguage(brief.voiceover?.language);
  if (!usesGeminiTts(language)) return null;
  if (brief.voiceover?.enabled === false) return null;

  const log = options.log ?? ((event, payload) => console.log(`[gemini-vo] ${event}`, payload));

  log("tts.start", {
    campaignId: brief.campaignId,
    language,
    duration: final.duration,
  });

  const scriptInput = {
    language,
    durationSeconds: final.duration,
    brandName: brief.brand.name,
    productName: brief.product.name,
    keyMessage: brief.voiceover?.keyMessage || brief.campaignMessage,
    cta: brief.voiceover?.cta || brief.offer,
    ctaEnabled: brief.voiceover?.ctaEnabled !== false,
    tone: brief.voiceover?.tone,
    campaignMessage: brief.campaignMessage,
    userConcept: brief.userConcept,
    targetAudience: brief.targetAudience,
    existingScript: brief.voiceover?.script,
    spokenLanguageStyle: brief.voiceover?.spokenLanguageStyle,
    adContext: voiceoverAdContext(brief),
  };

  let script: string;
  try {
    script = await resolveVoiceoverScriptForTts(scriptInput);
  } catch (err) {
    throw wrapPhase("SCRIPT_GENERATION", err);
  }

  const synthesize = async (text: string) => {
    let result: Awaited<ReturnType<typeof generateGeminiTtsVoiceover>>;
    try {
      result = await generateGeminiTtsVoiceover({
        script: text,
        language,
        tone: brief.voiceover?.tone,
        ctaEnabled: brief.voiceover?.ctaEnabled !== false,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Empty / missing audio is a decode problem after a successful-looking response.
      if (/no audio|empty audio|decode|base64/i.test(detail)) {
        throw wrapPhase("AUDIO_DECODE", err);
      }
      throw wrapPhase("TTS_GENERATION", err);
    }
    if (!result.audioBuffer?.length) {
      throw new VoiceoverPipelineError(
        "AUDIO_DECODE",
        phaseMessage("AUDIO_DECODE", "TTS returned an empty audio buffer")
      );
    }
    const probe = await probeMediaBuffer(result.audioBuffer, "wav");
    if (!probe.durationSeconds) {
      throw new VoiceoverPipelineError(
        "AUDIO_DECODE",
        phaseMessage("AUDIO_DECODE", "could not read TTS audio duration")
      );
    }
    return { tts: result, speechSeconds: probe.durationSeconds };
  };

  // Measure the spoken length and make it fit: rewrite shorter when far over,
  // speed up slightly when close. The voiceover is never cut mid-word.
  let { tts, speechSeconds } = await synthesize(script);
  let tempo = 1;
  for (let rewrite = 0; ; rewrite++) {
    const plan = planVoiceoverFit({
      speechSeconds,
      videoSeconds: final.duration,
      allowRewrite: rewrite < MAX_VOICEOVER_REWRITES,
    });
    log("tts.fit", {
      campaignId: brief.campaignId,
      speechSeconds: Number(speechSeconds.toFixed(2)),
      windowSeconds: plan.windowSeconds,
      action: plan.action,
      rewrite,
    });
    if (plan.action === "fits") break;
    if (plan.action === "speed_up") {
      tempo = plan.tempo;
      break;
    }
    try {
      script = await resolveVoiceoverScriptForTts({
        ...scriptInput,
        condense: {
          previousScript: script,
          lengthRatio: plan.lengthRatio,
          maxSpeechSeconds: plan.windowSeconds,
        },
      });
    } catch (err) {
      throw wrapPhase("SCRIPT_GENERATION", err);
    }
    ({ tts, speechSeconds } = await synthesize(script));
  }
  if (tempo > MAX_FORCED_TEMPO) {
    throw new VoiceoverPipelineError(
      "VOICEOVER_FIT",
      phaseMessage(
        "VOICEOVER_FIT",
        `speech is ${speechSeconds.toFixed(1)}s for a ${final.duration}s video even after shortening`
      )
    );
  }

  let videoBuffer: Buffer;
  try {
    videoBuffer = await downloadVideoToBuffer(final.videoUrl);
  } catch (err) {
    throw wrapPhase("DOWNLOAD_VIDEO", err);
  }

  let muxed: Buffer;
  try {
    muxed = await muxVoiceoverOntoVideo({
      videoBuffer,
      audioBuffer: tts.audioBuffer,
      audioExtension: "wav",
      voiceoverTempo: tempo,
    });
  } catch (err) {
    throw wrapPhase("FFMPEG_MUX", err);
  }

  let videoUrl: string;
  try {
    videoUrl = await uploadVideoBuffer(muxed);
  } catch (err) {
    throw wrapPhase("UPLOAD", err);
  }

  const updated: FinalCommercial = {
    ...final,
    videoUrl,
    audioTracks: [
      ...(final.audioTracks || []),
      {
        type: "voiceover",
        assetId: `gemini-tts-${language}`,
        startTime: 0,
        duration: final.duration,
      },
    ],
  };

  log("tts.complete", {
    campaignId: brief.campaignId,
    language,
    voice: tts.voice,
    model: tts.model,
    scriptChars: script.length,
    speechSeconds: Number(speechSeconds.toFixed(2)),
    tempo,
    muxedBytes: muxed.length,
  });

  return {
    final: updated,
    script,
    language,
    voice: tts.voice,
    model: tts.model,
  };
}
