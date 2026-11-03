/**
 * Apply the brand end card to a finished commercial and re-store it.
 * Non-fatal by design: the caller keeps the original video if this throws.
 */

import { uploadVideoBuffer } from "@/lib/creative-studio/video-delivery";
import type { CampaignBrief } from "../campaign/types";
import type { FinalCommercial, StoredEndCard } from "../campaign-executor/types";
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

/** Draw a stored end card onto a video and store the result. Returns the new URL. */
export async function applyStoredEndCard(videoBuffer: Buffer, card: StoredEndCard): Promise<{
  videoUrl: string;
  drawn: string[];
  skipped: string[];
  bytes: number;
}> {
  let logo: Buffer | undefined;
  if (card.logoUrl) {
    const inline = await loadImageInline({ url: card.logoUrl } as Parameters<typeof loadImageInline>[0]).catch(
      () => null
    );
    if (inline) logo = Buffer.from(inline.data, "base64");
  }
  const { video, drawn, skipped } = await applyEndCard({ videoBuffer, content: { ...card.content, logo } });
  return { videoUrl: await uploadVideoBuffer(video), drawn, skipped, bytes: video.length };
}

export async function attachEndCardIfNeeded(
  brief: CampaignBrief,
  final: FinalCommercial,
  options: { log?: (event: string, payload: Record<string, unknown>) => void } = {}
): Promise<FinalCommercial | null> {
  const content = endCardContentFromBrief(brief);
  if (!content) return null;
  const log = options.log ?? ((event, payload) => console.log(`[end-card] ${event}`, payload));

  const card: StoredEndCard = { content, logoUrl: brief.brand.logo?.url || undefined };
  const videoBuffer = await downloadVideoToBuffer(final.videoUrl);
  const { videoUrl, drawn, skipped, bytes } = await applyStoredEndCard(videoBuffer, card);
  log("end_card.applied", { campaignId: brief.campaignId, drawn, skipped, bytes });
  return {
    ...final,
    videoUrl,
    masterVideoUrl: final.videoUrl,
    finishing: { ...final.finishing, endCard: card },
  };
}
