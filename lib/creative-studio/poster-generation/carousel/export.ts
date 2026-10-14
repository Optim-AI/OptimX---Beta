/**
 * Ordered carousel export: PNG per successful slide + manifest.json.
 * Ownership is enforced by the caller (service loads the campaign by userId).
 */

import { loadImageBuffer } from "../qc/deterministic-checks";
import type { PosterGeneratedAsset } from "../types";
import type { CarouselCampaignWithSlides, CarouselSlide } from "./types";
import { CAROUSEL_SUCCESS_STATUSES } from "./types";
import { createZip, type ZipEntry } from "./zip";

export type SlideImageLoader = (asset: PosterGeneratedAsset) => Promise<Buffer | null>;

const BUCKET = "campaign-assets";

/** Storage path first (service-role read), then data/http URL fallback. */
export const defaultSlideImageLoader: SlideImageLoader = async (asset) => {
  if (asset.storagePath) {
    try {
      const { supabaseAdmin } = await import("@/auth/supabase/admin");
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(asset.storagePath);
      if (!error && data) return Buffer.from(await data.arrayBuffer());
    } catch (e) {
      console.warn("[carouselExport] storage download failed", { generationId: asset.generationId, e });
    }
  }
  return asset.imageUrl ? loadImageBuffer(asset.imageUrl) : null;
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

export async function ensurePng(buf: Buffer): Promise<Buffer> {
  if (buf.subarray(0, 4).equals(PNG_MAGIC)) return buf;
  const sharp = (await import("sharp")).default;
  return sharp(buf).png().toBuffer();
}

export function slideFileName(slide: Pick<CarouselSlide, "index" | "role">): string {
  const role = slide.role.replace(/[^a-z0-9_]+/g, "").replace(/_/g, "-") || "slide";
  return `${String(slide.index + 1).padStart(2, "0")}-${role}.png`;
}

export function isExportableSlide(slide: CarouselSlide): boolean {
  return (
    CAROUSEL_SUCCESS_STATUSES.includes(slide.status) &&
    !!slide.asset &&
    slide.asset.status === "generated" &&
    slide.asset.creditsConsumed > 0
  );
}

export type CarouselManifest = {
  campaignId: string;
  sessionId: string;
  campaignUpdatedAt: string;
  slideCount: number;
  aspectRatio: string;
  complete: boolean;
  partial: boolean;
  includedCount: number;
  missingSlideNumbers: number[];
  slides: Array<{
    slideNumber: number;
    slideId: string;
    role: string;
    roleLabel: string;
    headline: string;
    included: boolean;
    fileName: string | null;
    generationId: string | null;
    versionNumber: number;
    status: string;
    qcStatus: "passed" | "needs_review" | "pending" | "not_generated";
    missingReason: string | null;
  }>;
};

function qcStatusFor(slide: CarouselSlide): CarouselManifest["slides"][number]["qcStatus"] {
  if (!isExportableSlide(slide)) return "not_generated";
  if (slide.status === "qc_pending") return "pending";
  return slide.qc?.passed ? "passed" : "needs_review";
}

function missingReasonFor(slide: CarouselSlide): string | null {
  if (isExportableSlide(slide)) return null;
  switch (slide.status) {
    case "failed":
      return "generation failed";
    case "unbilled":
      return "awaiting credits";
    case "generating":
      return "still generating";
    default:
      return "not generated yet";
  }
}

export async function buildCarouselExport(
  data: CarouselCampaignWithSlides,
  loadImage: SlideImageLoader = defaultSlideImageLoader
): Promise<{ zip: Buffer; manifest: CarouselManifest; fileName: string; includedSlideIds: string[]; missingSlideIds: string[] }> {
  const { campaign } = data;
  const slides = [...data.slides].sort((a, b) => a.index - b.index);
  const entries: ZipEntry[] = [];
  const rows: CarouselManifest["slides"] = [];

  for (const slide of slides) {
    let included = false;
    let reason = missingReasonFor(slide);
    if (isExportableSlide(slide)) {
      const buf = await loadImage(slide.asset!);
      if (buf) {
        entries.push({ name: slideFileName(slide), data: await ensurePng(buf) });
        included = true;
      } else {
        reason = "image unavailable";
      }
    }
    rows.push({
      slideNumber: slide.index + 1,
      slideId: slide.slideId,
      role: slide.role,
      roleLabel: slide.roleLabel,
      headline: slide.copy.headline,
      included,
      fileName: included ? slideFileName(slide) : null,
      generationId: included ? slide.generationId : null,
      versionNumber: slide.versionNumber,
      status: slide.status,
      qcStatus: included ? qcStatusFor(slide) : "not_generated",
      missingReason: included ? null : reason,
    });
  }

  const includedCount = rows.filter((r) => r.included).length;
  const complete = includedCount === campaign.slideCount;
  const manifest: CarouselManifest = {
    campaignId: campaign.id,
    sessionId: campaign.sessionId,
    campaignUpdatedAt: campaign.updatedAt,
    slideCount: campaign.slideCount,
    aspectRatio: campaign.aspectRatio,
    complete,
    partial: !complete,
    includedCount,
    missingSlideNumbers: rows.filter((r) => !r.included).map((r) => r.slideNumber),
    slides: rows,
  };

  const zip = createZip([
    ...entries,
    { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") },
  ]);
  const shortId = campaign.id.replace(/-/g, "").slice(0, 8);
  const fileName = complete
    ? `carousel-${shortId}.zip`
    : `carousel-${shortId}-partial-${includedCount}-of-${campaign.slideCount}.zip`;

  return {
    zip,
    manifest,
    fileName,
    includedSlideIds: rows.filter((r) => r.included).map((r) => r.slideId),
    missingSlideIds: rows.filter((r) => !r.included).map((r) => r.slideId),
  };
}
