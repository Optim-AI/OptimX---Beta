/**
 * Step A of a fix: correct ONE still — the first frame of the part being redone.
 *
 * Editing a still keeps the person, clothes, room and light exactly; a video model
 * asked to "redo the scene" would invent new ones. A clear picture of the real product
 * goes along so the label is copied, not re-imagined.
 */

import sharp from "sharp";
import { generateGeminiImage, getPosterImageModel } from "@/lib/creative-studio/nano-banana";

export type FrameFixer = (input: {
  frame: Buffer;
  instruction: string;
  /** Clear views of the real product (e.g. the ad's product close-up). */
  productReferences: Buffer[];
  aspectRatio: string;
}) => Promise<Buffer>;

const toDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

/** Live fixer: Gemini image editing (Nano Banana, the poster model). Output matches the input size. */
export const fixFrameWithGemini: FrameFixer = async ({ frame, instruction, productReferences, aspectRatio }) => {
  const meta = await sharp(frame).metadata();
  const result = await generateGeminiImage({
    model: getPosterImageModel(),
    aspectRatio,
    operationLabel: "video-fix-frame",
    prompt: `Edit the first image (a frame from a video ad). ${instruction}

Change ONLY that. Keep everything else pixel-identical: the same person, face, expression, hair, clothes, hands, room, furniture, lighting, colours, camera angle and framing. Do not add any object that is not already in the first image unless the instruction asks for it. Do not add any text, captions, logos or watermarks. If the product is in the first image, it must look exactly like the product in the reference picture — same shape, colours and label text, spelled exactly.`,
    references: [
      { dataUrlOrHttp: toDataUrl(frame), instruction: "This is the video frame to edit." },
      ...productReferences.slice(0, 2).map((ref) => ({
        dataUrlOrHttp: toDataUrl(ref),
        instruction:
          "Reference only — do not place this picture or anything from it into the edit. Use it to copy the product's label, colours and shape exactly if the product appears in the first image.",
      })),
    ],
  });
  // Same size as the video, so the animated clip lines up with the original.
  return sharp(result.buffer)
    .resize(meta.width, meta.height, { fit: "cover" })
    .png()
    .toBuffer();
};
