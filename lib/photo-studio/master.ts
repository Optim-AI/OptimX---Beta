/**
 * The master packshot. An uploaded photo is rarely studio-clean: a hand holding the
 * product, a cluttered room, phone lighting. Before any shot, the image model
 * recreates the product ALONE as a clean studio packshot on white (same shape,
 * label, logo, printed text and colours), checked for fidelity against the upload.
 * Its cut-out (clean edge on white) is what every composite uses, and AI-rendered
 * shots use the packshot as their product reference — so a hand in the upload never
 * reaches a shot.
 *
 * If the recreation drifts, the upload's own cut-out is used instead — unless the
 * product is held or overlapped, in which case there is no usable cut-out and shots
 * are AI-rendered from the upload.
 */

import sharp from "sharp";
import type { GenerationSpecification, ImageGenerationProvider } from "@/lib/creative-studio/poster-generation/types";
import type { FidelityChecker } from "./render";
import type { ProductProfile } from "./types";

/** The master is the base of every shot, so it must match more closely than a single shot. */
export const MIN_MASTER_FIDELITY = 8;

export type MasterResult = {
  /** Clean packshot on white (null when the recreation didn't hold up) */
  packshot: Buffer | null;
  /** Background-removed product to composite (null = no usable cut-out) */
  cutout: Buffer | null;
  fidelity: number | null;
  via: "recreated" | "upload" | "none";
};

function masterPrompt(p: ProductProfile, fix = ""): string {
  return [
    "Recreate the product in the attached PRODUCT photo as a professional e-commerce studio packshot.",
    `The product (${p.productType || p.name}) stands alone, upright, facing the camera straight on, centred, filling about 80% of the frame height, on a pure white (#FFFFFF) seamless background.`,
    "Remove everything that is not the product: hands, fingers, people, props, surfaces and the original background.",
    "Reproduce the product exactly — same shape and proportions, same colours, same label layout, logo and every printed word spelled exactly as in the photo. Do not redesign, simplify or add anything to the packaging.",
    "Soft, even studio light; crisp focus; true colours; no reflections of a room; no shadow other than a faint one under the base. No text, watermark or border.",
    fix,
  ]
    .filter(Boolean)
    .join("\n");
}

async function recreate(
  source: { buffer: Buffer; mimeType: string },
  profile: ProductProfile,
  provider: ImageGenerationProvider,
  ids: { userId: string; sessionId: string },
  fix: string
): Promise<Buffer | null> {
  const generationId = `photo_master_${Date.now()}`;
  const result = await provider.generate({
    specification: { aspectRatio: "1:1", sessionId: ids.sessionId, generationId, variantId: generationId } as unknown as GenerationSpecification,
    prompt: masterPrompt(profile, fix),
    aspectRatio: "1:1",
    referenceImages: [
      {
        role: "product_packshot",
        kind: "product",
        label: "PRODUCT (exact appearance)",
        instruction: "The real product. Reproduce it exactly; leave out anything that isn't the product.",
        mimeType: source.mimeType,
        base64Data: source.buffer.toString("base64"),
      },
    ],
    mode: "generate",
    baseImage: null,
    metadata: { sessionId: ids.sessionId, generationId, variantId: generationId, userId: ids.userId },
  });
  if (!result.ok || !result.imageBuffer) return null;
  return sharp(result.imageBuffer).png().toBuffer();
}

export async function prepareMaster(input: {
  source: { buffer: Buffer; mimeType: string };
  profile: ProductProfile;
  provider: ImageGenerationProvider;
  checkFidelity: FidelityChecker;
  /** Background removal + cleanup; null when it fails */
  cutout: (image: Buffer) => Promise<Buffer | null>;
  userId: string;
  sessionId: string;
}): Promise<MasterResult> {
  const { source, profile, provider, checkFidelity, userId, sessionId } = input;
  let best: { packshot: Buffer; score: number } | null = null;
  let fix = "";
  for (let attempt = 0; attempt < 2 && (!best || best.score < MIN_MASTER_FIDELITY); attempt++) {
    const packshot = await recreate(source, profile, provider, { userId, sessionId }, fix).catch(() => null);
    if (!packshot) continue;
    const f = await checkFidelity(source.buffer, packshot);
    const score = f.checked ? f.score : 0;
    if (!best || score > best.score) best = { packshot, score };
    fix = `PRODUCT FIDELITY FIX — the previous attempt changed the product: ${f.issues.join("; ") || "label and shape differed"}. Match the PRODUCT photo exactly.`;
  }

  if (best && best.score >= MIN_MASTER_FIDELITY) {
    const cut = await input.cutout(best.packshot);
    if (cut) return { packshot: best.packshot, cutout: cut, fidelity: best.score, via: "recreated" };
  }
  // The upload's own cut-out is only usable when nothing else is in the product's outline.
  if (!profile.obstructed) {
    const cut = await input.cutout(source.buffer);
    if (cut) return { packshot: null, cutout: cut, fidelity: null, via: "upload" };
  }
  return { packshot: null, cutout: null, fidelity: best?.score ?? null, via: "none" };
}
