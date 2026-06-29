// pages/api/creative-studio/preview-video-prompts.ts
// Returns 2–3 Film Engine prompt variants (different cinematic styles) without calling Veo.
import type { NextApiRequest, NextApiResponse } from "next";
import type { BrandPromptContext } from "@/lib/creative-studio/brand-context";
import { brandContextFromBody } from "@/lib/creative-studio/brand-context";
import { previewPromptVariants } from "@/lib/creative-studio/resolve-veo-prompt";
import { type FilmEngineInput } from "@/lib/creative-studio/film-engine";
import { referenceSlotsFromRequest } from "@/lib/creative-studio/reference-labels";
import { buildLabeledReferenceBlock } from "@/lib/creative-studio/reference-labels";
import { buildBrandContextBlock } from "@/lib/creative-studio/brand-context";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body as Record<string, unknown>;
    const {
      product_name,
      brand_name,
      category,
      user_description,
      creative_format,
      style,
      hook_type,
      campaign_goal,
      creative_strategy,
      duration,
      aspect_ratio,
      voiceover_script,
      storyboard,
      key_message,
      cta,
      variant_count,
      hero_image,
      brand_logo,
      product_images,
    } = body;

    const totalDuration = Math.max(4, parseInt(String(duration)) || 8);
    const clipDuration = totalDuration > 8 ? 8 : totalDuration;
    const aspectRatio = typeof aspect_ratio === "string" ? aspect_ratio : "9:16";

    const brandContext = brandContextFromBody(body);
    const refSlots = referenceSlotsFromRequest({
      hero_image: hero_image as string | undefined,
      brand_logo: brand_logo as string | undefined,
      product_images: product_images as string[] | undefined,
      product_name: product_name as string | undefined,
      brand_name: brand_name as string | undefined,
    });
    const hasRefs = Boolean(refSlots.hasHero || refSlots.hasBrandLogo || (refSlots.productImageCount ?? 0) > 0);

    const filmInput: FilmEngineInput = {
      brandName: brand_name as string | undefined,
      productName: product_name as string | undefined,
      category: category as string | undefined,
      userDescription: user_description as string | undefined,
      creativeFormat: (creative_format || style) as string | undefined,
      style: (creative_format || style) as string | undefined,
      hookType: hook_type as string | undefined,
      campaignGoal: campaign_goal as string | undefined,
      creativeStrategy: creative_strategy as FilmEngineInput["creativeStrategy"],
      cta: cta as string | undefined,
      keyMessage: key_message as string | undefined,
      totalDurationSeconds: totalDuration,
      clipDurationSeconds: clipDuration,
      aspectRatio,
      voiceoverScript: voiceover_script as string | undefined,
      storyboard: Array.isArray(storyboard) ? storyboard : undefined,
      hasReferenceImages: hasRefs,
      brandContext,
      filmStyleId: body.film_style_id as string | undefined,
    };

    const count = Math.min(3, Math.max(2, parseInt(String(variant_count)) || 2));
    const variants = previewPromptVariants(filmInput, count).map((v) => {
      const brandBlock = buildBrandContextBlock(brandContext, brand_name as string | undefined);
      const refBlock = hasRefs ? buildLabeledReferenceBlock(refSlots) : "";
      const prompt = [brandBlock, refBlock, v.prompt].filter(Boolean).join("\n");
      return { ...v, prompt };
    });

    return res.status(200).json({
      ok: true,
      variants: variants.map((v) => ({
        filmStyleId: v.filmStyleId,
        label: v.label,
        summary: v.summary,
        promptPreview: v.prompt.slice(0, 320) + (v.prompt.length > 320 ? "…" : ""),
        estimatedTokens: v.estimatedTokens,
        segmentCount: v.segmentPrompts?.length ?? 1,
      })),
      brandContext: brandContext as BrandPromptContext | undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to preview prompts";
    console.error("preview-video-prompts error:", error);
    return res.status(500).json({ ok: false, error: message });
  }
}
