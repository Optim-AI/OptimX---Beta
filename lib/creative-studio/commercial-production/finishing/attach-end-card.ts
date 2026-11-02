/**
 * Apply the brand end card to a finished commercial and re-store it.
 * Non-fatal by design: the caller keeps the original video if this throws.
 */

import { uploadVideoBuffer } from "@/lib/creative-studio/video-delivery";
import type { CampaignBrief } from "../campaign/types";
import type { FinalCommercial } from "../campaign-executor/types";
import { downloadVideoToBuffer } from "../audio/mux-voiceover";
import { loadImageInline } from "../product-understanding/analyze-product";
import { applyEndCard, type EndCardContent } from "./end-card";

export function endCardContentFromBrief(brief: CampaignBrief): Omit<EndCardContent, "logo"> | null {
  const card = brief.endCard;
  if (!card?.enabled) return null;
  return {
    brandName: brief.brand.name,
    // Festival ads with no offer still get a greeting line.
    offer:
      card.offer?.trim() ||
      (brief.adType === "festival" && brief.occasion?.trim() ? `Happy ${brief.occasion.trim()}!` : undefined),
    cta:
      card.cta?.trim() ||
      (brief.voiceover?.ctaEnabled !== false ? brief.voiceover?.cta?.trim() : undefined) ||
      undefined,
    contact: card.contact?.trim() || undefined,
    accentColor: brief.brand.primaryColors?.[0],
  };
}

export async function attachEndCardIfNeeded(
  brief: CampaignBrief,
  final: FinalCommercial,
  options: { log?: (event: string, payload: Record<string, unknown>) => void } = {}
): Promise<FinalCommercial | null> {
  const content = endCardContentFromBrief(brief);
  if (!content) return null;
  const log = options.log ?? ((event, payload) => console.log(`[end-card] ${event}`, payload));

  let logo: Buffer | undefined;
  if (brief.brand.logo) {
    const inline = await loadImageInline(brief.brand.logo).catch(() => null);
    if (inline) logo = Buffer.from(inline.data, "base64");
  }

  const videoBuffer = await downloadVideoToBuffer(final.videoUrl);
  const { video, drawn, skipped } = await applyEndCard({ videoBuffer, content: { ...content, logo } });
  const videoUrl = await uploadVideoBuffer(video);
  log("end_card.applied", { campaignId: brief.campaignId, drawn, skipped, bytes: video.length });
  return { ...final, videoUrl };
}
