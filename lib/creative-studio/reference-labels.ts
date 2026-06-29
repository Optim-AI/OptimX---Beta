/**
 * Labeled reference images for Veo (InVideo guide: attach images with clear roles).
 */

import { VEO_STRICT_NO_TEXT_BLOCK } from "./veo-output-rules";

export interface ReferenceImageSlots {
  hasHero?: boolean;
  hasBrandLogo?: boolean;
  productImageCount?: number;
  /** Segment 2: last frame of clip 1 for stitch continuity. */
  hasContinuityFrame?: boolean;
  productName?: string;
  brandName?: string;
}

/**
 * Human-readable slot map so Veo knows which attachment is which.
 * Order must match how referenceImages are attached in generate-video*.ts:
 *   1 hero → 2 logo → 3+ product → (optional) continuity frame last on segment 2.
 */
export function buildLabeledReferenceBlock(slots: ReferenceImageSlots): string {
  const {
    hasHero,
    hasBrandLogo,
    productImageCount = 0,
    hasContinuityFrame,
    productName,
    brandName,
  } = slots;

  const any =
    hasHero || hasBrandLogo || productImageCount > 0 || hasContinuityFrame;
  if (!any) return "";

  const product = productName || "the product";
  const brand = brandName || "the brand";
  const lines: string[] = [
    "REFERENCE IMAGES (match each attachment to its role — pixel fidelity required):",
  ];

  let slot = 1;
  if (hasHero) {
    lines.push(
      `Image ${slot} = HERO PRODUCT (${product}): exact packaging, label, color, shape, proportions. Do not redesign.`
    );
    slot++;
  }
  if (hasBrandLogo) {
    lines.push(
      `Image ${slot} = BRAND LOGO REFERENCE (${brand}): use ONLY as identity guide for the physical pack — do NOT render as floating on-screen typography.`
    );
    slot++;
  }
  for (let i = 0; i < productImageCount; i++) {
    lines.push(
      `Image ${slot} = PRODUCT REFERENCE ${i + 1} (${product}): same SKU as hero — label and pack must match.`
    );
    slot++;
  }
  if (hasContinuityFrame) {
    lines.push(
      `Image ${slot} = CONTINUITY FRAME (clip 1 ending): SAME person, wardrobe, lighting, location, and product state. ` +
        `Start clip 2 from this exact visual — match-cut or motivated angle only; no new limbs, no scene reset, no morphing.`
    );
  }

  lines.push(
    `${product} must be photorealistic and identical to references in every shot where it appears.`
  );
  lines.push(VEO_STRICT_NO_TEXT_BLOCK);

  return lines.join(" ");
}

/** Infer slot flags from API image fields. */
export function referenceSlotsFromRequest(body: {
  hero_image?: string;
  brand_logo?: string;
  product_images?: string[];
  segment_has_continuity_frame?: boolean;
  product_name?: string;
  brand_name?: string;
}): ReferenceImageSlots {
  const hero = Boolean(body.hero_image);
  const logo = Boolean(body.brand_logo);
  const products = Array.isArray(body.product_images)
    ? body.product_images.filter(
        (img) => img && img !== body.hero_image && img !== body.brand_logo
      ).length
    : 0;

  return {
    hasHero: hero,
    hasBrandLogo: logo,
    productImageCount: products,
    hasContinuityFrame: body.segment_has_continuity_frame === true,
    productName: body.product_name,
    brandName: body.brand_name,
  };
}
