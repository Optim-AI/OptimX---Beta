// pages/api/creative-studio/generate-script.ts
import type { NextApiRequest, NextApiResponse } from "next";

// Configure API route to handle large payloads (product images as base64 data URLs)
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb', // Allow up to 10MB for product images and other data
    },
  },
  maxDuration: 60, // 60 seconds max for script generation
};

// Using Gemini as the "Creative Director Brain" to expand prompts
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid request body. Expected JSON object.",
      });
    }

    let {
      product_name,
      brand_name,
      category,
      style,
      duration,
      platform,
      aspect_ratio,
      voiceover,
      tone,
      key_message,
      cta,
      on_screen_text,
      user_description,
    } = req.body;

    // Normalize inputs
    product_name = typeof product_name === 'string' ? product_name.trim() : String(product_name || '').trim();
    brand_name = typeof brand_name === 'string' ? brand_name.trim() : String(brand_name || '').trim();
    category = category ? String(category).trim() : undefined;
    style = style ? String(style).trim() : undefined;
    user_description = user_description ? String(user_description).trim() : undefined;
    key_message = key_message ? String(key_message).trim() : undefined;
    cta = cta ? String(cta).trim() : undefined;

    // Validate required fields
    const missingFields: string[] = [];
    if (!product_name) missingFields.push('product_name');
    if (!brand_name) missingFields.push('brand_name');

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields,
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: "GEMINI_API_KEY is not configured" });
    }

    const durationSeconds = typeof duration === 'number' ? Math.max(5, Math.min(120, duration)) : parseInt(String(duration || '6'), 10) || 6;
    const durationSecondsClamped = Math.max(5, Math.min(120, durationSeconds));

    const systemPrompt = `You are a creative ad film director. You think and write like one: you care about story, emotion, rhythm, and the exact length of the film.

Your role:
- Take the user's ad vision and product details as your creative brief. Their vision is the soul of the film; the product is what you're selling.
- Write the entire script (shot plan, storyboard, voiceover) so it fits the user's chosen duration exactly. Every second is intentional.
- Plan scene-by-scene with precise timing that adds up to the total duration. No filler; every beat serves the idea.
- Specify camera angles, movement, lighting, and pacing like a director. Use the language of film: wide, close-up, push-in, rack focus, etc.
- Write voiceover that can be read aloud in the chosen duration (roughly 2–2.5 words per second for natural pace).
- Produce cinematic, production-ready prompts for video generation. Think Tier-1 ad agency / film director.

Rules:
- Total duration of the ad is exactly ${durationSecondsClamped} seconds. All shots and voiceover must fit this.
- Shot lengths and storyboard durations must sum to ${durationSecondsClamped}s.
- Voiceover script must be readable in ${durationSecondsClamped} seconds (about ${Math.floor(durationSecondsClamped * 2.2)}–${Math.floor(durationSecondsClamped * 2.5)} words max).
- Avoid generic or templated lines. Reflect the user's vision and the product's story.
- Output must be production-ready, director-grade JSON only.`;

    const userPrompt = `As a creative ad film director, write a complete commercial script for the following. The ad must be exactly ${durationSecondsClamped} seconds long.

${user_description ? `USER'S AD VISION:\n"${user_description}"\n` : ""}

PRODUCT:
- Product: ${product_name}
- Brand: ${brand_name}
- Category: ${category || "general"}

AD REQUIREMENTS:
- Style: ${style || "Product Close-up"}
- Duration: exactly ${durationSecondsClamped} seconds
- Platform: ${platform || "Instagram Reels / TikTok"}
- Aspect Ratio: ${aspect_ratio || "9:16"}
- Voiceover: ${voiceover ? "Yes" : "No"}
- Tone: ${tone || "Energetic"}
${key_message ? `- Key Message: ${key_message}` : ""}
${cta ? `- CTA: ${cta}` : ""}
${on_screen_text ? `- On-Screen Text: Enabled` : ""}

Return JSON with this structure:
{
  "ad_angle": "The creative angle and hook",
  "shot_plan": [{ "time": "0-Xs", "description": "Shot description" }],
  "storyboard": [{ "scene": 1, "duration": "Xs", "visual_description": "", "on_screen_text": "", "emotion": "", "motion_style": "" }],
  "visual_style_guide": { "color_palette": "", "lighting_mood": "", "typography": "", "motion_style": "", "brand_polish": "" },
  "voiceover_script": "${voiceover ? "Full voiceover script" : "N/A"}",
  "headline": "${on_screen_text ? "Short headline" : "N/A"}",
  "subtext": "${on_screen_text ? "Supporting text" : "N/A"}",
  "final_video_prompt": "Single cinematic prompt for the full ${durationSecondsClamped}-second video"
}

Return ONLY valid JSON.`;

    const requestBody = {
      contents: [{ parts: [{ text: userPrompt }] }],
      system_instruction: { parts: [{ text: systemPrompt }] },
      generation_config: {
        temperature: 0.8,
        top_k: 40,
        top_p: 0.95,
        max_output_tokens: 4000,
      },
    };

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return res.status(response.status >= 500 ? 500 : response.status).json({
        ok: false,
        error: `Failed to generate script: ${response.statusText}`,
      });
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return res.status(500).json({ ok: false, error: "No script generated" });
    }

    // Parse JSON from response
    let scriptData;
    try {
      let cleanedText = generatedText.trim();
      const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       cleanedText.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, cleanedText.match(/\{[\s\S]*\}/)?.[0]];
      
      if (jsonMatch && jsonMatch[1]) {
        cleanedText = jsonMatch[1].trim();
      }
      
      scriptData = JSON.parse(cleanedText);
      
      if (!scriptData.storyboard || !Array.isArray(scriptData.storyboard)) {
        if (scriptData.shot_plan && Array.isArray(scriptData.shot_plan)) {
          scriptData.storyboard = scriptData.shot_plan.map((shot: any, idx: number) => ({
            scene: idx + 1,
            duration: shot.time || "2-3s",
            visual_description: shot.description || "",
            on_screen_text: "",
            emotion: "",
            motion_style: "",
          }));
        } else {
          scriptData.storyboard = [{
            scene: 1,
            duration: `${durationSecondsClamped}s`,
            visual_description: scriptData.final_video_prompt?.substring(0, 200) || "Product showcase",
            on_screen_text: scriptData.headline || "",
            emotion: "Desire",
            motion_style: "Smooth, cinematic",
          }];
        }
      }
    } catch (parseError: any) {
      console.error("Failed to parse JSON:", parseError.message);
      
      // Fallback response
      scriptData = {
        ad_angle: "Premium product showcase",
        storyboard: [{
          scene: 1,
          duration: `${durationSecondsClamped}s`,
          visual_description: "Product-focused cinematic sequence",
          on_screen_text: "",
          emotion: "Desire",
          motion_style: "Smooth, cinematic",
        }],
        visual_style_guide: {
          color_palette: "Modern, premium",
          lighting_mood: "Cinematic",
          typography: "Modern sans-serif",
          motion_style: "Smooth, minimal",
          brand_polish: "Apple/Stripe quality",
        },
        voiceover_script: voiceover ? "Discover the premium quality that sets us apart." : "",
        headline: "",
        subtext: "",
        final_video_prompt: `Create a ${durationSecondsClamped}-second professional product video showcasing ${product_name} by ${brand_name} with cinematic quality.`,
      };
    }

    return res.status(200).json({ ok: true, script: scriptData });
  } catch (error: any) {
    console.error("Script generation error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate script",
    });
  }
}
