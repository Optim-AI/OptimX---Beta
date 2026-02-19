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
// This implements the "Mini Gemini Studio" approach
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
// Use v1beta API for text generation (REST API uses snake_case field names)
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Check if body exists and is valid
    if (!req.body || typeof req.body !== 'object') {
      console.error("Invalid request body:", typeof req.body, req.body);
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid request body. Expected JSON object.",
        received: typeof req.body,
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
      language, // Voiceover language: english, tamil, hindi
      tone,
      key_message,
      cta,
      on_screen_text,
      user_description, // User's description of what they want
      product_images, // Product images for analysis
    } = req.body;

    // Normalize string inputs (trim whitespace, convert to string if needed)
    product_name = typeof product_name === 'string' ? product_name.trim() : String(product_name || '').trim();
    brand_name = typeof brand_name === 'string' ? brand_name.trim() : String(brand_name || '').trim();
    category = category ? String(category).trim() : undefined;
    style = style ? String(style).trim() : undefined;
    user_description = user_description ? String(user_description).trim() : undefined;
    key_message = key_message ? String(key_message).trim() : undefined;
    cta = cta ? String(cta).trim() : undefined;

    console.log("Received request body:", {
      product_name: product_name || "(empty)",
      brand_name: brand_name || "(empty)",
      category,
      style,
      duration,
      platform,
      aspect_ratio,
      voiceover,
      tone,
      has_user_description: !!user_description,
      has_product_images: !!(product_images && Array.isArray(product_images) && product_images.length > 0),
    });

    // Validate required fields with better error messages
    const missingFields: string[] = [];
    if (!product_name || product_name === '') {
      missingFields.push('product_name');
    }
    if (!brand_name || brand_name === '') {
      missingFields.push('brand_name');
    }

    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      console.error("Received values:", { 
        product_name: product_name || null, 
        brand_name: brand_name || null 
      });
      return res.status(400).json({ 
        ok: false, 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields,
        received: {
          product_name: product_name || null,
          brand_name: brand_name || null,
        }
      });
    }

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY and GEMINI_VEO_API_KEY are not configured in this environment");
      return res.status(500).json({
        ok: false,
        error: "AI service not configured. Please add GEMINI_API_KEY or GEMINI_VEO_API_KEY to your deployment environment variables (e.g. Vercel Project Settings > Environment Variables), then redeploy.",
      });
    }

    // ========================================
    // MINI GEMINI STUDIO APPROACH
    // ========================================
    // Step A: Use Gemini as "Creative Director Brain"
    // This expands user input into a comprehensive cinematic prompt
    // ========================================
    
    // Duration in seconds (user's choice) — used to size shot plan and voiceover
    const durationSeconds = typeof duration === 'number' ? Math.max(5, Math.min(120, duration)) : parseInt(String(duration || '6'), 10) || 6;
    const durationSecondsClamped = Math.max(5, Math.min(120, durationSeconds));

    // System prompt: Creative Ad Film Director — interprets user vision, duration, and needs to write the best script
    const systemPrompt = `You are an award-winning creative ad film director. You think and write like one: story, emotion, rhythm, and every second on screen is intentional.

Your mindset:
- When the user describes their "Video Ad Vision," you interpret it like a creative brief. What do they really want? (e.g. trust, desire, urgency, aspiration, humor, premium feel.) Infer the emotional goal, the audience vibe, and the single idea the ad must land.
- Duration shapes the creative: ${durationSecondsClamped}s is your canvas. Short (5–6s) = one punchy idea, bold hook, no flab. Medium (7–8s) = setup + payoff, or a clear arc. Longer (9–12s) = you can build mood, story, or a twist. Design the script so the duration feels right for the vision — not padded, not rushed.
- The user's description is your North Star. Every shot, line, and beat should serve that vision and the product. No generic filler; make it feel bespoke to what they asked for.
- Use the language of film: wide, close-up, push-in, rack focus, dolly, cut on action, lighting (e.g. golden hour, high-key, silhouette). Think Tier-1 ad agency / film director — production-ready, cinematic.

Your role:
- Take the user's ad vision and product details as your creative brief. Their vision is the soul of the film; the product is what you're selling.
- Write the entire script (shot plan, storyboard, voiceover) so it fits the chosen duration exactly. Every second is intentional.
- Plan scene-by-scene with precise timing that adds up to the total duration. No filler; every beat serves the idea and the user's described vision.
- Write voiceover that can be read aloud in the chosen duration (roughly 2–2.5 words per second for natural pace).
- Output must be production-ready, director-grade JSON only.

Rules:
- Total duration is exactly ${durationSecondsClamped} seconds. All shots and voiceover must fit this.
- Shot lengths and storyboard durations must sum to ${durationSecondsClamped}s. E.g. for ${durationSecondsClamped}s use ~${Math.max(2, Math.floor(durationSecondsClamped / 3))}–${Math.max(4, Math.ceil(durationSecondsClamped / 2))} shots.
- Voiceover script must be readable in ${durationSecondsClamped} seconds (about ${Math.floor(durationSecondsClamped * 2.2)}–${Math.floor(durationSecondsClamped * 2.5)} words max).
- Avoid generic or templated lines. Reflect the user's vision and the product's story. The script should feel written for this brand, this product, and this specific vision.`;

    // User message: Ad vision drives the script; director interprets needs, duration, and description for the best creative
    const userPrompt = `As a creative ad film director, write a complete commercial script that truly serves the user's vision and the chosen duration. The ad must be exactly ${durationSecondsClamped} seconds long — all shots and voiceover must fit this duration.

${user_description ? `USER'S VIDEO AD VISION (interpret this like a creative brief — what do they want to feel, achieve, or say?):\n"${user_description}"\n\nUse this to drive the story, mood, pacing, and how you present the product. Infer their need: e.g. build trust, create desire, show premium quality, urgency, aspiration, or a specific emotion. Every shot and line should feel written for this vision and this duration.` : "No specific vision provided — create a strong, product-led creative that fits the duration and style."}

