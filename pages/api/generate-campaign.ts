// pages/api/generate-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const mode = body.mode || "generate"; // "assist" or "generate"

    // === Assist mode: help refine the 'vision' text ===
    if (mode === "assist") {
      const vision = body.vision || body.prompt;
      if (!vision) return res.status(400).json({ ok: false, error: "Missing vision for assist" });

      const chat = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an assistant helping users describe an image clearly and creatively for an image generation service. Improve the user's description while preserving their intent, making it concise and image-generation friendly.",
          },
          { role: "user", content: `Refine this vision for image generation (improve clarity, add visual details, keep it concise):\n\n${vision}` },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const assistText = chat?.choices?.[0]?.message?.content || null;
      return res.status(200).json({ ok: true, assist: assistText });
    }

    // === Generate mode: create image + campaign copy ===
    const {
      name = "",
      audience = "",
      campaignType = "",
      brandVoice = "",
      contentTypes = [],
      vision = "",
    } = body;

    if (!vision) {
      return res.status(400).json({ ok: false, error: "Missing vision for image generation" });
    }

    // Build a clear image prompt using provided inputs (concise but informative)
    const imagePrompt = [
      `Primary vision: ${vision}`,
      name ? `Campaign name: ${name}` : "",
      audience ? `Target audience: ${audience}` : "",
      campaignType ? `Campaign type: ${campaignType}` : "",
      brandVoice ? `Brand voice: ${brandVoice}` : "",
      Array.isArray(contentTypes) && contentTypes.length ? `Content types: ${contentTypes.join(", ")}` : "",
      `Produce one high-quality image that matches the above. Provide photorealistic / stylized visual depending on the vision. Return a single image suitable for social media ad (1024x1024).`,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 1) Generate single image (OpenAI Image API)
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    });

    // imageResult may contain url or b64_json
    let imageUrl: string | null = null;
    const imageData = imageResult?.data?.[0];

    if (!imageData) {
      throw new Error("No image returned from OpenAI.");
    }

    if (imageData.url) {
      imageUrl = imageData.url;
    } else if (imageData.b64_json) {
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("OpenAI returned an unsupported image format.");
    }

    // 2) Generate campaign copy (headline, caption, CTA, hashtags) via Chat model
    const copyPrompt = [
      `You are a marketing copywriter.`,
      `Given the following campaign details, produce a JSON object with keys: headline, caption, cta (short), hashtags (array of strings).`,
      `Return only valid JSON (no extra commentary).`,
      `Campaign details:`,
      `Name: ${name}`,
      `Audience: ${audience}`,
      `CampaignType: ${campaignType}`,
      `BrandVoice: ${brandVoice}`,
      `ContentTypes: ${Array.isArray(contentTypes) ? contentTypes.join(", ") : contentTypes}`,
      `Vision: ${vision}`,
    ].join("\n\n");

    const copyResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs marketing copy as JSON." },
        { role: "user", content: copyPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const assistantText = copyResponse?.choices?.[0]?.message?.content || "";
    // Try to parse JSON out of assistantText
    let parsedCopy: any = assistantText;
    try {
      // If assistant returned code fences or extra text, extract JSON substring
      const jsonStart = assistantText.indexOf("{");
      const jsonEnd = assistantText.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const possible = assistantText.slice(jsonStart, jsonEnd + 1);
        parsedCopy = JSON.parse(possible);
      } else {
        // fallback: return the raw assistant text as caption
        parsedCopy = { caption: assistantText };
      }
    } catch (err) {
      parsedCopy = { caption: assistantText };
    }

    return res.status(200).json({
      ok: true,
      image: imageUrl,
      images: [imageUrl],
      copy: parsedCopy,
    });
  } catch (err: any) {
    console.error("OpenAI generation error:", err);
    const message = err?.response?.data?.error?.message || err.message || "OpenAI generation failed";
    return res.status(500).json({ ok: false, error: message });
  }
}
