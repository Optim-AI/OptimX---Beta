/**
 * Template posters: text-free AI scene (or brand fill) + real product cut-out
 * + code-rendered headline/CTA/badge/logo. See docs/POSTER_TEMPLATES_DESIGN.md.
 */

import { dataUrlToBuffer, fetchUrlToBuffer } from "@/lib/creative-studio/nano-banana";
import type { BrandKit } from "@/lib/brand-kit/types";
import type {
  GenerationSpecification,
  ImageGenerationProvider,
  PosterAspectRatio,
} from "../poster-generation/types";
import { buildImageGenerationRequest } from "../poster-generation/generation/nano-banana-prompt";
import { loadFont, type LoadedFont } from "./fonts";
import { buildPalette } from "./palette";
import { CANVAS_SIZES, renderPoster } from "./render";
import { compileSceneBrief, sceneAspect } from "./scene-brief";
import { harmonizeProduct } from "./harmonize";
import type { CompositionManifest, Palette, PosterTemplate, RenderCopy } from "./types";

export { selectTemplate, POSTER_TEMPLATES } from "./templates";
export type { CompositionManifest, PosterTemplate } from "./types";

/** POSTER_TEMPLATE_HARMONIZE=0 turns the relight/grounding pass off (saves one image call per scene poster). */
export function harmonizeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.POSTER_TEMPLATE_HARMONIZE !== "0" && env.POSTER_TEMPLATE_HARMONIZE !== "false";
}

/** POSTER_TEMPLATES=1 turns the template path on. */
export function posterTemplatesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.POSTER_TEMPLATES === "1" || env.POSTER_TEMPLATES === "true";
}

export type BrandAssets = {
  palette: Palette;
  fonts: { heading: LoadedFont; body: LoadedFont };
  logo: { light: Buffer; dark?: Buffer | null } | null;
};

async function loadImage(src: string): Promise<Buffer> {
  return src.startsWith("data:") ? dataUrlToBuffer(src) : fetchUrlToBuffer(src);
}

/** Palette, fonts and logo for a session — loaded once, shared by all variants. */
export async function loadBrandAssets(
  brandKit: BrandKit | null,
  spec: GenerationSpecification,
  load: (src: string) => Promise<Buffer> = loadImage
): Promise<BrandAssets> {
  const ad = spec.artDirection;
  const [heading, body] = await Promise.all([
    loadFont(brandKit?.fonts.heading?.family ?? ad?.brandFont, 700),
    loadFont(brandKit?.fonts.body?.family ?? brandKit?.fonts.heading?.family ?? null, 500),
  ]);
  const logoUrl = brandKit?.logo?.url ?? spec.references.find((r) => r.kind === "logo")?.url ?? null;
  let logo: BrandAssets["logo"] = null;
  if (logoUrl) {
    try {
      const light = await load(logoUrl);
      const dark = brandKit?.logo?.darkUrl ? await load(brandKit.logo.darkUrl).catch(() => null) : null;
      logo = { light, dark };
    } catch (e) {
      console.warn("[posterTemplates] logo could not be loaded; rendering without it", (e as Error).message);
    }
  }
  return { palette: buildPalette(brandKit?.colors, ad?.brandColors ?? []), fonts: { heading, body }, logo };
}

/** The approved copy, exactly as the strategy / user overrides set it. */
export function copyForTemplate(spec: GenerationSpecification): RenderCopy {
  const rc = spec.renderCopy;
  return {
    headline: rc.headline,
    productLine: rc.productLine || null,
    supporting: rc.supporting || null,
    cta: rc.cta || null,
    badge: rc.badges[0] || null,
  };
}

export type TemplatePosterResult =
  | {
      ok: true;
      imageBuffer: Buffer;
      mimeType: "image/png";
      sceneBuffer: Buffer | null;
      manifest: CompositionManifest;
      provider: string;
      model: string;
      durationMs: number;
      scenePrompt: string | null;
    }
  | { ok: false; errorCode: string; errorMessage: string; durationMs: number; scenePrompt: string | null };

export async function generateTemplatePoster(opts: {
  spec: GenerationSpecification;
  template: PosterTemplate;
  cutout: Buffer;
  brand: BrandAssets;
  provider: ImageGenerationProvider;
  userId: string;
  /** Relight and ground the product in the scene (default: POSTER_TEMPLATE_HARMONIZE) */
  harmonize?: boolean;
}): Promise<TemplatePosterResult> {
  const started = Date.now();
  const { spec, template } = opts;
  const layout = template.layouts[spec.aspectRatio];
  if (!layout) {
    return { ok: false, errorCode: "TEMPLATE_LAYOUT", errorMessage: `No ${spec.aspectRatio} layout`, durationMs: 0, scenePrompt: null };
  }

  let scene: Buffer | null = null;
  let scenePrompt: string | null = null;
  let model = "template";
  let provider = "template";
  if (template.background !== "brand_solid") {
    scenePrompt = compileSceneBrief(spec, template, layout);
    // Only mood references go to the scene: the product and logo are composited later.
    const base = buildImageGenerationRequest({ specification: spec, userId: opts.userId, prompt: scenePrompt });
    const request = {
      ...base,
      aspectRatio: sceneAspect(spec, layout) as PosterAspectRatio,
      referenceImages: base.referenceImages
        .filter((r) => r.kind === "design" || r.kind === "supporting")
        .map((r) => ({ ...r, instruction: `${r.label}. Mood, light and setting inspiration only. Do not copy any product, text or logo from it.` })),
    };
    const result = await opts.provider.generate(request);
    if (!result.ok || !result.imageBuffer) {
      return {
        ok: false,
        errorCode: result.errorCode || "PROVIDER_FAILED",
        errorMessage: result.errorMessage || "Scene generation failed",
        durationMs: Date.now() - started,
        scenePrompt,
      };
    }
    scene = result.imageBuffer;
    provider = result.provider;
    model = result.model;
  }

  try {
    const { png, manifest } = await renderPoster({
      template,
      aspect: spec.aspectRatio,
      palette: opts.brand.palette,
      fonts: opts.brand.fonts,
      copy: copyForTemplate(spec),
      scene,
      cutout: opts.cutout,
      logo: opts.brand.logo,
      // Flat brand fills have no scene light to match; only scene posters are harmonised.
      harmonize:
        scene && (opts.harmonize ?? harmonizeEnabled())
          ? async ({ base, product, preserve }) => {
              const h = await harmonizeProduct({
                base,
                product,
                preserve,
                canvas: CANVAS_SIZES[spec.aspectRatio],
                spec,
                provider: opts.provider,
                userId: opts.userId,
              });
              if (!h.ok) console.info("[posterTemplates] harmonize skipped", { reason: h.reason, similarity: h.similarity });
              return h.ok ? h.buffer : null;
            }
          : undefined,
    });
    return { ok: true, imageBuffer: png, mimeType: "image/png", sceneBuffer: scene, manifest, provider, model, durationMs: Date.now() - started, scenePrompt };
  } catch (e) {
    return { ok: false, errorCode: "TEMPLATE_RENDER", errorMessage: (e as Error).message, durationMs: Date.now() - started, scenePrompt };
  }
}
