// pages/api/creative-studio/generate-script.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiRateLimitError,
} from "@/lib/gemini-retry";
import {
  computeVoiceoverBudget,
  redistributeVoiceoverToStoryboard,
  truncateVoiceover,
  SCRIPT_CONTENT_SAFETY,
  buildBodyProductSafetyBlock,
  buildScriptGenerationPipelineInstructions,
  buildVoiceoverTimingDirective,
  AD_VOICEOVER_COPY_RULES,
  ensurePerformanceAdVoiceover,
  validateVoiceoverCommercial,
  VOICEOVER_WORDS_PER_SECOND,
} from "@/lib/creative-studio/video-prompt-utils";
import { buildEnvatoCommercialDirective } from "@/lib/creative-studio/envato-prompt";
import {
  formatFrameworkForPrompt,
  getFrameworkBeatsForDuration,
  selectFrameworkForHook,
} from "@/lib/creative-studio/ad-frameworks";
import {
  CREATIVE_SCORE_THRESHOLD,
  meetsCreativeThreshold,
  scoreCreativeScript,
} from "@/lib/creative-studio/creative-score";
import { getGeminiApiKey } from "@/lib/gemini-config";

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
      creative_format,
      hook_type,
      campaign_goal,
      audience,
      creative_strategy,
      selected_concept,
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
    const visualFormat = creative_format ? String(creative_format).trim() : style || "Commercial";
    const hookType = hook_type ? String(hook_type).trim() : "Auto";
    const campaignGoal = campaign_goal ? String(campaign_goal).trim() : "Drive Sales";
    const audienceType = audience ? String(audience).trim() : "Auto";
    const strategy = creative_strategy && typeof creative_strategy === "object" ? creative_strategy : null;
    const concept = selected_concept && typeof selected_concept === "object" ? selected_concept : null;
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

    // ========================================
    // MINI GEMINI STUDIO APPROACH
    // ========================================
    // Step A: Use Gemini as "Creative Director Brain"
    // This expands user input into a comprehensive cinematic prompt
    // ========================================
    
    // Duration in seconds (user's choice) — used to size shot plan and voiceover
    const durationSeconds = typeof duration === 'number' ? Math.max(5, Math.min(120, duration)) : parseInt(String(duration || '6'), 10) || 6;
    const durationSecondsClamped = Math.max(5, Math.min(120, durationSeconds));

    // Voiceover budget: leave tail silence so Veo does not cut speech at the end
    const {
      maxSpokenSeconds: maxVoiceoverSeconds,
      minWords: minVoiceoverWords,
      maxWords: maxVoiceoverWords,
      targetWords: targetVoiceoverWords,
      tailSilenceSeconds: voTailSeconds,
    } = computeVoiceoverBudget(durationSecondsClamped);
    const voiceoverTimingRules = buildVoiceoverTimingDirective(durationSecondsClamped);

    // For stitched videos (>8s), we generate two Veo clips. The script must have a natural midpoint.
    const isStitchedDuration = durationSecondsClamped > 8;
    const midpointSeconds = isStitchedDuration ? Math.round(durationSecondsClamped / 2) : 0;

    const isPerformanceMode = !!(strategy || concept);
    const isHookMode = !isPerformanceMode && style === "Hook";
    const isCommercialMode = !isPerformanceMode && (style === "Commercial" || visualFormat === "Commercial");
    const isUGCMode = !isPerformanceMode && (style === "UGC Style" || visualFormat === "UGC");

    const frameworkId =
      concept?.frameworkId || strategy?.frameworkId || selectFrameworkForHook(hookType).id;
    const frameworkBeats = getFrameworkBeatsForDuration(frameworkId, durationSecondsClamped);

    const bodyProductSafety = buildBodyProductSafetyBlock(category, product_name, user_description);
    const contentSafetyRules = `${SCRIPT_CONTENT_SAFETY}${bodyProductSafety}`;

    const pipelineInstructions = buildScriptGenerationPipelineInstructions({
      productName: product_name,
      category,
      durationSeconds: durationSecondsClamped,
      campaignGoal,
      creativeFormat: visualFormat,
    });
    const envatoFormula = buildEnvatoCommercialDirective({
      tone: tone ? String(tone) : "Energetic",
      hookType,
      creativeFormat: visualFormat,
      keyMessage: key_message,
    });
    const directorPipeline = `${pipelineInstructions}\n\n${envatoFormula}`;

    // Calculate recommended scene count based on duration
    const recommendedScenes = durationSecondsClamped <= 6 ? 3 : durationSecondsClamped <= 8 ? 4 : durationSecondsClamped <= 12 ? 5 : Math.min(8, Math.ceil(durationSecondsClamped / 2.5));
    const minScenes = Math.max(3, recommendedScenes - 1);

    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      console.warn(
        "[creative-studio] GEMINI_API_KEY not set — using template script (add GEMINI_API_KEY for AI scripts)"
      );

      const adVoInput = {
        brandName: brand_name,
        productName: product_name,
        keyMessage: key_message,
        cta: cta || strategy?.cta,
        creativeStrategy: strategy || undefined,
        userDescription: user_description,
      };

      const templateVo = voiceover
        ? ensurePerformanceAdVoiceover(adVoInput, "", maxVoiceoverWords, minVoiceoverWords)
        : "";

      const sceneCount = recommendedScenes;
      const sceneDur = Math.round((durationSecondsClamped / sceneCount) * 10) / 10;
      const sceneDescriptions = [
        `Opening hook — close-up of ${product_name} with cinematic lighting, shallow depth of field, camera push-in`,
        `Product in context — medium shot showing ${product_name} in use, smooth dolly movement`,
        `Detail reveal — close-up of key product features, rack focus, premium lighting`,
        `Hero moment — ${product_name} centered with brand-defining composition, slow pull-out`,
        `Emotional payoff — outcome/transformation moment, warm tones, satisfying camera settle`,
        `Brand close — final hero frame on ${product_name}, aspirational atmosphere`,
      ];
      const emotions = ["Curiosity", "Interest", "Desire", "Aspiration", "Trust", "Satisfaction"];
      const motions = ["Slow push-in", "Smooth dolly right", "Rack focus pull", "Static hero frame", "Slow pull-out", "Gentle pan"];

      const voWords = templateVo ? templateVo.split(/\s+/) : [];
      const wordsPerScene = voWords.length > 0 ? Math.ceil(voWords.length / sceneCount) : 0;

      const storyboard = Array.from({ length: sceneCount }, (_, i) => {
        const startTime = Math.round(i * sceneDur * 10) / 10;
        const endTime = i === sceneCount - 1 ? durationSecondsClamped : Math.round((i + 1) * sceneDur * 10) / 10;
        return {
          scene: i + 1,
          duration: `${endTime - startTime}s`,
          time_range: `${startTime}-${endTime}s`,
          visual_description: sceneDescriptions[i % sceneDescriptions.length],
          on_screen_text: "",
          emotion: emotions[i % emotions.length],
          motion_style: motions[i % motions.length],
          voiceover_line:
            voWords.length > 0
              ? voWords.slice(i * wordsPerScene, (i + 1) * wordsPerScene).join(" ")
              : "",
        };
      });

      let voiceoverScript = templateVo;
      if (voiceover && storyboard.length) {
        voiceoverScript = ensurePerformanceAdVoiceover(adVoInput, templateVo, maxVoiceoverWords, minVoiceoverWords);
        redistributeVoiceoverToStoryboard(storyboard, voiceoverScript);
      }

      const scriptData = {
        ad_angle:
          strategy?.creativeAngle ||
          concept?.creativeAngle ||
          `Performance ad for ${product_name}`,
        storyboard,
        visual_style_guide: {
          color_palette: "Modern, premium",
          lighting_mood: "Cinematic",
          typography: "Modern sans-serif",
          motion_style: visualFormat === "UGC" ? "Handheld, natural" : "Smooth, minimal",
          brand_polish: "Premium brand quality",
        },
        voiceover_script: voiceoverScript,
        headline: "",
        subtext: "",
        final_video_prompt: `Create a ${durationSecondsClamped}-second ${visualFormat} product video for ${product_name} by ${brand_name}. ${user_description || key_message || "Showcase the product with cinematic quality, clear hero shots, and an emotional payoff."} No on-screen text. Fully clothed people only.`,
      };

      const creativeScore = scoreCreativeScript({
        strategy,
        storyboard: scriptData.storyboard,
        voiceoverScript: scriptData.voiceover_script,
        adAngle: scriptData.ad_angle,
      });

      return res.status(200).json({
        ok: true,
        script: scriptData,
        creative_score: creativeScore,
        score_passed: meetsCreativeThreshold(creativeScore),
        score_threshold: CREATIVE_SCORE_THRESHOLD,
        ai_enriched: false,
      });
    }

    // System prompt: Creative Ad Film Director — interprets user vision, duration, and needs to write the best script
    let systemPrompt: string;

    const stitchedMidpointRule = isStitchedDuration ? `
- TWO-CLIP MIDPOINT RULE (CRITICAL for ${durationSecondsClamped}s extended videos):
  This video will be rendered as TWO separate ~${midpointSeconds}s clips that are stitched together. You MUST design the storyboard so that:
  1. The scene closest to the ${midpointSeconds}s mark is a CLEAN CUT POINT — it ends on a complete action/beat (not mid-motion).
  2. The scene immediately after ${midpointSeconds}s starts a new shot/angle (match-cut, whip-pan exit, or new framing) so the stitch feels like a natural edit.
  3. Lighting, color grade, location, wardrobe, and product placement MUST stay consistent across both halves.
  4. The story should have a clear two-act structure: PART 1 (0–${midpointSeconds}s) = Hook + Setup + Product Introduction; PART 2 (${midpointSeconds}–${durationSecondsClamped}s) = Demonstration/Story + Emotional Payoff + CTA.
  5. Include "midpoint_cut_after_scene" in the output JSON set to the last scene number of PART 1.
  6. Do NOT end PART 1 on a cliffhanger mid-action — end on a resolved beat (product reveal, pause, smile, held shot).
  7. Start PART 2 with a new camera angle or slight location shift so the edit point feels motivated.` : '';

    const multiSceneEnforcement = `

CRITICAL — MULTI-SCENE STORYBOARD REQUIREMENT:
- You MUST generate AT LEAST ${minScenes} separate scenes in the storyboard array, ideally ${recommendedScenes} scenes.
- NEVER create a single scene covering the full duration. A storyboard with 1 scene is INVALID.
- Each scene should be 1–3 seconds long. Break the ${durationSecondsClamped}-second video into distinct visual beats.
- Each scene MUST have a unique visual_description — no two scenes should describe the same thing.
- Each scene MUST have a specific time_range like "0-2s", "2-4s", "4-6s" etc. Time ranges must be consecutive and non-overlapping.
- The storyboard array is the MOST IMPORTANT part of the output. Put maximum creative effort into each scene's marketing_message and visual_description.${stitchedMidpointRule}${contentSafetyRules}`;

    if (isPerformanceMode) {
      systemPrompt = `You are a senior performance marketing creative director at a top DTC agency.
You think like a strategist FIRST and a filmmaker second. Your ads must SELL, stop scrolls, increase watch time, and convert.

CREATIVE STRATEGY (source of truth — do not contradict):
${strategy ? JSON.stringify(strategy, null, 2) : "Infer from product and campaign goal."}
${concept ? `\nSELECTED AD CONCEPT:\n${JSON.stringify(concept, null, 2)}` : ""}

AD FRAMEWORK: ${formatFrameworkForPrompt(frameworkId)}
Required story beats in order: ${frameworkBeats.join(" → ")}

PERFORMANCE RULES:
- Each scene = ONE beat (Hook, Problem, Agitation, Solution, Proof, CTA, Demo, Benefit, etc.).
- marketing_message is PRIMARY. Visuals support the message — never the reverse.
- Scene 1 MUST stop the scroll within 2 seconds (pattern interrupt, curiosity, bold claim, or visual proof).
- Show product clearly by mid-ad. Demonstrate benefit, don't just show aesthetics.
- End with a specific CTA matched to campaign goal: ${campaignGoal}.
- Visual execution format: ${visualFormat}. Hook type: ${concept?.hookType || hookType}.
- Target audience: ${strategy?.targetAudience || audienceType}.
- NO on-screen text. Voiceover carries the sell — say brand + product together (e.g. "${brand_name} ${product_name}").
${voiceover ? `\n${AD_VOICEOVER_COPY_RULES}\n\n${voiceoverTimingRules}` : ""}
- If only one product image exists: mix lifestyle usage, close-up demo, benefit proof, and hero product ending — NOT only static product shots.
- Write like a performance agency: punchy, clear, conversion-focused.${multiSceneEnforcement}

${directorPipeline}`;
    } else if (isHookMode) {
      systemPrompt = `You are a performance-first ad creative director specializing in scroll-stopping, conversion-focused video ads. This is attention warfare, NOT cinematic storytelling.

Your mindset for HOOK MODE:
- Stop scrolling in the first 2 seconds. Trigger emotion immediately. Deliver fast product clarity. Drive action.
- No slow build-ups, no aesthetic intros, no brand logo fade-in first. No landscape establishing shots, no calm mood builds, no ambient product spins.
- Every 8-second video MUST follow this exact 4-part structure: 0–2s Pattern Interrupt → 2–4s Emotional Trigger → 4–6s Product Reveal → 6–8s Strong CTA.
- Emotion angle: prioritize one of Pain (problem amplification), Desire (aspiration/upgrade), Urgency (limited time), or Curiosity (unexpected visual setup).
- Product must appear clearly by mid-video (4–6s). No mysterious slow storytelling. This is ad logic, not art school.
- NO on-screen text: no captions, headlines, subtitles, overlays, or typography. 100% visual storytelling. If voiceover exists, it carries the message.
- Pacing: fast cuts, high motion energy, tight framing, strong contrast lighting. Hook always dominates tempo.
- Avoid: symbolic metaphors, overly artistic ambiguity, conceptual scenes without product clarity.${multiSceneEnforcement}

${directorPipeline}`;
    } else if (isCommercialMode) {
      systemPrompt = `You are a premium brand commercial director. The output must feel like a PAID BRAND COMMERCIAL — high-production value, emotion + aspiration driven, product as hero. Fast, punchy, visually premium. A direct-response brand commercial compressed into ${durationSecondsClamped} seconds.

COMMERCIAL THEME — This is NOT: UGC, meme content, cinematic storytelling short film, aesthetic montage without product focus.
This IS: A paid brand commercial. Script-driven via voiceover only. NO text overlays on video frames.

Your mindset:
- Product as hero: show product clearly within first 3 seconds. Product must appear in at least 60% of total frames.
- ${durationSecondsClamped}-second formula: 0–2s Pattern Interrupt (strong hook visual, movement, contrast) → 2–${Math.floor(durationSecondsClamped * 0.6)}s Product as Hero (clean product shots, close-ups, premium lighting) → ${Math.floor(durationSecondsClamped * 0.6)}–${durationSecondsClamped - 1}s Emotional Payoff (outcome, transformation) → ${durationSecondsClamped - 1}–${durationSecondsClamped}s Product hero close — NO on-screen text, strong closing VO.
${voiceover ? `\n${AD_VOICEOVER_COPY_RULES}\n\n${voiceoverTimingRules}` : ""}
- Voiceover: confident, clear, short sentences.
- Visual: controlled lighting, soft highlights, high contrast, studio or lifestyle premium look. Smooth camera (push-in, slider, cinematic pans). Shallow depth of field. NO handheld shaky shots, NO casual iPhone vlog style.
- Emotional angles: Confidence, Status, Relief, Energy, Control, Simplicity, Transformation. Never default to humor unless user explicitly requests.
- NO on-screen text, captions, subtitles, lower thirds, UI mockups, or typography. All messaging via voiceover only.${multiSceneEnforcement}

${directorPipeline}`;
    } else if (isUGCMode) {
      systemPrompt = `You are a UGC-style ad creative director. The output must feel like a REAL PERSON filmed this — shot on phone, casual, imperfect, believable. Native to Reels/Shorts/TikTok. Trust over perfection.

UGC THEME — This is NOT: studio commercial, perfect lighting, cinematic camera moves, dramatic product hero shots, polished ad energy.
This IS: A real person sharing an honest recommendation. Conversational, slightly messy but authentic.

Your mindset:
- ${durationSecondsClamped}-second formula: 0–2s Hook (spoken, direct, attention-grabbing, feels spontaneous — e.g. "Wait, why is nobody talking about this?") → 2–${durationSecondsClamped - 2}s Experience/Reaction (demonstration, personal comment, showing product casually, honest tone) → ${durationSecondsClamped - 2}–${durationSecondsClamped}s Soft CTA ("You should try this." "Link's right there." No hard sales pitch).
${voiceover ? `\n${AD_VOICEOVER_COPY_RULES}\n\n${voiceoverTimingRules}` : ""}
- Voiceover: casual, real, slightly imperfect. Max 20–30 words. First person: "I tried this", "This saved me". Everyday language. No marketing buzzwords. No scripted feel.
- Visual: handheld, slight natural shake, eye-level selfie angle, casual framing. Natural light, room light. Real-world setting (bedroom, kitchen, office, car, cafe). NO studio backdrop, NO perfect product turntable shots.
- Product: must appear within first 3 seconds OR be referenced clearly. Person holding/using/reacting to it. UGC is about the person, not product glamour.
- Emotional bias: Surprise, Relatability, Relief, Curiosity, Honest recommendation. NOT prestige, status, or brand dominance.
- Editing: jump cuts, natural pauses, reaction zoom, fast pacing. NO smooth cinematic transitions, NO dramatic slow motion.${multiSceneEnforcement}

${directorPipeline}`;
    } else {
      const extendedDirectorNote = isStitchedDuration ? `
- EXTENDED VIDEO (${durationSecondsClamped}s / two-clip stitch):
  This video will be rendered as two ~${midpointSeconds}s clips stitched into one. Design a clear TWO-ACT arc:
  • ACT 1 (0–${midpointSeconds}s): Hook → Product Introduction → Key Visual Setup. End on a resolved beat (hero product shot, a pause, or a held expression) — NOT mid-motion.
  • ACT 2 (${midpointSeconds}–${durationSecondsClamped}s): Start with a new camera angle/framing (match-cut, whip-pan, or slight location shift). Continue with Demonstration/Story → Emotional Payoff → Brand CTA.
  Maintain identical lighting, color grade, location, wardrobe, and product styling across both acts so the stitch is invisible.
  The midpoint must feel like a professional "motivated cut" — not a random jump.` : '';

      systemPrompt = `You are an award-winning creative ad film director. You think and write like one: story, emotion, rhythm, and every second on screen is intentional.

Your mindset:
- When the user describes their "Video Ad Vision," you interpret it like a creative brief. What do they really want? (e.g. trust, desire, urgency, aspiration, humor, premium feel.) Infer the emotional goal, the audience vibe, and the single idea the ad must land.
- Duration shapes the creative: ${durationSecondsClamped}s is your canvas. Short (5–6s) = one punchy idea, bold hook, no flab. Medium (7–8s) = setup + payoff, or a clear arc. Longer (9–16s) = you can build mood, a full story arc, or a twist with two clear acts. Design the script so the duration feels right for the vision — not padded, not rushed.
- The user's description is your North Star. Every shot, line, and beat should serve that vision and the product. No generic filler; make it feel bespoke to what they asked for.
- Use the language of film: wide, close-up, push-in, rack focus, dolly, cut on action, lighting (e.g. golden hour, high-key, silhouette). Think Tier-1 ad agency / film director — production-ready, cinematic.${extendedDirectorNote}

Your role:
- Take the user's ad vision and product details as your creative brief. Their vision is the soul of the film; the product is what you're selling.
- Write the entire script (shot plan, storyboard, voiceover) so it fits the chosen duration exactly. Every second is intentional.
- Plan scene-by-scene with precise timing that adds up to the total duration. No filler; every beat serves the idea and the user's described vision.
- Write voiceover as a complete conversational ad — ${minVoiceoverWords}–${maxVoiceoverWords} words (target ~${targetVoiceoverWords}), spoken within 5.5–${maxVoiceoverSeconds}s at natural pace (~${VOICEOVER_WORDS_PER_SECOND} words/sec). Last ${voTailSeconds}s must be silent for hero shot + music.
- Output must be production-ready, director-grade JSON only.

Rules:
- Total duration is exactly ${durationSecondsClamped} seconds. All shots and voiceover must fit this.
- Shot lengths and storyboard durations must sum to ${durationSecondsClamped}s. E.g. for ${durationSecondsClamped}s use ~${Math.max(2, Math.floor(durationSecondsClamped / 3))}–${Math.max(4, Math.ceil(durationSecondsClamped / 2))} shots.
- Voiceover script: ${minVoiceoverWords}–${maxVoiceoverWords} words (target ~${targetVoiceoverWords}), finish by ${maxVoiceoverSeconds}s. Last ${voTailSeconds}s silent for hero + music. Hook → brand+product → benefit → CTA.
- Avoid generic or templated lines. Reflect the user's vision and the product's story. The script should feel written for this brand, this product, and this specific vision.${multiSceneEnforcement}

${directorPipeline}`;
    }

    // Style-specific requirements appended to user prompt
    let styleRequirements = '';
    if (isHookMode) {
      const hookExtended = isStitchedDuration ? `
— EXTENDED ${durationSecondsClamped}s HOOK (two-clip stitch):
  PART 1 (0–${midpointSeconds}s): Pattern Interrupt → Emotional Trigger → Product Tease. End on a clear product reveal beat.
  PART 2 (${midpointSeconds}–${durationSecondsClamped}s): New angle → Product Demo/Proof → Urgency Build → Hard CTA.
  Each part has ${Math.ceil(recommendedScenes / 2)} scenes. Midpoint cut must feel like a fast, motivated edit.` : '';
      styleRequirements = `

HOOK MODE — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds exactly):
- Scene 1 (0–2s): PATTERN INTERRUPT — Bold visual hook. Stop scrolling. Fast cut, high impact. No slow intro.
- Scene 2 (2–4s): EMOTIONAL TRIGGER — Pain, Desire, Urgency, or Curiosity. High emotional tension.
- Scene 3 (4–6s): PRODUCT REVEAL — Product must appear clearly. Fast, direct. No mystery.
- Scene 4 (6–${isStitchedDuration ? midpointSeconds : durationSecondsClamped}s): ${isStitchedDuration ? 'PRODUCT HERO — Clear resolved beat, product fully visible. End of PART 1.' : 'STRONG CTA — Clear visual call-to-action moment.'}${hookExtended}

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe the exact shot, camera angle, lighting, subject.
visual_style_guide.motion_style must emphasize: fast cuts, high motion energy, tight framing, strong contrast.
NO on-screen text. Purely visual.`;
    } else if (isCommercialMode) {
      const commercialExtended = isStitchedDuration ? `
— EXTENDED ${durationSecondsClamped}s COMMERCIAL (two-clip stitch):
  PART 1 (0–${midpointSeconds}s): Hook → Product Introduction → Key Benefit. End on clean product hero shot.
  PART 2 (${midpointSeconds}–${durationSecondsClamped}s): New angle → Deeper Demo → Emotional Transformation → Brand CTA.
  Maintain identical studio lighting, color grade, and product placement across both parts.` : '';
      styleRequirements = `

COMMERCIAL THEME — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds):
- Scene 1 (0–2s): PATTERN INTERRUPT — Strong hook visual, movement, contrast, emotion. Product tease or problem tease.
- Scene 2 (2–4s): PRODUCT AS HERO — Clean product shots, close-up details, use-case in action. Premium lighting.
- Scene 3 (4–6s): PRODUCT IN ACTION — Dynamic camera movement, product demonstration, lifestyle context.
- Scene 4 (6–${isStitchedDuration ? midpointSeconds : durationSecondsClamped}s): ${isStitchedDuration ? 'PART 1 CLOSE — Product hero frame, resolved beat. Clean exit for stitch.' : 'EMOTIONAL PAYOFF + BRAND LOCK-IN — Outcome transformation, product hero frame.'}${commercialExtended}

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe the exact shot, camera angle, lighting, subject.
visual_style_guide: controlled lighting, soft highlights, high contrast, smooth camera (push-in, slider, cinematic pans), shallow depth of field.
Voiceover: ${minVoiceoverWords}–${maxVoiceoverWords} words, finish by ${maxVoiceoverSeconds}s (last ${voTailSeconds}s silent). Confident, clear. Hook → brand+product → benefit → CTA.
NO on-screen text, captions, or typography. Purely visual + voiceover.`;
    } else if (isUGCMode) {
      const ugcExtended = isStitchedDuration ? `
— EXTENDED ${durationSecondsClamped}s UGC (two-clip stitch):
  PART 1 (0–${midpointSeconds}s): Hook → First Impression → Initial Reaction. End on a natural pause/beat (person looks at camera, holds product up).
  PART 2 (${midpointSeconds}–${durationSecondsClamped}s): Jump-cut to new angle → Deeper experience/demo → Honest verdict → Soft CTA.
  Same person, same room, same lighting. The jump-cut at the midpoint should feel like a natural UGC edit.` : '';
      styleRequirements = `

UGC THEME — MANDATORY ${recommendedScenes}-SCENE STRUCTURE (${durationSecondsClamped} seconds):
- Scene 1 (0–2s): HOOK (spoken) — Direct, attention-grabbing. Feels spontaneous. e.g. "Wait, why is nobody talking about this?"
- Scene 2 (2–4s): FIRST IMPRESSION — Unboxing, first look, initial reaction. Genuine surprise or curiosity.
- Scene 3 (4–6s): EXPERIENCE / DEMO — Showing product in use, personal commentary. Honest, relatable.
- Scene 4 (6–${isStitchedDuration ? midpointSeconds : durationSecondsClamped}s): ${isStitchedDuration ? 'PAUSE BEAT — Person pauses, holds product, looks at camera. Natural resting point for Part 1.' : 'SOFT CTA — "You should try this." "I\'m not going back." No hard sales pitch.'}${ugcExtended}

Storyboard MUST have exactly ${recommendedScenes} scenes with consecutive non-overlapping time_range values.
Each scene MUST have a UNIQUE, SPECIFIC visual_description — describe what the person is doing, their expression, the setting.
visual_style_guide: handheld, slight natural shake, eye-level selfie angle, natural light, real-world setting (bedroom, kitchen, office).
Voiceover: ${minVoiceoverWords}–${maxVoiceoverWords} words, finish by ${maxVoiceoverSeconds}s (last ${voTailSeconds}s silent). Casual, conversational, first person. Hook → brand+product → benefit → CTA.
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

CONTENT SAFETY (mandatory — every shot must comply):
${SCRIPT_CONTENT_SAFETY.trim()}
${bodyProductSafety.trim()}

DIRECTOR REQUIREMENTS:
${isPerformanceMode ? `- BEAT-BASED STORYBOARD (NOT scene-only): Plan beats first — Hook → Problem → Discovery → Product → Transformation → Payoff — then place shots under each beat.
- Each scene MUST include: beat, marketing_message, visual_description, shot_purpose, emotional_zone, transition_to_next, product_state, container_state, voiceover_line, dialogue_direction.
- PERFORMANCE STORYBOARD: Each scene MUST include "beat" (${frameworkBeats.join(", ")}) and "marketing_message" (the sell — PRIMARY). Visuals support the message.
- Scene 1 beat MUST be Hook. Final scene beat MUST be CTA/Payoff.
- Include proof_element on Proof/Social Proof beats when applicable.
- EDITOR BRAIN: Delete any shot whose only purpose is "looks cool". Every shot must advance story, reveal product, build emotion, create proof, or deliver payoff.
- PRODUCT INTERACTION: Track container/product/liquid/food state — no oil from closed bottles, no powder from sealed packets.
- DIALOGUE: Hook in first 2s, natural pauses, specific benefits, proof lines, clear CTA — never generic AI ad copy.
` : `- BEAT-BASED STORYBOARD: Hook → Problem → Discovery → Product → Transformation → Payoff. Each scene needs beat, shot_purpose, emotional_zone, transition_to_next, product_state, container_state, dialogue_direction.
`}- Create a shot-by-shot plan with EXACTLY ${recommendedScenes} shots (minimum ${minScenes}). NEVER use a single shot for the entire duration.
- Each shot: 1–3 seconds. Time ranges must be consecutive like "0-2s", "2-4s", "4-6s", "6-8s". They must sum to ${durationSecondsClamped}s.
- Each shot MUST have a unique, specific visual description — not generic. Describe exact camera angle, subject position, lighting setup, and composition.
- Specify camera (angle, movement), lighting, and composition for each shot.
- Voiceover (if enabled): write a script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"} — ${minVoiceoverWords}–${maxVoiceoverWords} words (target ~${targetVoiceoverWords}), finish by ${maxVoiceoverSeconds}s at ~${VOICEOVER_WORDS_PER_SECOND} words/sec. Last ${voTailSeconds}s must be silent. Never write only 3–5 words.${isStitchedDuration ? `
  CRITICAL FOR ${durationSecondsClamped}s EXTENDED VIDEO:
  - The voiceover must tell a COMPLETE story across the full ${durationSecondsClamped} seconds — NOT just an 8-second script repeated.
  - Distribute voiceover_line across ALL ${recommendedScenes} scenes. The first half of scenes (Part 1, 0–${midpointSeconds}s) gets the setup/hook voiceover; the second half (Part 2, ${midpointSeconds}–${durationSecondsClamped}s) gets the payoff/CTA voiceover.
  - voiceover_script must be the FULL narration for all ${durationSecondsClamped} seconds combined (${minVoiceoverWords}–${maxVoiceoverWords} words / finish by ${maxVoiceoverSeconds}s).
  - Each 8s clip half must also finish its spoken lines by 7s with 1s silent tail.
  - Do NOT write the same lines for both halves. Each scene's voiceover_line must be unique and progress the story.` : ` Speech must finish by ${maxVoiceoverSeconds}s — last ${voTailSeconds}s is silent hero + music.`} ${key_message ? `Weave in: "${key_message}".` : ""} ${cta ? `End with CTA: "${cta}".` : ""}
- final_video_prompt: 300–800 tokens, director-grade, describing the full ${durationSecondsClamped}-second film (cinematic lighting, movement, pacing, color, premium brand quality), aligned with the user's described vision. Include specific lens choices, lighting setup, color grade, cut types, and sound mood — write like a Tier-1 agency shoot brief. Do NOT include headline, subtext, captions, or any on-screen typography instructions — voiceover lives in voiceover_script only.${isStitchedDuration ? " For 16s: both clip halves must be strictly zero-text." : ""}
${styleRequirements}

Return your response as a JSON object with this exact structure. The storyboard MUST have ${recommendedScenes} scenes (minimum ${minScenes}):
{
  "ad_angle": "The creative angle and hook, inspired by the user's vision and product (1-2 lines)",${isStitchedDuration ? `\n  "midpoint_cut_after_scene": <number — the last scene of PART 1, i.e. the scene that ends closest to ${midpointSeconds}s>,` : ''}
  "shot_plan": [
    { "time": "0-2s", "description": "Shot 1 description with camera, lighting, composition" },
    { "time": "2-4s", "description": "Shot 2 description — MUST be different from shot 1" },
    { "time": "4-6s", "description": "Shot 3 description — MUST be different from shots 1-2" },
    { "time": "6-${isStitchedDuration ? midpointSeconds : durationSecondsClamped}s", "description": "Shot 4 description — MUST be different from shots 1-3" }${isStitchedDuration ? `,
    { "time": "${midpointSeconds}-${midpointSeconds + 2}s", "description": "Shot 5 (PART 2 opens) — NEW angle/framing after the midpoint cut, match-cut or whip-pan from end of Part 1" },
    { "time": "${midpointSeconds + 2}-${midpointSeconds + 4}s", "description": "Shot 6 — different from shot 5, progress the Part 2 story" },
    { "time": "${midpointSeconds + 4}-${durationSecondsClamped - 2}s", "description": "Shot 7 — emotional payoff, product benefit in action" },
    { "time": "${durationSecondsClamped - 2}-${durationSecondsClamped}s", "description": "Shot 8 — CTA / brand lock-in, final hero frame" }` : ''}
  ],
  "storyboard": [
    {
      "scene": 1,
      "beat": "Hook",
      "duration": "2s",
      "time_range": "0-2s",
      "marketing_message": "Scroll-stopping hook — the core pain or curiosity",
      "visual_description": "SPECIFIC director-grade visual: camera angle, subject, lighting, composition. NOT generic.",
      "shot_purpose": "Stop scroll / open loop",
      "emotional_zone": "Curiosity (0-20%)",
      "transition_to_next": "Match Cut or Object Continuity into next beat",
      "product_state": "Not yet introduced OR idle on surface",
      "container_state": "Sealed / Closed",
      "on_screen_text": "",
      "emotion": "Curiosity",
      "motion_style": "Specific camera move (e.g., Slow push-in, Rack focus, Static wide)",
      "voiceover_line": "Hook line — punchy, spoken within 2s, pattern interrupt",
      "dialogue_direction": "Confident, direct, slightly urgent — not robotic"
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
      "time_range": "6-${isStitchedDuration ? midpointSeconds : durationSecondsClamped}s",
      "visual_description": "${isStitchedDuration ? 'END OF PART 1 — Resolved beat: product hero shot, held frame, or pause. Must feel complete (not mid-action). This is where Clip 1 ends.' : 'Final beat. Product hero / CTA moment. Distinct from all prior scenes.'}",
      "on_screen_text": "",
      "emotion": "Closing emotion${isStitchedDuration ? ' for Part 1' : ''}",
      "motion_style": "${isStitchedDuration ? 'Camera settles or holds — clean exit frame for stitch point' : 'Closing camera style'}",
      "voiceover_line": "${isStitchedDuration ? 'Voiceover line that completes a thought (not left hanging)' : 'Closing voiceover line'}"
    }${isStitchedDuration ? `,
    {
      "scene": 5,
      "duration": "2s",
      "time_range": "${midpointSeconds}-${midpointSeconds + 2}s",
      "visual_description": "START OF PART 2 — New camera angle or slight location shift. Match-cut or whip-pan from Part 1 ending. Same lighting/grade/product but fresh framing.",
      "on_screen_text": "",
      "emotion": "Renewed energy / curiosity",
      "motion_style": "New camera move that motivates the cut (match-cut, whip-pan entry, rack focus to new subject)",
      "voiceover_line": "Voiceover picks up naturally from Part 1"
    },
    {
      "scene": 6,
      "duration": "2s",
      "time_range": "${midpointSeconds + 2}-${midpointSeconds + 4}s",
      "visual_description": "Product demonstration or story progression — different from scene 5",
      "on_screen_text": "",
      "emotion": "Engagement / desire",
      "motion_style": "Dynamic camera for energy",
      "voiceover_line": "Continue the story"
    },
    {
      "scene": 7,
      "duration": "2s",
      "time_range": "${midpointSeconds + 4}-${durationSecondsClamped - 2}s",
      "visual_description": "Emotional payoff — transformation, benefit, or outcome moment",
      "on_screen_text": "",
      "emotion": "Satisfaction / aspiration",
      "motion_style": "Cinematic payoff movement",
      "voiceover_line": "Emotional payoff line"
    },
    {
      "scene": 8,
      "duration": "2s",
      "time_range": "${durationSecondsClamped - 2}-${durationSecondsClamped}s",
      "visual_description": "Product hero final frame on clean background — NO text, NO typography, strong closing composition",
      "on_screen_text": "",
      "emotion": "Trust / confidence",
      "motion_style": "Slow settle or static hero frame",
      "voiceover_line": "Final CTA voiceover"
    }` : ''}
  ],
  "visual_style_guide": {
    "color_palette": "Color palette",
    "lighting_mood": "Lighting mood",
    "typography": "Typography",
    "motion_style": "Overall motion",
    "brand_polish": "Brand polish (premium category-leading quality)"
  },
  "voiceover_script": "${voiceover ? `Full ad script in ${language === "tamil" ? "Tamil" : language === "hindi" ? "Hindi" : "English"}. MUST say brand + product together as one phrase (e.g. "${brand_name} ${product_name}"), state one specific benefit, end with CTA. ${minVoiceoverWords}–${maxVoiceoverWords} words (target ~${targetVoiceoverWords}) — finish by ${maxVoiceoverSeconds}s (last ${voTailSeconds}s silent). Complete conversational sentences, not fragments. ${tone || "Energetic"} tone.` : "N/A - Voiceover disabled"}",
  "headline": "",
  "subtext": "",
  "final_video_prompt": "Director-grade Veo production brief (400-900 tokens) for the full ${durationSecondsClamped}-second film. Write like a premium agency shoot call sheet condensed into one prompt. MUST include: (1) OVERALL VISION — one sentence emotional goal; (2) COLOR GRADE — specific film-grade look (e.g. warm premium print-film feel, cool high-contrast studio look, bright high-key white); (3) LENS & CAMERA — specific focal lengths and moves per act (e.g. 35mm dolly push-in, 100mm macro rack focus); (4) LIGHTING SETUP — key/fill/rim description, motivated sources; (5) SHOT SEQUENCE — timed beats with cut types (match cut, whip-pan, hard cut on action); (6) SOUND MOOD — music genre/tempo, foley texture; (7) PRODUCT HERO MOMENT — exact frame composition for the closing shot; (8) CONTENT SAFETY — all people fully clothed, modest mainstream brand ad (no nudity, no revealing attire, no bare chest).${isStitchedDuration ? ' IMPORTANT: Two ~' + midpointSeconds + 's clips stitched. Describe ONE consistent visual world. Midpoint = motivated professional edit cut.' : ''} CRITICAL: STRICT ZERO on-screen text — no captions, slogans, floating brand typography, flavor callouts, or end-card words. Brand and product names in voiceover ONLY. Purely visual product shots + spoken ad."
}

IMPORTANT — STORYBOARD VALIDATION:
- The storyboard array MUST contain ${recommendedScenes} scene objects (minimum ${minScenes}). A storyboard with only 1 scene is REJECTED.
- Each scene's time_range must be consecutive: "0-2s", "2-4s", "4-6s", "6-8s" etc.
- Each scene's visual_description must be UNIQUE and SPECIFIC — not a copy of the final_video_prompt or a generic summary.
- shot_plan and storyboard durations must cover 0 to ${durationSecondsClamped} seconds total.
- final_video_prompt must describe the entire ${durationSecondsClamped}-second film with rich cinematic language.${isStitchedDuration ? `
- midpoint_cut_after_scene MUST be set to the scene number whose time_range ends at or closest to ${midpointSeconds}s. This is where Clip 1 ends and Clip 2 begins.
- The scene at the midpoint must END on a resolved visual beat. The scene after must START with a new angle/framing.
- Lighting, color grade, location, wardrobe, and product must be IDENTICAL across both halves — the stitch must be invisible.` : ''}
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
        max_output_tokens: isStitchedDuration ? 6000 : 4000,
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
          "x-goog-api-key": geminiKey,
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
      const headline = extractField(generatedText, "headline") || "";
      const subtext = extractField(generatedText, "subtext") || "";
      const voiceoverText = extractField(generatedText, "voiceover_script") || "";
      const finalPrompt = extractField(generatedText, "final_video_prompt") || "";
      
      // Fallback: create a structured multi-scene response
      const fallbackVo =
        voiceoverText ||
        (voiceover
          ? ensurePerformanceAdVoiceover(
              {
                brandName: brand_name,
                productName: product_name,
                keyMessage: key_message,
                cta,
                creativeStrategy: strategy || undefined,
                userDescription: user_description,
              },
              "",
              maxVoiceoverWords,
              minVoiceoverWords
            )
          : "");
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

    // Enforce voiceover word limits so Veo native audio finishes cleanly (prevents mid-word cutoffs)
    if (voiceover) {
      const adVoInput = {
        brandName: brand_name,
        productName: product_name,
        keyMessage: key_message,
        cta: cta || strategy?.cta,
        creativeStrategy: strategy || undefined,
        userDescription: user_description,
      };

      if (scriptData.voiceover_script) {
        scriptData.voiceover_script = ensurePerformanceAdVoiceover(
          adVoInput,
          String(scriptData.voiceover_script),
          maxVoiceoverWords,
          minVoiceoverWords
        );
      } else if (scriptData.storyboard?.length) {
        const joined = scriptData.storyboard
          .map((s: any) => String(s.voiceover_line || s.voiceover_script || "").trim())
          .filter(Boolean)
          .join(" ");
        scriptData.voiceover_script = ensurePerformanceAdVoiceover(
          adVoInput,
          joined,
          maxVoiceoverWords,
          minVoiceoverWords
        );
      } else {
        scriptData.voiceover_script = ensurePerformanceAdVoiceover(
          adVoInput,
          "",
          maxVoiceoverWords,
          minVoiceoverWords
        );
      }

      if (scriptData.storyboard?.length) {
        scriptData.storyboard = redistributeVoiceoverToStoryboard(
          scriptData.storyboard,
          scriptData.voiceover_script
        );
      }

      const voValidation = validateVoiceoverCommercial(scriptData.voiceover_script, {
        ...adVoInput,
        minWords: minVoiceoverWords,
        maxWords: maxVoiceoverWords,
        maxSpokenSeconds: maxVoiceoverSeconds,
      });
      if (!voValidation.valid) {
        console.warn("Voiceover validation issues:", voValidation.issues, voValidation.missing);
      }
    }

    const creativeScore = scoreCreativeScript({
      strategy,
      storyboard: scriptData.storyboard,
      voiceoverScript: scriptData.voiceover_script,
      adAngle: scriptData.ad_angle,
    });

    return res.status(200).json({
      ok: true,
      script: scriptData,
      creative_score: creativeScore,
      score_passed: meetsCreativeThreshold(creativeScore),
      score_threshold: CREATIVE_SCORE_THRESHOLD,
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