ABOUT THE PRODUCT:
- Product: ${product_name}
- Brand: ${brand_name}
- Category: ${category || "general"}

AD REQUIREMENTS:
- Style: ${style || "Product Close-up"}
- Duration: exactly ${durationSecondsClamped} seconds (design the script for this length — make it feel right, not padded or rushed)
- Platform: ${platform || "Instagram Reels / TikTok"}
- Aspect Ratio: ${aspect_ratio || "9:16"}
- Voiceover: ${voiceover ? "Yes" : "No"}
${voiceover ? `- Voiceover Language: ${String(language || "english").charAt(0).toUpperCase() + String(language || "english").slice(1)} (write the entire voiceover script and voiceover_lines in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"})` : ""}
- Tone: ${tone || "Energetic"}
${key_message ? `- Key Message: ${key_message}` : ""}
${cta ? `- CTA: ${cta}` : ""}
${on_screen_text ? `- On-Screen Text: Enabled` : "- On-Screen Text: Disabled"}

DIRECTOR REQUIREMENTS:
- Create a shot-by-shot plan where the sum of all shot durations equals ${durationSecondsClamped} seconds. Use time ranges like "0-3s", "3-7s", etc., ending at ${durationSecondsClamped}s.
- Each shot: 1–4 seconds typically; adjust number of shots so the total is ${durationSecondsClamped}s and the pacing serves the user's vision.
- Specify camera (angle, movement), lighting, and composition for each shot.
- Voiceover (if enabled): write a script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"} that can be read in ${durationSecondsClamped} seconds (~${Math.floor(durationSecondsClamped * 2.2)}–${Math.floor(durationSecondsClamped * 2.5)} words). ${key_message ? `Weave in: "${key_message}".` : ""} ${cta ? `End with CTA: "${cta}".` : ""}
- final_video_prompt: 300–800 tokens, director-grade, describing the full ${durationSecondsClamped}-second film (cinematic lighting, movement, pacing, color, premium brand quality), aligned with the user's described vision.

