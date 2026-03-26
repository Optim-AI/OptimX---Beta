// pages/api/creative-studio/generate-script.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiRateLimitError,
} from "@/lib/gemini-retry";

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

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

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

    // Voiceover must be SHORT (under 8s spoken) to leave room for visuals and background audio
    const maxVoiceoverSeconds = Math.min(8, durationSecondsClamped);
    const maxVoiceoverWords = Math.floor(maxVoiceoverSeconds * 2.2);

    const isHookMode = style === "Hook";
    const isCommercialMode = style === "Commercial";
    const isUGCMode = style === "UGC Style";

    // Calculate recommended scene count based on duration
    const recommendedScenes = durationSecondsClamped <= 6 ? 3 : durationSecondsClamped <= 8 ? 4 : durationSecondsClamped <= 12 ? 5 : Math.min(8, Math.ceil(durationSecondsClamped / 2.5));
    const minScenes = Math.max(3, recommendedScenes - 1);

    // System prompt: Creative Ad Film Director — interprets user vision, duration, and needs to write the best script
    let systemPrompt: string;

    const multiSceneEnforcement = `

CRITICAL — MULTI-SCENE STORYBOARD REQUIREMENT:
- You MUST generate AT LEAST ${minScenes} separate scenes in the storyboard array, ideally ${recommendedScenes} scenes.
- NEVER create a single scene covering the full duration. A storyboard with 1 scene is INVALID.
- Each scene should be 1–3 seconds long. Break the ${durationSecondsClamped}-second video into distinct visual beats.
- Each scene MUST have a unique visual_description — no two scenes should describe the same thing.
- Each scene MUST have a specific time_range like "0-2s", "2-4s", "4-6s" etc. Time ranges must be consecutive and non-overlapping.
- The storyboard array is the MOST IMPORTANT part of the output. Put maximum creative effort into each scene's visual_description, emotion, and motion_style.`;

    if (isHookMode) {
      systemPrompt = `You are a performance-first ad creative director specializing in scroll-stopping, conversion-focused video ads. This is attention warfare, NOT cinematic storytelling.

Your mindset for HOOK MODE:
- Stop scrolling in the first 2 seconds. Trigger emotion immediately. Deliver fast product clarity. Drive action.
- No slow build-ups, no aesthetic intros, no brand logo fade-in first. No landscape establishing shots, no calm mood builds, no ambient product spins.
- Every 8-second video MUST follow this exact 4-part structure: 0–2s Pattern Interrupt → 2–4s Emotional Trigger → 4–6s Product Reveal → 6–8s Strong CTA.
- Emotion angle: prioritize one of Pain (problem amplification), Desire (aspiration/upgrade), Urgency (limited time), or Curiosity (unexpected visual setup).
- Product must appear clearly by mid-video (4–6s). No mysterious slow storytelling. This is ad logic, not art school.
- NO on-screen text: no captions, headlines, subtitles, overlays, or typography. 100% visual storytelling. If voiceover exists, it carries the message.
- Pacing: fast cuts, high motion energy, tight framing, strong contrast lighting. Hook always dominates tempo.
- Avoid: symbolic metaphors, overly artistic ambiguity, conceptual scenes without product clarity.${multiSceneEnforcement}`;
    } else if (isCommercialMode) {
      systemPrompt = `You are a premium brand commercial director. The output must feel like a PAID BRAND COMMERCIAL — high-production value, emotion + aspiration driven, product as hero. Fast, punchy, visually premium. A direct-response brand commercial compressed into ${durationSecondsClamped} seconds.

COMMERCIAL THEME — This is NOT: UGC, meme content, cinematic storytelling short film, aesthetic montage without product focus.
This IS: A paid brand commercial. Script-driven via voiceover only. NO text overlays on video frames.

Your mindset:
- Product as hero: show product clearly within first 3 seconds. Product must appear in at least 60% of total frames.
- ${durationSecondsClamped}-second formula: 0–2s Pattern Interrupt (strong hook visual, movement, contrast) → 2–${Math.floor(durationSecondsClamped * 0.6)}s Product as Hero (clean product shots, close-ups, premium lighting) → ${Math.floor(durationSecondsClamped * 0.6)}–${durationSecondsClamped - 1}s Emotional Payoff (outcome, transformation) → ${durationSecondsClamped - 1}–${durationSecondsClamped}s Brand Lock-In (product hero frame, logo via environment, strong closing VO).
- Voiceover: confident, clear, short sentences. Max ${maxVoiceoverWords} spoken words (must fit under ${maxVoiceoverSeconds} seconds). Hook → Value → Outcome → Brand line. No filler, no overexplaining. Keep voiceover SHORT so there is breathing room for visuals and background music/audio.
- Visual: controlled lighting, soft highlights, high contrast, studio or lifestyle premium look. Smooth camera (push-in, slider, cinematic pans). Shallow depth of field. NO handheld shaky shots, NO casual iPhone vlog style.
- Emotional angles: Confidence, Status, Relief, Energy, Control, Simplicity, Transformation. Never default to humor unless user explicitly requests.
- NO on-screen text, captions, subtitles, lower thirds, UI mockups, or typography. All messaging via voiceover and visual storytelling.${multiSceneEnforcement}`;
    } else if (isUGCMode) {
      systemPrompt = `You are a UGC-style ad creative director. The output must feel like a REAL PERSON filmed this — shot on phone, casual, imperfect, believable. Native to Reels/Shorts/TikTok. Trust over perfection.

UGC THEME — This is NOT: studio commercial, perfect lighting, cinematic camera moves, dramatic product hero shots, polished ad energy.
This IS: A real person sharing an honest recommendation. Conversational, slightly messy but authentic.

Your mindset:
- ${durationSecondsClamped}-second formula: 0–2s Hook (spoken, direct, attention-grabbing, feels spontaneous — e.g. "Wait, why is nobody talking about this?") → 2–${durationSecondsClamped - 2}s Experience/Reaction (demonstration, personal comment, showing product casually, honest tone) → ${durationSecondsClamped - 2}–${durationSecondsClamped}s Soft CTA ("You should try this." "Link's right there." No hard sales pitch).
- Voiceover: casual, real, slightly imperfect. Max 20–30 words. First person: "I tried this", "This saved me". Everyday language. No marketing buzzwords. No scripted feel.
- Visual: handheld, slight natural shake, eye-level selfie angle, casual framing. Natural light, room light. Real-world setting (bedroom, kitchen, office, car, cafe). NO studio backdrop, NO perfect product turntable shots.
- Product: must appear within first 3 seconds OR be referenced clearly. Person holding/using/reacting to it. UGC is about the person, not product glamour.
- Emotional bias: Surprise, Relatability, Relief, Curiosity, Honest recommendation. NOT prestige, status, or brand dominance.
- Editing: jump cuts, natural pauses, reaction zoom, fast pacing. NO smooth cinematic transitions, NO dramatic slow motion.${multiSceneEnforcement}`;
    } else {
      systemPrompt = `You are an award-winning creative ad film director. You think and write like one: story, emotion, rhythm, and every second on screen is intentional.

Your mindset:
- When the user describes their "Video Ad Vision," you interpret it like a creative brief. What do they really want? (e.g. trust, desire, urgency, aspiration, humor, premium feel.) Infer the emotional goal, the audience vibe, and the single idea the ad must land.
- Duration shapes the creative: ${durationSecondsClamped}s is your canvas. Short (5–6s) = one punchy idea, bold hook, no flab. Medium (7–8s) = setup + payoff, or a clear arc. Longer (9–12s) = you can build mood, story, or a twist. Design the script so the duration feels right for the vision — not padded, not rushed.
- The user's description is your North Star. Every shot, line, and beat should serve that vision and the product. No generic filler; make it feel bespoke to what they asked for.
- Use the language of film: wide, close-up, push-in, rack focus, dolly, cut on action, lighting (e.g. golden hour, high-key, silhouette). Think Tier-1 ad agency / film director — production-ready, cinematic.

Your role:
- Take the user's ad vision and product details as your creative brief. Their vision is the soul of the film; the product is what you're selling.
- Write the entire script (shot plan, storyboard, voiceover) so it fits the chosen duration exactly. Every second is intentional.
- Plan scene-by-scene with precise timing that adds up to the total duration. No filler; every beat serves the idea and the user's described vision.
- Write voiceover that is SHORT and punchy — max ${maxVoiceoverWords} words, spoken in under ${maxVoiceoverSeconds} seconds (roughly 2–2.5 words per second). Voiceover must NOT fill the entire video duration; leave breathing room for visuals, music, and ambient audio to shine.
- Output must be production-ready, director-grade JSON only.

Rules:
- Total duration is exactly ${durationSecondsClamped} seconds. All shots and voiceover must fit this.
- Shot lengths and storyboard durations must sum to ${durationSecondsClamped}s. E.g. for ${durationSecondsClamped}s use ~${Math.max(2, Math.floor(durationSecondsClamped / 3))}–${Math.max(4, Math.ceil(durationSecondsClamped / 2))} shots.
- Voiceover script must be SHORT — max ${maxVoiceoverWords} words, spoken in under ${maxVoiceoverSeconds} seconds. Do NOT fill the entire ${durationSecondsClamped}-second duration with voiceover. Leave silent/music-only moments for visuals and ambient audio to breathe.
- Avoid generic or templated lines. Reflect the user's vision and the product's story. The script should feel written for this brand, this product, and this specific vision.${multiSceneEnforcement}`;
    }

    // Style-specific requirements appended to user prompt
    let styleRequirements = '';
    if (isHookMode) {
      styleRequirements = `

HOOK MODE — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds exactly):
- Scene 1 (0–2s): PATTERN INTERRUPT — Bold visual hook. Stop scrolling. Fast cut, high impact. No slow intro.
- Scene 2 (2–4s): EMOTIONAL TRIGGER — Pain, Desire, Urgency, or Curiosity. High emotional tension.
- Scene 3 (4–6s): PRODUCT REVEAL — Product must appear clearly. Fast, direct. No mystery.
- Scene 4 (6–${durationSecondsClamped}s): STRONG CTA — Clear visual call-to-action moment.

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe the exact shot, camera angle, lighting, subject.
visual_style_guide.motion_style must emphasize: fast cuts, high motion energy, tight framing, strong contrast.
NO on-screen text. Purely visual.`;
    } else if (isCommercialMode) {
      styleRequirements = `

COMMERCIAL THEME — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds):
- Scene 1 (0–2s): PATTERN INTERRUPT — Strong hook visual, movement, contrast, emotion. Product tease or problem tease.
- Scene 2 (2–4s): PRODUCT AS HERO — Clean product shots, close-up details, use-case in action. Premium lighting.
- Scene 3 (4–6s): PRODUCT IN ACTION — Dynamic camera movement, product demonstration, lifestyle context.
- Scene 4 (6–${durationSecondsClamped}s): EMOTIONAL PAYOFF + BRAND LOCK-IN — Outcome transformation, product hero frame.

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe the exact shot, camera angle, lighting, subject.
visual_style_guide: controlled lighting, soft highlights, high contrast, smooth camera (push-in, slider, cinematic pans), shallow depth of field.
Voiceover: max ${maxVoiceoverWords} words, under ${maxVoiceoverSeconds} seconds spoken. Confident, clear. Hook → Value → Outcome → Brand line. Leave silent moments for visuals and music to breathe.
NO on-screen text, captions, or typography. Purely visual + voiceover.`;
    } else if (isUGCMode) {
      styleRequirements = `

UGC THEME — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds):
- Scene 1 (0–2s): HOOK (spoken) — Direct, attention-grabbing. Feels spontaneous. e.g. "Wait, why is nobody talking about this?"
- Scene 2 (2–4s): FIRST IMPRESSION — Unboxing, first look, initial reaction. Genuine surprise or curiosity.
- Scene 3 (4–6s): EXPERIENCE / DEMO — Showing product in use, personal commentary. Honest, relatable.
- Scene 4 (6–${durationSecondsClamped}s): SOFT CTA — "You should try this." "I'm not going back." No hard sales pitch.

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe what the person is doing, their expression, the setting.
visual_style_guide: handheld, slight natural shake, eye-level selfie angle, natural light, real-world setting (bedroom, kitchen, office).
Voiceover: max ${maxVoiceoverWords} words, under ${maxVoiceoverSeconds} seconds spoken. Casual, conversational, first person. No marketing buzzwords. Leave gaps for visuals and ambient audio.
Character description: include age, vibe, setting for UGC creator.`;
    }

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
- On-Screen Text: DISABLED (CRITICAL: The video must NOT contain any on-screen text, captions, titles, headlines, or text overlays. Purely visual only.)

