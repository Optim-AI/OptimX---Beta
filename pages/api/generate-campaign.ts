// pages/api/generate-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData =
  | { ok: true; copy: any; images: string[]; image: string }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      name = "",
      audience = "",
      campaignType = "",
      brandVoice = "",
      contentTypes = [],
      vision = "",
      n = 4, // number of images to generate (optional)
    } = req.body ?? {};

    if (!name || !vision) {
      return res.status(400).json({ ok: false, error: "Missing required fields: name and vision" });
    }

    // Mock copy — preserve your original behavior but you can expand this
    const mockCopy = {
      caption: `Introducing "${name}" — perfect for ${audience || "your audience"}.`,
      variations: [
        `Get ready for "${name}", tailored to your ${audience || "audience"}.`,
        `Introducing "${name}", in a ${brandVoice || "distinct"} style, driven by your vision.`,
      ],
      hashtags: ["#campaign", "#marketing", "#prototype"],
    };

    // Build a rich prompt (unencoded)
    const basePrompt = `marketing poster for ${name}. Vision: ${vision}. Voice: ${brandVoice ||
      "neutral"}. Campaign type: ${campaignType || "general"}. Content types: ${Array.isArray(contentTypes) ? contentTypes.join(", ") : contentTypes}.`;

    const width = 1024;
    const height = 1024;
    const images: string[] = [];

    // Generate n pollinations URLs with a small variation token (ensures different results)
    const num = Math.max(1, Math.min(8, Number(n) || 4)); // clamp 1..8
    for (let i = 1; i <= num; i++) {
      const variantPrompt = `${basePrompt} :: variation ${i}`;
      const encoded = encodeURIComponent(variantPrompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;
      images.push(url);
    }

    // Backward-compatible single image field (first one)
    return res.status(200).json({
      ok: true,
      copy: mockCopy,
      images,
      image: images[0],
    });
  } catch (err: any) {
    console.error("Error in generate-campaign:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