Return your response as a JSON object with this exact structure (use real timings that sum to ${durationSecondsClamped}s):
{
  "ad_angle": "The creative angle and hook, inspired by the user's vision and product (1-2 lines)",
  "shot_plan": [
    { "time": "0-Xs", "description": "Shot description with camera, lighting, composition" },
    { "time": "X-Ys", "description": "..." }
  ],
  "storyboard": [
    {
      "scene": 1,
      "duration": "Xs",
      "time_range": "0-Xs",
      "visual_description": "Director-grade visual description",
      "on_screen_text": "Max 6 words",
      "emotion": "Emotion to evoke",
      "motion_style": "Camera and motion style",
      "voiceover_line": "Voiceover for this scene (if enabled)"
    }
  ],
  "visual_style_guide": {
    "color_palette": "Color palette",
    "lighting_mood": "Lighting mood",
    "typography": "Typography",
    "motion_style": "Overall motion",
    "brand_polish": "Brand polish (e.g. Apple/Stripe quality)"
  },
  "voiceover_script": "${voiceover ? `Full voiceover script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"}, readable in exactly ${durationSecondsClamped} seconds, ${tone || "Energetic"} tone.` : "N/A - Voiceover disabled"}",
  "headline": "${on_screen_text ? "Short headline (3-5 words)" : "N/A"}",
  "subtext": "${on_screen_text ? "Supporting text (5-8 words)" : "N/A"}",
  "final_video_prompt": "Single cinematic prompt (300-800 tokens) for the full ${durationSecondsClamped}-second video: camera, lighting, composition, pacing, color grading, shot transitions, premium quality."
}

IMPORTANT: shot_plan and storyboard durations must cover 0 to ${durationSecondsClamped} seconds total. final_video_prompt must describe the entire ${durationSecondsClamped}-second film with rich cinematic language. Return ONLY valid JSON; no markdown or extra text.`;

    // Call Gemini API as Creative Director Brain
    // Using gemini-2.5-flash with v1beta REST API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      system_instruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      generation_config: {
        temperature: 0.8,
        top_k: 40,
        top_p: 0.95,
        max_output_tokens: 4000,
      },
    };

    const requestBodyStr = JSON.stringify(requestBody);
    console.log("Calling Gemini API - Request size:", requestBodyStr.length, "chars");
    console.log("User prompt length:", userPrompt.length, "chars");
    console.log("System prompt length:", systemPrompt.length, "chars");

    // Use gemini-2.5-flash which has better support for system instructions
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: requestBodyStr,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error("Gemini API error:", response.status);
      console.error("Error details:", errorDetails);
      
      // Map common Gemini API errors to user-friendly messages
      let errorMessage = `Failed to generate script: ${response.statusText}`;
      if (response.status === 400) {
        errorMessage = "Invalid request to AI service. Please check your input fields.";
        if (errorDetails?.error?.message) {
          errorMessage += ` Details: ${errorDetails.error.message}`;
        }
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = "Authentication failed. Please check API key configuration.";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again in a moment.";
      } else if (response.status >= 500) {
        errorMessage = "AI service temporarily unavailable. Please try again later.";
      }
      
      return res.status(response.status >= 500 ? 500 : response.status).json({
        ok: false,
        error: errorMessage,
        details: errorDetails,
        status: response.status,
      });
    }

    const data = await response.json();

    // Extract the generated text from Gemini response
    // Gemini response structure: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return res.status(500).json({
        ok: false,
        error: "No script generated from Gemini API",
        rawResponse: data,
      });
    }

    // Try to parse JSON from the response
    let scriptData;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedText = generatedText.trim();
      
      // Try multiple patterns to extract JSON
      // Pattern 1: ```json ... ```
      let jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
      // Pattern 2: ``` ... ```
      if (!jsonMatch) {
        jsonMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
      }
      // Pattern 3: Look for JSON object directly (starts with { ends with })
      if (!jsonMatch) {
        const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonMatch = [null, jsonObjectMatch[0]];
        }
      }
      
      if (jsonMatch && jsonMatch[1]) {
        cleanedText = jsonMatch[1].trim();
      }
      
      console.log("Attempting to parse JSON, length:", cleanedText.length);
      
      scriptData = JSON.parse(cleanedText);
      console.log("Successfully parsed JSON with keys:", Object.keys(scriptData));
      
      // Validate required fields exist
      if (!scriptData.storyboard || !Array.isArray(scriptData.storyboard)) {
        console.warn("Missing or invalid storyboard array, using shot_plan if available");
        // Try to use shot_plan if storyboard is missing
        if (scriptData.shot_plan && Array.isArray(scriptData.shot_plan)) {
          scriptData.storyboard = scriptData.shot_plan.map((shot: any, idx: number) => ({
            scene: idx + 1,
            duration: shot.time?.replace(/[^\d-]/g, '') + 's' || "2-3s",
            time_range: shot.time || `${idx * 2}-${(idx + 1) * 2}s`,
            visual_description: shot.description || "",
            on_screen_text: "",
            emotion: "",
            motion_style: "",
            voiceover_line: "",
          }));
        } else {
          // Create a default storyboard
          scriptData.storyboard = [
            {
              scene: 1,
              duration: `${durationSecondsClamped}s`,
              time_range: `0-${durationSecondsClamped}s`,
              visual_description: scriptData.final_video_prompt?.substring(0, 200) || "Product showcase",
              on_screen_text: scriptData.headline || "",
              emotion: "Desire",
              motion_style: "Smooth, cinematic",
              voiceover_line: scriptData.voiceover_script || "",
            },
          ];
        }
      } else {
        // Ensure each storyboard scene has time_range
        scriptData.storyboard = scriptData.storyboard.map((scene: any, idx: number) => {
          if (!scene.time_range && scriptData.shot_plan?.[idx]?.time) {
            scene.time_range = scriptData.shot_plan[idx].time;
          } else if (!scene.time_range) {
            // Calculate approximate time range based on duration
            const durationNum = parseInt(scene.duration) || 2;
            const startTime = scriptData.storyboard.slice(0, idx).reduce((acc: number, s: any) => acc + (parseInt(s.duration) || 2), 0);
            scene.time_range = `${startTime}-${startTime + durationNum}s`;
          }
          return scene;
        });
      }
      
    } catch (parseError: any) {
      // If JSON parsing fails, try to extract structured data manually
      console.error("Failed to parse JSON:", parseError.message);
      console.error("Raw response (first 500 chars):", generatedText.substring(0, 500));
      
      // Try to extract fields manually using regex
      const extractField = (text: string, field: string): string => {
        const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i');
        const match = text.match(regex);
        return match ? match[1] : "";
      };
      
      const adAngle = extractField(generatedText, "ad_angle") || "Premium product showcase";
      const headline = extractField(generatedText, "headline") || "Check it out";
      const subtext = extractField(generatedText, "subtext") || "";
      const voiceoverText = extractField(generatedText, "voiceover_script") || "";
      const finalPrompt = extractField(generatedText, "final_video_prompt") || "";
      
      // Fallback: create a structured response
      scriptData = {
        ad_angle: adAngle,
        storyboard: [
          {
            scene: 1,
            duration: `${durationSecondsClamped}s`,
            time_range: `0-${durationSecondsClamped}s`,
            visual_description: finalPrompt || "Product-focused cinematic sequence showcasing the product",
            on_screen_text: headline,
            emotion: "Desire",
            motion_style: "Smooth, cinematic",
            voiceover_line: voiceoverText || "",
          },
        ],
        visual_style_guide: {
          color_palette: "Modern, premium",
          lighting_mood: "Cinematic",
          typography: "Modern sans-serif",
          motion_style: "Smooth, minimal",
          brand_polish: "Apple/Stripe quality",
        },
        voiceover_script: voiceoverText || (voiceover ? "Discover the premium quality that sets us apart." : ""),
        headline: headline,
        subtext: subtext,
        final_video_prompt: finalPrompt || `Create a ${durationSecondsClamped}-second professional product video showcasing ${product_name || "the product"} by ${brand_name || "the brand"} with cinematic quality and engaging visuals.`,
      };
      
      console.log("Using fallback scriptData with extracted fields");
    }

    return res.status(200).json({
      ok: true,
      script: scriptData,
    });
  } catch (error: any) {
    console.error("Script generation error:", error);
    console.error("Error stack:", error.stack);
    
    // Handle specific error types
    if (error.name === 'SyntaxError' || error.message?.includes('JSON')) {
      return res.status(400).json({
        ok: false,
        error: "Invalid JSON in request body",
        details: error.message,
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate script",
      type: error.name || "UnknownError",
    });
  }
}