DIRECTOR REQUIREMENTS:
- Create a shot-by-shot plan with EXACTLY ${recommendedScenes} shots (minimum ${minScenes}). NEVER use a single shot for the entire duration.
- Each shot: 1–3 seconds. Time ranges must be consecutive like "0-2s", "2-4s", "4-6s", "6-8s". They must sum to ${durationSecondsClamped}s.
- Each shot MUST have a unique, specific visual description — not generic. Describe exact camera angle, subject position, lighting setup, and composition.
- Specify camera (angle, movement), lighting, and composition for each shot.
- Voiceover (if enabled): write a SHORT script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"} that takes UNDER ${maxVoiceoverSeconds} seconds to speak (~${maxVoiceoverWords} words MAX at 2.2 words/sec). The voiceover must NOT fill the entire ${durationSecondsClamped}-second video — leave silent/music-only moments so visuals and background audio have room to breathe. ${key_message ? `Weave in: "${key_message}".` : ""} ${cta ? `End with CTA: "${cta}".` : ""}
- final_video_prompt: 300–800 tokens, director-grade, describing the full ${durationSecondsClamped}-second film (cinematic lighting, movement, pacing, color, premium brand quality), aligned with the user's described vision.
${styleRequirements}

Return your response as a JSON object with this exact structure. The storyboard MUST have ${recommendedScenes} scenes (minimum ${minScenes}):
{
  "ad_angle": "The creative angle and hook, inspired by the user's vision and product (1-2 lines)",
  "shot_plan": [
    { "time": "0-2s", "description": "Shot 1 description with camera, lighting, composition" },
    { "time": "2-4s", "description": "Shot 2 description — MUST be different from shot 1" },
    { "time": "4-6s", "description": "Shot 3 description — MUST be different from shots 1-2" },
    { "time": "6-${durationSecondsClamped}s", "description": "Shot 4 description — MUST be different from shots 1-3" }
  ],
  "storyboard": [
    {
      "scene": 1,
      "duration": "2s",
      "time_range": "0-2s",
      "visual_description": "SPECIFIC director-grade visual: camera angle, subject, lighting, composition. NOT generic.",
      "on_screen_text": "",
      "emotion": "Specific emotion (e.g., Curiosity, Excitement, Trust)",
      "motion_style": "Specific camera move (e.g., Slow push-in, Rack focus, Static wide)",
      "voiceover_line": "Voiceover for this 2-second scene only"
    },
    {
      "scene": 2,
      "duration": "2s",
      "time_range": "2-4s",
      "visual_description": "DIFFERENT visual from scene 1. New angle, new subject focus, new composition.",
      "on_screen_text": "",
      "emotion": "Different emotion from scene 1",
      "motion_style": "Different camera move from scene 1",
      "voiceover_line": "Voiceover for this scene"
    },
    {
      "scene": 3,
      "duration": "2s",
      "time_range": "4-6s",
      "visual_description": "DIFFERENT visual from scenes 1-2. Progress the story.",
      "on_screen_text": "",
      "emotion": "Emotion for this beat",
      "motion_style": "Camera style for this scene",
      "voiceover_line": "Voiceover for this scene"
    },
    {
      "scene": 4,
      "duration": "2s",
      "time_range": "6-${durationSecondsClamped}s",
      "visual_description": "Final beat. Product hero / CTA moment. Distinct from all prior scenes.",
      "on_screen_text": "",
      "emotion": "Closing emotion",
      "motion_style": "Closing camera style",
      "voiceover_line": "Closing voiceover line"
    }
  ],
  "visual_style_guide": {
    "color_palette": "Color palette",
    "lighting_mood": "Lighting mood",
    "typography": "Typography",
    "motion_style": "Overall motion",
    "brand_polish": "Brand polish (e.g. Apple/Stripe quality)"
  },
  "voiceover_script": "${voiceover ? `Short voiceover script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"}, MAX ${maxVoiceoverWords} words, spoken in UNDER ${maxVoiceoverSeconds} seconds. ${tone || "Energetic"} tone. Leave silent moments for visuals and music.` : "N/A - Voiceover disabled"}",
  "headline": "",
  "subtext": "",
  "final_video_prompt": "Single cinematic prompt (300-800 tokens) for the full ${durationSecondsClamped}-second video: camera, lighting, composition, pacing, color grading, shot transitions, premium quality. CRITICAL: Do NOT describe or include any on-screen text, captions, titles, headlines, or text overlays. The video is purely visual with no written text."
}

IMPORTANT — STORYBOARD VALIDATION:
- The storyboard array MUST contain ${recommendedScenes} scene objects (minimum ${minScenes}). A storyboard with only 1 scene is REJECTED.
- Each scene's time_range must be consecutive: "0-2s", "2-4s", "4-6s", "6-8s" etc.
- Each scene's visual_description must be UNIQUE and SPECIFIC — not a copy of the final_video_prompt or a generic summary.
- shot_plan and storyboard durations must cover 0 to ${durationSecondsClamped} seconds total.
- final_video_prompt must describe the entire ${durationSecondsClamped}-second film with rich cinematic language.
- Return ONLY valid JSON; no markdown, no code fences, no extra text.

CRITICAL — NO ON-SCREEN TEXT: Set headline, subtext, and every storyboard on_screen_text to empty string. The video must NEVER display any text, captions, titles, or overlays. Purely visual only.`;

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
        response_mime_type: "application/json",
      },
    };

    const requestBodyStr = JSON.stringify(requestBody);
    console.log("Calling Gemini API - Request size:", requestBodyStr.length, "chars");
    console.log("User prompt length:", userPrompt.length, "chars");
    console.log("System prompt length:", systemPrompt.length, "chars");

    // Use gemini-2.5-flash which has better support for system instructions
    const response = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_BASE_URL}/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: requestBodyStr,
      },
      { operationLabel: "creative-studio-generateContent", maxRetries: 5 }
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
      
      // Helper: build a multi-scene fallback storyboard from the duration
      const buildFallbackStoryboard = (videoPrompt: string, voScript: string) => {
        const sceneCount = recommendedScenes;
        const sceneDuration = Math.round((durationSecondsClamped / sceneCount) * 10) / 10;
        const scenes: Array<{ scene: number; duration: string; time_range: string; visual_description: string; on_screen_text: string; emotion: string; motion_style: string; voiceover_line: string }> = [];
        const fallbackDescriptions = [
          `Dramatic opening shot — close-up of ${product_name || 'the product'} with cinematic lighting, shallow depth of field, subtle camera push-in`,
          `Dynamic angle shift — medium shot showing ${product_name || 'the product'} in context, smooth dolly movement, warm highlights`,
          `Detail reveal — extreme close-up of product texture/features, rack focus, premium studio lighting with soft reflections`,
          `Lifestyle moment — product in use, aspirational setting, natural light mixed with controlled fill, gentle camera pan`,
          `Hero shot — product centered with brand-defining composition, dramatic backlight, slow pull-out to reveal full frame`,
          `Emotional payoff — transformation moment showing the outcome, warm golden tones, satisfying camera settle`,
        ];
        const fallbackEmotions = ['Curiosity', 'Interest', 'Desire', 'Aspiration', 'Trust', 'Satisfaction'];
        const fallbackMotions = ['Slow push-in', 'Smooth dolly right', 'Rack focus pull', 'Gentle pan left', 'Static hero frame', 'Slow pull-out'];

        const voWords = voScript ? voScript.split(/\s+/) : [];
        const wordsPerScene = voWords.length > 0 ? Math.ceil(voWords.length / sceneCount) : 0;

        for (let i = 0; i < sceneCount; i++) {
          const startTime = Math.round(i * sceneDuration * 10) / 10;
          const endTime = i === sceneCount - 1 ? durationSecondsClamped : Math.round((i + 1) * sceneDuration * 10) / 10;
          const sceneVo = voWords.length > 0
            ? voWords.slice(i * wordsPerScene, (i + 1) * wordsPerScene).join(' ')
            : '';

          scenes.push({
            scene: i + 1,
            duration: `${endTime - startTime}s`,
            time_range: `${startTime}-${endTime}s`,
            visual_description: fallbackDescriptions[i % fallbackDescriptions.length],
            on_screen_text: '',
            emotion: fallbackEmotions[i % fallbackEmotions.length],
            motion_style: fallbackMotions[i % fallbackMotions.length],
            voiceover_line: sceneVo,
          });
        }
        return scenes;
      };

      // Validate required fields exist
      if (!scriptData.storyboard || !Array.isArray(scriptData.storyboard)) {
        console.warn("Missing or invalid storyboard array, using shot_plan if available");
        if (scriptData.shot_plan && Array.isArray(scriptData.shot_plan) && scriptData.shot_plan.length >= minScenes) {
          scriptData.storyboard = scriptData.shot_plan.map((shot: any, idx: number) => ({
            scene: idx + 1,
            duration: shot.time?.replace(/[^\d-]/g, '') + 's' || "2s",
            time_range: shot.time || `${idx * 2}-${(idx + 1) * 2}s`,
            visual_description: shot.description || "",
            on_screen_text: "",
            emotion: shot.emotion || "",
            motion_style: shot.motion_style || "",
            voiceover_line: shot.voiceover_line || "",
          }));
        } else {
          scriptData.storyboard = buildFallbackStoryboard(
            scriptData.final_video_prompt || '',
            scriptData.voiceover_script || ''
          );
        }
      } else if (scriptData.storyboard.length === 1) {
        // Single-scene storyboard is too generic — split into multiple scenes
        console.warn("Single-scene storyboard detected, splitting into multiple scenes");
        if (scriptData.shot_plan && Array.isArray(scriptData.shot_plan) && scriptData.shot_plan.length >= minScenes) {
          scriptData.storyboard = scriptData.shot_plan.map((shot: any, idx: number) => ({
            scene: idx + 1,
            duration: shot.time?.replace(/[^\d-]/g, '') + 's' || "2s",
            time_range: shot.time || `${idx * 2}-${(idx + 1) * 2}s`,
            visual_description: shot.description || "",
            on_screen_text: "",
            emotion: shot.emotion || "",
            motion_style: shot.motion_style || "",
            voiceover_line: shot.voiceover_line || "",
          }));
        } else {
          scriptData.storyboard = buildFallbackStoryboard(
            scriptData.final_video_prompt || '',
            scriptData.voiceover_script || ''
          );
        }
      } else {
        // Ensure each storyboard scene has time_range
        scriptData.storyboard = scriptData.storyboard.map((scene: any, idx: number) => {
          if (!scene.time_range && scriptData.shot_plan?.[idx]?.time) {
            scene.time_range = scriptData.shot_plan[idx].time;
          } else if (!scene.time_range) {
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
      
      // Fallback: create a structured multi-scene response
      const fallbackVo = voiceoverText || (voiceover ? "Discover the premium quality that sets us apart." : "");
      const fallbackPrompt = finalPrompt || `Create a ${durationSecondsClamped}-second professional product video showcasing ${product_name || "the product"} by ${brand_name || "the brand"} with cinematic quality and engaging visuals.`;

      const sceneCount = recommendedScenes;
      const sceneDur = Math.round((durationSecondsClamped / sceneCount) * 10) / 10;
      const fallbackDescs = [
        `Dramatic opening — close-up of ${product_name || 'the product'} with cinematic lighting, shallow depth of field, camera push-in revealing texture and form`,
        `Dynamic angle shift — medium shot of ${product_name || 'the product'} in lifestyle context, smooth dolly movement, warm highlights and soft shadows`,
        `Detail reveal — extreme close-up capturing product features, rack focus transition, premium studio lighting with soft reflections`,
        `Hero shot — ${product_name || 'the product'} centered in frame with brand-defining composition, dramatic rim light, slow pull-out`,
        `Emotional payoff — product in use showing transformation/outcome, golden tones, satisfying camera settle on final frame`,
        `Brand moment — wide establishing shot transitioning to product hero, cinematic depth, aspirational atmosphere`,
      ];
      const fallbackEmotions2 = ['Curiosity', 'Interest', 'Desire', 'Aspiration', 'Trust', 'Satisfaction'];
      const fallbackMotions2 = ['Slow push-in', 'Smooth dolly right', 'Rack focus pull', 'Static hero frame', 'Slow pull-out', 'Gentle pan'];

      const voWords2 = fallbackVo ? fallbackVo.split(/\s+/) : [];
      const wps2 = voWords2.length > 0 ? Math.ceil(voWords2.length / sceneCount) : 0;

      const fallbackScenes: Array<{ scene: number; duration: string; time_range: string; visual_description: string; on_screen_text: string; emotion: string; motion_style: string; voiceover_line: string }> = [];
      for (let i = 0; i < sceneCount; i++) {
        const st = Math.round(i * sceneDur * 10) / 10;
        const et = i === sceneCount - 1 ? durationSecondsClamped : Math.round((i + 1) * sceneDur * 10) / 10;
        fallbackScenes.push({
          scene: i + 1,
          duration: `${et - st}s`,
          time_range: `${st}-${et}s`,
          visual_description: fallbackDescs[i % fallbackDescs.length],
          on_screen_text: '',
          emotion: fallbackEmotions2[i % fallbackEmotions2.length],
          motion_style: fallbackMotions2[i % fallbackMotions2.length],
          voiceover_line: voWords2.length > 0 ? voWords2.slice(i * wps2, (i + 1) * wps2).join(' ') : '',
        });
      }

      scriptData = {
        ad_angle: adAngle,
        storyboard: fallbackScenes,
        visual_style_guide: {
          color_palette: "Modern, premium",
          lighting_mood: "Cinematic",
          typography: "Modern sans-serif",
          motion_style: "Smooth, minimal",
          brand_polish: "Apple/Stripe quality",
        },
        voiceover_script: fallbackVo,
        headline: "",
        subtext: "",
        final_video_prompt: fallbackPrompt,
      };
      
      console.log("Using fallback scriptData with extracted fields");
    }

    // Force no on-screen text: always strip headline, subtext, and storyboard on_screen_text
    scriptData.headline = "";
    scriptData.subtext = "";
    if (scriptData.storyboard && Array.isArray(scriptData.storyboard)) {
      scriptData.storyboard = scriptData.storyboard.map((scene: any) => ({
        ...scene,
        on_screen_text: "",
      }));
    }

    return res.status(200).json({
      ok: true,
      script: scriptData,
    });
  } catch (error: any) {
    console.error("Script generation error:", error);
    console.error("Error stack:", error.stack);

    if (isGeminiRateLimitError(error)) {
      return res.status(429).json({
        ok: false,
        error: "Rate limit exceeded. Please try again in a moment.",
      });
    }

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
