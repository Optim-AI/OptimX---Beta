/**
 * Text-free scene brief: the image model paints only the photograph — no
 * words, no logo, no product. Type and the real product are added in code,
 * so the brief reserves calm areas for text and an empty stage for the product.
 */

import { GEMINI_IMAGE_ALLOWED_ASPECTS } from "@/lib/creative-studio/nano-banana";
import type { GenerationSpecification } from "../poster-generation/types";
import type { Box, PosterTemplate, TemplateLayout } from "./types";
import { CANVAS_SIZES } from "./render";

/** Gemini aspect closest to the scene box's pixel shape. */
export function sceneAspect(spec: GenerationSpecification, layout: TemplateLayout): string {
  const canvas = CANVAS_SIZES[spec.aspectRatio];
  const box = layout.sceneBox ?? { x: 0, y: 0, w: 1, h: 1 };
  const ratio = (box.w * canvas.width) / (box.h * canvas.height);
  let best: string = GEMINI_IMAGE_ALLOWED_ASPECTS[0];
  let bestDiff = Infinity;
  for (const a of GEMINI_IMAGE_ALLOWED_ASPECTS) {
    const [w, h] = a.split(":").map(Number);
    const diff = Math.abs(Math.log(w / h / ratio));
    if (diff < bestDiff) {
      best = a;
      bestDiff = diff;
    }
  }
  return best;
}

/** Re-express a canvas box relative to the scene box (what the model sees). */
function inScene(b: Box, layout: TemplateLayout): Box {
  const s = layout.sceneBox ?? { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.max(0, (b.x - s.x) / s.w);
  const y = Math.max(0, (b.y - s.y) / s.h);
  return { x, y, w: Math.min(1 - x, b.w / s.w), h: Math.min(1 - y, b.h / s.h) };
}

/** "the top 36% of the frame", "the left half of the frame", … */
export function describeRegion(b: Box): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (b.w >= 0.9) {
    if (b.y <= 0.05) return `the top ${pct(b.h)} of the frame`;
    if (b.y + b.h >= 0.95) return `the bottom ${pct(b.h)} of the frame`;
    return `a horizontal band from ${pct(b.y)} to ${pct(b.y + b.h)} down the frame`;
  }
  if (b.h >= 0.9) {
    if (b.x <= 0.05) return `the left ${pct(b.w)} of the frame`;
    if (b.x + b.w >= 0.95) return `the right ${pct(b.w)} of the frame`;
  }
  const horiz = b.x + b.w / 2 < 0.4 ? "left" : b.x + b.w / 2 > 0.6 ? "right" : "centre";
  const vert = b.y + b.h / 2 < 0.4 ? "upper" : b.y + b.h / 2 > 0.6 ? "lower" : "middle";
  return `the ${vert} ${horiz} area (about ${pct(b.w)} wide, ${pct(b.h)} tall)`;
}

export function compileSceneBrief(spec: GenerationSpecification, template: PosterTemplate, layout: TemplateLayout): string {
  const ad = spec.artDirection;
  const c = ad?.concept;
  const kitColors = ad?.brandKit?.colors?.map((k) => `${k.hex} (${k.role})`) ?? [];
  const colors = kitColors.length ? kitColors : (ad?.brandColors ?? []);
  const lines: string[] = [];

  lines.push(
    `Photograph a background scene for a ${ad?.productName ? `${ad.productName} ` : ""}advertisement. ` +
      `This is ONLY the backdrop: the product, all text and the logo are added later by a designer.`
  );
  if (c) {
    if (c.visualStory) lines.push(`The idea the scene should carry: ${c.visualStory}`);
    if (c.environment) lines.push(`Setting: ${c.environment}.`);
    // Props make the scene tell the concept (a served bowl, ingredients); the product itself is composited.
    const props = [c.subject, c.supportingElements].filter(Boolean).join(". ");
    if (props) {
      lines.push(
        `Props and story elements, placed beside or behind the empty stage (never on it): ${props}. ` +
          `Show them without any packaging — the actual product is added later.`
      );
    }
    if (c.lighting || ad?.theme.lighting) lines.push(`Lighting: ${c.lighting || ad?.theme.lighting}.`);
    if (c.mood || ad?.theme.mood) lines.push(`Mood: ${c.mood || ad?.theme.mood}.`);
    if (c.photographyStyle) lines.push(`Style: ${c.photographyStyle}.`);
  }
  if (colors.length) lines.push(`Colour palette: build the scene around ${colors.slice(0, 4).join(", ")}.`);

  if (layout.product) {
    const stage = inScene(layout.product.box, layout);
    lines.push(
      `Leave an empty stage in ${describeRegion(stage)}: ` +
        (layout.product.anchor === "bottom"
          ? `a clear surface (table top, plinth, ground) whose front edge sits near ${Math.round((stage.y + stage.h) * 100)}% down the frame, at eye level, ready for a product to stand on. `
          : `a clean, uncluttered area ready for a product to float in front of. `) +
        `Nothing may stand, lie or float in that area — no product, no container, no props.`
    );
  }
  for (const calm of layout.calmAreas) {
    lines.push(`Keep ${describeRegion(inScene(calm, layout))} calm and simple (soft wall, sky, smooth gradient or gentle bokeh) — text will sit there.`);
  }
  if (template.background === "split") {
    lines.push("This photo fills only part of the poster, so keep the composition simple and centred on the stage.");
  }

  lines.push(
    "Absolutely NO text, letters, numbers, words, signage, labels, watermarks or logos anywhere in the image. " +
      "No product, packaging, bottle, box or branded item of any kind. No people. " +
      "No graphics, icons, stars, badges, shapes or overlays — only a real photograph. " +
      "Photorealistic, high detail, natural depth of field, professional commercial photography."
  );
  const avoid = ad?.theme.avoid?.filter(Boolean) ?? [];
  if (avoid.length) lines.push(`Avoid: ${avoid.slice(0, 6).join("; ")}.`);
  return lines.join("\n");
}
