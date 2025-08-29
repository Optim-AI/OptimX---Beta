import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { name, audience, campaignType, brandVoice, contentTypes, vision } = req.body;

    const mockCopy = {
      caption: `Introducing "${name}" — perfect for ${audience}.`,
      variations: [
        `Get ready for "${name}", tailored to your ${audience}.`,
        `Introducing "${name}", in a ${brandVoice} style, driven by your vision.`
      ],
      hashtags: ["#campaign", "#marketing", "#prototype"]
    };

    const prompt = encodeURIComponent(
      `marketing poster for ${name}. Vision: ${vision}. Voice: ${brandVoice}.`
    );

    const width = 1024;
    const height = 1024;
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${prompt}?width=${width}&height=${height}&nologo=true`;

    return res.status(200).json({
      ok: true,
      copy: mockCopy,
      image: pollinationsUrl
    });
  } catch (err: any) {
    console.error("Error in generate-campaign:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
