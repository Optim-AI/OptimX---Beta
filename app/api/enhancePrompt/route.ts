// app/api/enhancePrompt/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Robust extractor to pull human-readable text from Responses API result.
 * The SDK returns different shapes depending on model/version; this function
 * is deliberately defensive and uses `any` only for parsing stage.
 */
function extractTextFromResponse(response: any): string | null {
  // 1) Common convenience property
  if (response?.output_text && typeof response.output_text === "string") {
    const t = response.output_text.trim();
    if (t.length) return t;
  }

  // 2) If SDK returned a top-level string
  if (typeof response === "string" && response.trim().length) {
    return response.trim();
  }

  // 3) Walk response.output if present (array of items with different shapes)
  const output = response?.output;
  if (Array.isArray(output) && output.length > 0) {
    const parts: string[] = [];

    for (const item of output) {
      if (!item) continue;

      // plain string items
      if (typeof item === "string") {
        parts.push(item.trim());
        continue;
      }

      // item might be { type: "output_text", text: "..." }
      if (item.type === "output_text" && typeof item.text === "string") {
        parts.push(item.text.trim());
        continue;
      }

      // item might be { content: [ { type: "output_text", text: "..." }, ... ] }
      if (item.content) {
        // content can be string or array
        if (typeof item.content === "string") {
          parts.push(item.content.trim());
          continue;
        }
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (!c) continue;
            if (typeof c === "string") {
              parts.push(c.trim());
            } else if (typeof c.text === "string") {
              parts.push(c.text.trim());
            } else if (typeof c.content === "string") {
              parts.push(c.content.trim());
            }
          }
          continue;
        }
      }

      // item might have nested 'message' or 'text' fields
      if (typeof item.text === "string") {
        parts.push(item.text.trim());
        continue;
      }
      if (item.message && typeof item.message === "string") {
        parts.push(item.message.trim());
        continue;
      }
    }

    const joined = parts.filter(Boolean).join("\n").trim();
    if (joined.length) return joined;
  }

  // 4) Fallback to stringified response if nothing else found (avoid leaking huge objects)
  return null;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = body?.prompt;
    const mode = body?.mode;
    const brandContext = body?.brandContext || null; // Optional brand context

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // moderation check (keeps your original moderation model)
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: prompt,
    });

    const flagged = !!mod?.results?.[0]?.flagged;
    if (flagged) {
      return NextResponse.json(
        { error: "Prompt flagged by moderation", details: mod.results?.[0] ?? null },
        { status: 400 }
      );
    }

    // Build brand context section if provided
    let brandContextSection = "";
    if (brandContext) {
      const brandParts: string[] = [];
      if (brandContext.name) brandParts.push(`Brand: ${brandContext.name}`);
      if (brandContext.description) brandParts.push(`Description: ${brandContext.description}`);
      if (brandContext.audience) brandParts.push(`Target audience: ${brandContext.audience}`);
      if (brandContext.personality) brandParts.push(`Brand personality: ${brandContext.personality}`);
      if (brandContext.tone) brandParts.push(`Brand tone: ${brandContext.tone}`);
      if (brandContext.tagline) brandParts.push(`Tagline: ${brandContext.tagline}`);
      if (brandContext.productCategory) brandParts.push(`Product category: ${brandContext.productCategory}`);
      if (brandContext.pricePositioning) brandParts.push(`Price positioning: ${brandContext.pricePositioning}`);
      
      if (brandContext.colors) {
        const colorParts: string[] = [];
        if (brandContext.colors.primary) colorParts.push(`Primary: ${brandContext.colors.primary}`);
        if (brandContext.colors.secondary) colorParts.push(`Secondary: ${brandContext.colors.secondary}`);
        if (brandContext.colors.accent) colorParts.push(`Accent: ${brandContext.colors.accent}`);
        if (colorParts.length > 0) {
          brandParts.push(`Brand colors (MUST USE): ${colorParts.join(", ")}`);
        }
      }
      
      if (brandContext.ctaPatterns && brandContext.ctaPatterns.length > 0) {
        brandParts.push(`Preferred CTAs: ${brandContext.ctaPatterns.join(", ")}`);
      }
      
      if (brandParts.length > 0) {
        brandContextSection = `\n\nBRAND CONTEXT (CRITICAL - MUST FOLLOW):\n${brandParts.join("\n")}\n\nAll design decisions must align with this brand identity. Colors, tone, personality, and messaging must be consistent with these brand guidelines.`;
      }
    }

    // Enhanced system instruction
    const systemInstruction = `You are an expert prompt engineer specializing in marketing poster generation. Transform user inputs into highly detailed, professional poster prompts optimized for AI image generation. Output ONLY the enhanced prompt - no explanations, no meta-commentary, no disclaimers.`;

    // Build the poster design requirements in the same style as creative-studio.tsx
    const posterRequirements = `CRITICAL REQUIREMENTS FOR THE POSTER:

1. VISUAL HIERARCHY & COMPOSITION:
   - Create a clear, strategic visual hierarchy: Primary focal point (product/subject) → Headline → Supporting copy → CTA
   - Use professional composition principles: rule of thirds, golden ratio, or centered balance
   - Ensure balanced white space and margins (avoid edge-to-edge text)
   - Guide the viewer's eye naturally through the design

2. TYPOGRAPHY & TEXT:
   - Headline: Bold, prominent, but balanced. Use appropriate font weight and size. Ensure strong contrast with background
   - Supporting copy: Concise, impactful, readable. Keep it minimal (1-2 lines max)
   - Text placement: Strategic positioning that doesn't compete with the main visual
   - No distorted text, no random decorative shapes, no watermarks

3. COLOR PALETTE & VISUAL STYLE:
   ${brandContext?.colors ? `- STRICTLY use brand colors: ${brandContext.colors.primary || 'primary'}, ${brandContext.colors.secondary || 'secondary'}, ${brandContext.colors.accent || 'accent'}. These colors must dominate the design.` : '- Use a cohesive, professional color palette that enhances the product and message'}
   - Avoid clashing colors. Ensure sufficient contrast for text readability
   - Match the visual style to the brand personality and product category
   - Premium, polished aesthetic - no amateur elements

4. PRODUCT/SUBJECT PLACEMENT:
   - 1 strong focal subject or product in a dominant position (center or strategic placement)
   - Product should be clearly visible, well-lit, and professionally presented
   - If product image is provided, it must be used exactly as-is (no modifications)

5. CALL-TO-ACTION (CTA):
   ${brandContext?.ctaPatterns && brandContext.ctaPatterns.length > 0 ? `- Use preferred CTA: "${brandContext.ctaPatterns[0]}"` : '- Include a clear, prominent CTA'}
   - Make CTA visually distinct but integrated into the design
   - Use button-style treatment if appropriate
   - Ensure CTA is readable and actionable

6. BRAND CONSISTENCY:
   ${brandContext ? `- Maintain strict brand consistency with ${brandContext.name || 'the brand'}` : '- Maintain professional brand consistency'}
   ${brandContext?.personality ? `- Brand personality: ${brandContext.personality}` : ''}
   ${brandContext?.tone ? `- Brand tone: ${brandContext.tone}` : ''}
   - All visual elements, colors, typography, and messaging must align with brand guidelines

7. PROFESSIONAL QUALITY STANDARDS:
   - The output must look like it was created by a top-tier design agency
   - No cluttered layouts, no poor color choices, no random decorative elements
   - Every element should be intentional and polished
   - No "AI style" artifacts, no generic stock photo look
   - Design space for logo placement (but do not generate a logo)

8. ASPECT RATIO & FORMAT:
   - Specify the aspect ratio if known (1:1, 4:5, 9:16, etc.)
   - Ensure the composition works for the specified format
   - Avoid placing essential elements in extreme corners`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: systemInstruction,
      input: `You are a senior brand designer and performance marketer with expertise in creating high-converting marketing posters. Your job is to transform user inputs into complete, visually detailed, professional poster generation prompts.

${posterRequirements}

${brandContextSection ? `${brandContextSection}\n\n` : ''}Now transform this user input into a detailed, professional poster generation prompt that follows all the requirements above:

USER INPUT:
${prompt}

OUTPUT REQUIREMENTS:
- Single, polished, highly descriptive prompt (3-5 sentences)
- Include: subject/product, scene/mood, lighting, colors, typography style, composition, CTA placement
- Be specific about visual details, atmosphere, and professional design elements
- Ensure brand consistency if brand context is provided
- Output ONLY the enhanced prompt - nothing else`,
      max_output_tokens: 2000,
    });

    const caption = extractTextFromResponse(response as any);

    if (!caption) {
      return NextResponse.json({ error: "No caption returned from model" }, { status: 500 });
    }

    // Return only the caption string to avoid serialisation troubles
    return NextResponse.json({ caption: caption.trim() });
  } catch (err: any) {
    console.error("enhancePrompt error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
