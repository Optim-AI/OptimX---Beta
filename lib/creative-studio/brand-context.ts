/**
 * Brand context for video prompts — palette, voice, website (InVideo guide: brand + URL).
 */

export interface BrandPromptContext {
  primaryColors?: string[];
  websiteUrl?: string;
  brandVoice?: string;
  tone?: string;
  tagline?: string;
  visualStyleGuide?: {
    color_palette?: string;
    lighting_mood?: string;
    typography?: string;
    motion_style?: string;
    brand_polish?: string;
  };
}

/** Normalize brand snapshot / API body into prompt context. */
export function brandContextFromBody(body: Record<string, unknown>): BrandPromptContext | undefined {
  const raw = body.brand_context as BrandPromptContext | undefined;
  if (raw && (raw.primaryColors?.length || raw.websiteUrl || raw.visualStyleGuide)) {
    return raw;
  }

  const colors = body.brand_colors as string[] | undefined;
  const website = (body.brand_website || body.website_url) as string | undefined;
  const voice = body.brand_voice as string | undefined;
  const tone = body.brand_tone as string | undefined;
  const tagline = body.brand_tagline as string | undefined;
  const vsg = body.visual_style_guide as BrandPromptContext["visualStyleGuide"];

  if (!colors?.length && !website && !voice && !vsg) return undefined;

  return {
    primaryColors: colors,
    websiteUrl: website,
    brandVoice: voice,
    tone: typeof tone === "string" ? tone : undefined,
    tagline,
    visualStyleGuide: vsg,
  };
}

/** Compact brand block for Veo prompts (front-loaded after ad copy). */
export function buildBrandContextBlock(
  ctx?: BrandPromptContext,
  brandName?: string,
  opts?: { videoGeneration?: boolean }
): string {
  if (!ctx) return "";
  const forVideo = opts?.videoGeneration === true;

  const parts: string[] = [];
  if (brandName?.trim()) parts.push(`Brand: ${brandName.trim()}.`);
  if (ctx.websiteUrl?.trim()) parts.push(`Brand site: ${ctx.websiteUrl.trim()}.`);
  if (ctx.tagline?.trim()) {
    parts.push(
      forVideo
        ? `Brand tagline (voiceover only — never on-screen text): ${ctx.tagline.trim()}.`
        : `Tagline: "${ctx.tagline.trim()}".`
    );
  }
  if (ctx.brandVoice?.trim()) parts.push(`Brand voice: ${ctx.brandVoice.trim()}.`);
  if (ctx.tone?.trim()) parts.push(`Tone: ${ctx.tone.trim()}.`);

  if (ctx.primaryColors?.length) {
    parts.push(
      `Brand colors (mandatory palette): ${ctx.primaryColors.slice(0, 5).join(", ")}. ` +
        `Use these as dominant accents in props, backgrounds, and grade — do not invent off-brand colors.`
    );
  }

  const v = ctx.visualStyleGuide;
  if (v) {
    const styleBits = [
      v.color_palette ? `palette: ${v.color_palette}` : "",
      v.lighting_mood ? `lighting: ${v.lighting_mood}` : "",
      v.motion_style ? `motion: ${v.motion_style}` : "",
      v.brand_polish ? `polish: ${v.brand_polish}` : "",
      !forVideo && v.typography ? `typography: ${v.typography}` : "",
    ].filter(Boolean);
    if (styleBits.length) parts.push(`Visual style: ${styleBits.join("; ")}.`);
  }

  if (forVideo) {
    parts.push("ZERO on-screen text — brand identity via product pack and voiceover only.");
  }

  return parts.join(" ");
}
