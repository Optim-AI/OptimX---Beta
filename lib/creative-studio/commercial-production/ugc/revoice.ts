/**
 * Re-voice a UGC voice-over video into another language from its stored
 * pre-voice video — no new video generation, so no Video Credits.
 */

import type { CampaignBrief } from "../campaign/types";
import type { FinalCommercial } from "../campaign-executor/types";
import { attachGeminiVoiceoverIfNeeded } from "../audio/attach-gemini-voiceover";
import { attachEndCardIfNeeded } from "../finishing/attach-end-card";
import { normalizeVoiceoverLanguage } from "../audio/voiceover-languages";

/** Only our own storage — never fetch an arbitrary URL from the request. */
export function isOwnStorageUrl(url: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""): boolean {
  try {
    const target = new URL(url);
    const own = new URL(supabaseUrl);
    return target.host === own.host && target.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
}

export async function revoiceUgcVideo(input: {
  brief: CampaignBrief;
  baseVideoUrl: string;
  /** Test seams. */
  voiceAttacher?: typeof attachGeminiVoiceoverIfNeeded;
  endCardAttacher?: typeof attachEndCardIfNeeded;
}): Promise<{ videoUrl: string; script: string; language: string }> {
  const { brief } = input;
  if (!brief.ugc) throw new Error("Only UGC voice-over videos can be re-voiced.");
  // Keep the video's own style in every language: a talking (presenter) video keeps
  // its English hello; a voice-over video stays silent on camera.
  const speech = brief.ugc.delivery === "talk_to_camera" ? "presenter" : "voiceover";
  if (!isOwnStorageUrl(input.baseVideoUrl)) {
    throw new Error("That video address is not allowed.");
  }
  const language = normalizeVoiceoverLanguage(brief.voiceover?.language);
  // A new language must not reuse the old language's script.
  const fresh: CampaignBrief = {
    ...brief,
    voiceover: { ...brief.voiceover, language, script: undefined },
    ugc: { ...brief.ugc, speech },
  };
  const base = {
    campaignId: brief.campaignId,
    duration: brief.campaignDuration,
    aspectRatio: brief.aspectRatio,
    videoUrl: input.baseVideoUrl,
    baseVideoUrl: input.baseVideoUrl,
    audioTracks: [],
  } as unknown as FinalCommercial;

  const voiced = await (input.voiceAttacher ?? attachGeminiVoiceoverIfNeeded)(fresh, base);
  if (!voiced) throw new Error("Voice-over is turned off for this video.");
  let final = voiced.final;
  try {
    const withCard = await (input.endCardAttacher ?? attachEndCardIfNeeded)(fresh, final);
    if (withCard) final = withCard;
  } catch (err) {
    console.warn("[ugc/revoice] end card skipped", err instanceof Error ? err.message : err);
  }
  return { videoUrl: final.videoUrl, script: voiced.script, language };
}
