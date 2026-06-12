/** Shared helpers for Veo video generation prompts and voiceover pacing. */

export const VEO_SEGMENT_SECONDS = 8;
export const SEGMENT_SECONDS = VEO_SEGMENT_SECONDS;
export const VEO_ALLOWED_DURATIONS = [4, 6, 8] as const;
export type VeoDuration = (typeof VEO_ALLOWED_DURATIONS)[number];

export type StoryboardScene = {
  scene?: number;
  time_range?: string;
  duration?: string;
  visual_description?: string;
  emotion?: string;
  motion_style?: string;
  voiceover_line?: string;
  voiceover_script?: string;
};

export type StyleDirectorSpec = {
  role: string;
  aesthetic: string;
  cinematography: string;
  lighting: string;
  pacing: string;
  lensFeel: string;
  references: string;
};

export type VeoPromptInput = {
  brandName?: string;
  productName?: string;
  style?: string;
  clipDurationSeconds: number;
  totalDurationSeconds?: number;
  aspectRatio: string;
  segmentIndex?: number;
  segmentCount?: number;
  finalVideoPrompt?: string;
  fallbackPrompt?: string;
  voiceoverScript?: string;
  storyboard?: StoryboardScene[];
  hasReferenceImages: boolean;
  headline?: string;
  subtext?: string;
};

/** Map requested duration to a Veo-supported clip length (4, 6, or 8). Reference-image mode requires 8s. */
export function normalizeVeoDuration(
  requestedSeconds: number,
  hasReferenceImages = false
): VeoDuration {
  if (hasReferenceImages) return 8;
  const clamped = Math.max(4, Math.min(8, Math.round(requestedSeconds)));
  if (clamped <= 5) return 4;
  if (clamped <= 7) return 6;
  return 8;
}

/** Voiceover budget: leave ~2s at the end for music + hero frame so speech is not cut off. */
export function computeVoiceoverBudget(durationSeconds: number): {
  maxSpokenSeconds: number;
  maxWords: number;
  tailSilenceSeconds: number;
} {
  const duration = Math.max(4, Math.min(120, durationSeconds));
  const tailSilenceSeconds = duration <= 8 ? 2 : 1.5;
  const maxSpokenSeconds = Math.max(
    3,
    Math.min(Math.floor(duration - tailSilenceSeconds), duration <= 8 ? 6 : 15)
  );
  const maxWords = Math.floor(maxSpokenSeconds * 2.2);
  return { maxSpokenSeconds, maxWords, tailSilenceSeconds };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Trim voiceover to max words; prefer keeping full sentences when possible. */
export function truncateVoiceover(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;

  const sentences = trimmed
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    let result = "";
    for (const sentence of sentences) {
      const candidate = result ? `${result} ${sentence}` : sentence;
      if (countWords(candidate) <= maxWords) {
        result = candidate;
      } else {
        break;
      }
    }
    if (result) return result;
  }

  return words.slice(0, maxWords).join(" ");
}

/** Split voiceover into two halves by word count (for stitched 16s videos). */
export function splitVoiceoverForStitch(
  script: string,
  maxWordsPerHalf: number
): { part1: string; part2: string } {
  const trimmed = script.trim();
  if (!trimmed) return { part1: "", part2: "" };

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWordsPerHalf) {
    return { part1: trimmed, part2: "" };
  }

  const midpoint = Math.ceil(words.length / 2);

  const textUpToMid = words.slice(0, midpoint).join(" ");
  const lastSentenceEnd = Math.max(
    textUpToMid.lastIndexOf(". "),
    textUpToMid.lastIndexOf("! "),
    textUpToMid.lastIndexOf("? ")
  );
  if (lastSentenceEnd > 0) {
    const part1Candidate = textUpToMid.slice(0, lastSentenceEnd + 1).trim();
    if (part1Candidate && countWords(part1Candidate) <= maxWordsPerHalf) {
      return {
        part1: part1Candidate,
        part2: words.slice(countWords(part1Candidate)).join(" "),
      };
    }
  }

  return {
    part1: words.slice(0, midpoint).join(" "),
    part2: words.slice(midpoint).join(" "),
  };
}

export function redistributeVoiceoverToStoryboard<
  T extends { voiceover_line?: string; voiceover_script?: string }
>(storyboard: T[], voiceoverScript: string): T[] {
  const script = voiceoverScript.trim();
  if (!storyboard.length) return storyboard;

  const words = script ? script.split(/\s+/).filter(Boolean) : [];
  if (!words.length) {
    return storyboard.map((scene) => ({
      ...scene,
      voiceover_line: "",
      voiceover_script: "",
    }));
  }

  const wordsPerScene = Math.max(1, Math.ceil(words.length / storyboard.length));
  return storyboard.map((scene, idx) => {
    const line = words.slice(idx * wordsPerScene, (idx + 1) * wordsPerScene).join(" ");
    return {
      ...scene,
      voiceover_line: line,
      voiceover_script: line,
    };
  });
}

function parseSceneTimeRange(timeRange: string): { start: number; end: number } | null {
  const match = timeRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
}

/** Return storyboard scenes that fall within a clip segment (for stitched videos). */
export function filterStoryboardForSegment(
  storyboard: StoryboardScene[] | undefined,
  segmentIndex: number,
  segmentDurationSeconds: number
): StoryboardScene[] {
  if (!storyboard?.length) return [];
  const segStart = segmentIndex * segmentDurationSeconds;
  const segEnd = segStart + segmentDurationSeconds;

  return storyboard.filter((scene) => {
    const range = scene.time_range || "";
    const parsed = parseSceneTimeRange(range);
    if (!parsed) return segmentIndex === 0;
    const midpoint = (parsed.start + parsed.end) / 2;
    return midpoint >= segStart && midpoint < segEnd;
  });
}

/** Director-grade style specs — Tier-1 commercial / ad film level. */
export const VIDEO_STYLE_DIRECTOR_SPECS: Record<string, StyleDirectorSpec> = {
  Hook: {
    role: "Performance creative director — scroll-stopping direct response",
    aesthetic: "High-contrast, punchy, conversion-first. Every frame sells.",
    cinematography: "Tight framing, snap zooms, whip-pans, macro product inserts, handheld energy on hooks",
    lighting: "Hard key light, strong rim, high contrast, bold shadows — never flat or ambient",
    pacing: "Fast cuts every 1–2s. Zero dead air. Hook in frame 1.",
    lensFeel: "35mm wide for impact shots, 85mm macro for product detail",
    references: "TikTok performance ads, DTC scroll-stoppers, high-CTR social commerce",
  },
  Commercial: {
    role: "Premium brand film director — broadcast-quality paid media",
    aesthetic: "Polished, aspirational, product-as-hero. Feels like a Super Bowl spot compressed.",
    cinematography: "Slider dolly moves, slow push-ins, rack focus reveals, hero product orbit, controlled pans",
    lighting: "Three-point studio lighting, soft highlights, controlled specular on product, clean whites",
    pacing: "Confident rhythm: hook → demo → payoff → brand lock. Motivated cuts on beats.",
    lensFeel: "50mm natural perspective for lifestyle, 100mm macro for product texture, shallow T1.8 DOF",
    references: "Apple product films, Nike brand spots, premium DTC broadcast ads",
  },
  "UGC Style": {
    role: "Native social creator director — authentic, not polished",
    aesthetic: "Phone-filmed realism. Imperfect but believable. Trust-first.",
    cinematography: "Selfie angle, slight handheld shake, jump cuts, reaction zooms, POV product handling",
    lighting: "Natural window light or room light — never studio-polished",
    pacing: "Conversational rhythm with jump-cut energy. Feels unscripted.",
    lensFeel: "Phone camera wide (~24mm equivalent), eye-level, arm's length",
    references: "TikTok creator reviews, authentic Reels testimonials",
  },
  "Product Close-up": {
    role: "Product cinematographer — texture, detail, craft",
    aesthetic: "Macro beauty shots. Product is sculpture. Every surface tells quality.",
    cinematography: "Extreme close-ups, slow orbit, rack focus across product features, detail inserts",
    lighting: "Soft box key, gradient backdrop, controlled reflections, highlight roll-off on edges",
    pacing: "Deliberate, luxurious. Let each detail breathe 1–2s before cut.",
    lensFeel: "100mm macro, T2.8 shallow DOF, creamy bokeh background",
    references: "Luxury watch/jewelry commercials, Apple product macro films",
  },
  Lifestyle: {
    role: "Lifestyle film director — human stories around the product",
    aesthetic: "Warm, relatable, aspirational everyday moments. Product integrated naturally.",
    cinematography: "Medium shots in real environments, follow-cam, over-shoulder, golden-hour exteriors",
    lighting: "Natural golden hour or soft window light, warm color temperature (~4800K)",
    pacing: "Flowing narrative arc. Emotional build to product moment.",
    lensFeel: "35mm documentary feel, natural depth, gentle movement",
    references: "Aspirational lifestyle brand films, Patagonia-style human stories",
  },
  Cinematic: {
    role: "Cinematic film director — narrative-driven visual poetry",
    aesthetic: "Film-grade production. Anamorphic feel. Story through light and motion.",
    cinematography: "Crane shots, slow dolly, dramatic reveals, silhouette moments, depth layering",
    lighting: "Motivated cinematic lighting, volumetric rays, chiaroscuro contrast, color-motivated gels",
    pacing: "Deliberate build with emotional crescendo. Cuts serve story beats.",
    lensFeel: "Anamorphic 2.39:1 feel, 35mm/50mm spherical, lens flare on highlights",
    references: "Tier-1 brand films, Ridley Scott aesthetic, high-end automotive spots",
  },
  Luxury: {
    role: "Luxury brand director — exclusivity, refinement, desire",
    aesthetic: "Understated opulence. Slow confidence. Every frame whispers premium.",
    cinematography: "Static hero compositions, imperceptibly slow push-ins, elegant reveals",
    lighting: "Low-key elegant lighting, warm gold accents, deep shadows, silk-smooth gradients",
    pacing: "Slow, deliberate. Minimum 2s per shot. Never rushed.",
    lensFeel: "85mm portrait compression, T1.4 ultra-shallow DOF, creamy falloff",
    references: "Chanel, Rolex, high-fashion brand films",
  },
  Minimalist: {
    role: "Minimal design director — restraint as power",
    aesthetic: "Clean negative space. Product isolated. Zero visual noise.",
    cinematography: "Centered compositions, slow subtle moves, geometric framing",
    lighting: "High-key soft light, white/neutral backgrounds, single soft shadow",
    pacing: "Calm, measured. Long holds. Breathing room between beats.",
    lensFeel: "50mm straight-on, deep focus, clinical precision",
    references: "Muji, Apple minimal product films, Scandinavian design ads",
  },
  "Bold & Energetic": {
    role: "High-energy sports/ad director — maximum visual impact",
    aesthetic: "Kinetic, vibrant, adrenaline. Colors pop. Motion never stops.",
    cinematography: "Whip-pans, speed ramps, dutch angles, rapid match cuts, dynamic tracking",
    lighting: "Saturated colors, bold gel accents, high energy contrast",
    pacing: "Sub-1.5s cuts. Relentless forward momentum. Beat-synced editing.",
    lensFeel: "24mm wide for impact, fast shutter for crisp motion",
    references: "Red Bull, energy drink spots, festival/event promos",
  },
  "2D Animation": {
    role: "Animation director — illustrated brand storytelling",
    aesthetic: "Clean vector/flat illustration. Expressive motion graphics storytelling.",
    cinematography: "Smooth animated camera pans, scale transitions, parallax layers",
    lighting: "Illustrated light/shadow, gradient backgrounds, stylized highlights",
    pacing: "Snappy animated beats. Squash-and-stretch on transitions.",
    lensFeel: "N/A — flat/2.5D illustrated perspective",
    references: "Premium motion design reels, animated explainer spots",
  },
  "Motion Graphics": {
    role: "Motion design director — design-forward kinetic visuals",
    aesthetic: "Graphic elements, shape transitions, dynamic visual flow. No live-action.",
    cinematography: "Element-driven camera, zoom-through transitions, particle reveals",
    lighting: "Neon accents, gradient backgrounds, glow effects",
    pacing: "Rhythmic, design-synced. Every transition is intentional.",
    lensFeel: "N/A — graphic/3D camera space",
    references: "Tech brand launch videos, SaaS product motion reels",
  },
  Retro: {
    role: "Vintage film director — nostalgic analog warmth",
    aesthetic: "Film grain, faded colors, VHS/analog artifacts, nostalgic mood",
    cinematography: "Static or gentle handheld, period-appropriate framing",
    lighting: "Warm tungsten, soft halation, lifted blacks, faded highlights",
    pacing: "Relaxed vintage rhythm. Longer holds with grain texture.",
    lensFeel: "Vintage 50mm soft focus, slight vignette, chromatic aberration",
    references: "80s/90s commercial aesthetic, analog film nostalgia ads",
  },
  "Stop Motion": {
    role: "Stop-motion animation director — tactile craft",
    aesthetic: "Physical, handcrafted feel. Frame-by-frame charm.",
    cinematography: "Locked camera, subtle frame-by-frame object movement",
    lighting: "Even studio lighting, soft shadows, craft-table aesthetic",
    pacing: "Playful stop-motion rhythm. Satisfying object transitions.",
    lensFeel: "50mm tabletop macro perspective",
    references: "Premium stop-motion product ads, handcrafted brand films",
  },
  "3D Animation": {
    role: "CGI director — photoreal or stylized 3D product world",
    aesthetic: "Polished CGI environments. Product as 3D hero asset.",
    cinematography: "Virtual camera orbit, fly-through, particle simulations",
    lighting: "HDRI studio lighting, caustics, realistic material shaders",
    pacing: "Cinematic CGI reveal sequence with build-up.",
    lensFeel: "Virtual 35mm with depth of field pass",
    references: "Premium 3D product renders, tech launch CGI films",
  },
};

const DEFAULT_STYLE_SPEC: StyleDirectorSpec = {
  role: "Award-winning commercial film director",
  aesthetic: "Broadcast-quality brand film. Premium, intentional, every frame composed.",
  cinematography: "Professional multi-shot edit with motivated cuts, dolly/slider moves, rack focus",
  lighting: "Controlled three-point or motivated natural light, consistent color grade",
  pacing: "Clear narrative arc: hook → product → payoff → brand lock-in",
  lensFeel: "35mm/50mm cinematic perspective, shallow DOF on product hero moments",
  references: "Tier-1 agency brand films, premium DTC commercials",
};

export function getStyleDirectorSpec(style?: string): StyleDirectorSpec {
  if (!style) return DEFAULT_STYLE_SPEC;
  return VIDEO_STYLE_DIRECTOR_SPECS[style] || DEFAULT_STYLE_SPEC;
}

export function buildShotByShotBlock(
  storyboard: StoryboardScene[] | undefined,
  clipDurationSeconds: number,
  segmentOffsetSeconds = 0
): string {
  if (!storyboard?.length) return "";

  const lines = storyboard
    .map((scene, idx) => {
      const timeRange = scene.time_range || `${segmentOffsetSeconds + idx * 2}-${segmentOffsetSeconds + (idx + 1) * 2}s`;
      const visual = scene.visual_description?.trim();
      if (!visual) return null;

      const parts = [
        `  Shot ${scene.scene ?? idx + 1} [${timeRange}]: ${visual}`,
      ];
      if (scene.motion_style?.trim()) parts.push(`    Camera: ${scene.motion_style.trim()}`);
      if (scene.emotion?.trim()) parts.push(`    Emotion: ${scene.emotion.trim()}`);
      const vo = (scene.voiceover_line || scene.voiceover_script || "").trim();
      if (vo) parts.push(`    VO line: "${vo}"`);

      return parts.join("\n");
    })
    .filter(Boolean);

  if (!lines.length) return "";

  return `
SHOT-BY-SHOT DIRECTOR'S BREAKDOWN (${clipDurationSeconds}s — execute EXACTLY this edit):
${lines.join("\n")}

Execute each shot at its time_range. Cut on action between shots. Do NOT collapse into a single continuous take.
`.trim();
}

export function buildSoundDesignBlock(hasVoiceover: boolean, clipDurationSeconds: number): string {
  const tailStart = Math.max(0, clipDurationSeconds - 2);
  return `
SOUND DESIGN (broadcast mix):
${hasVoiceover ? "- Voiceover: warm, confident commercial VO. Clean studio recording. Slight compression. No echo/reverb on speech." : "- No voiceover."}
- Music: premium licensed-style underscore. Builds subtly, swells at ${tailStart}s for the hero close.
- SFX: subtle product foley (clicks, pours, textures) synced to visual actions — never overpowering.
- Mix: VO forward in center, music ducked under speech (-6dB), ambient bed fills gaps.
- Final ${clipDurationSeconds - tailStart}s: music-forward finish, VO silent, satisfying audio resolve.
`.trim();
}

export function buildVoiceoverPromptBlock(
  voiceoverScript: string | undefined,
  clipDurationSeconds: number
): string {
  if (!voiceoverScript?.trim()) {
    return "No voiceover — use premium background music and subtle sound design only.";
  }

  const budget = computeVoiceoverBudget(clipDurationSeconds);
  const script = truncateVoiceover(voiceoverScript, budget.maxWords);
  const wordCount = countWords(script);
  const finishBySecond = Math.max(1, clipDurationSeconds - budget.tailSilenceSeconds);

  return `
VOICEOVER DIRECTION (CRITICAL — DO NOT CUT OFF SPEECH):
- This clip is exactly ${clipDurationSeconds} seconds. Script: ${wordCount} words — MUST finish by ${finishBySecond}s.
- Speak EXACTLY: "${script}"
- Delivery: confident commercial VO — clear diction, warm tone, professional ad-read (not robotic, not rushed).
- Start within 0.3s. Even pacing (~2.2 words/sec). Final word lands cleanly before ${finishBySecond}s.
- Last ${budget.tailSilenceSeconds}s (${finishBySecond}–${clipDurationSeconds}s): SILENT. Hero frame + music swell.
`.trim();
}

export function buildOpeningClosingPromptBlock(clipDurationSeconds: number): string {
  const holdStart = Math.max(0, clipDurationSeconds - 1);
  return `
OPENING & CLOSING (film-grade bookends):
- OPENING (0–1s): Immediate visual hook — no fade from black, no empty drift. Frame 1 must stop the scroll.
- MID-FILM: Every transition lands on action, gesture, or beat. Match cuts > dissolves. No morphing or AI-smear.
- CLOSING (${holdStart}–${clipDurationSeconds}s): Resolve on stable product hero. Camera settles (slow push-in or static hold). 1 full second of breathing room — no abrupt freeze, no cut to black.
`.trim();
}

export const AD_FILM_CRAFT_SPEC = `
PRODUCTION QUALITY (broadcast / Tier-1 agency standard):
- Photorealistic live-action (unless animation style specified). 24fps cinematic motion cadence.
- Exposure: bright, clean, well-lit. Natural skin tones. No muddy shadows or crushed blacks.
- Color grade: unified LUT across all shots — consistent temperature, contrast, and saturation.
- Camera physics: realistic motion blur, stable horizon, no jitter/wobble/warping between frames.
- Product fidelity: exact shape, label, color, packaging from reference — zero drift across shots.

EDITING GRAMMAR (professional ad cut):
- Multi-shot edit (3–7 distinct shots). NEVER one continuous AI-generated take.
- Cut types: match cut on action, whip-pan exit/entry, rack-focus pull, speed-ramp, motivated hard cut.
- Each shot has ONE clear subject and ONE camera move maximum.
- Forbidden: morphing transitions, random teleports, flicker, object geometry shifts, label changes.

NEGATIVE CONSTRAINTS:
- No on-screen text, captions, subtitles, watermarks, or UI overlays.
- No extra limbs, warped faces, melting objects, plastic skin, AI halos, or texture crawling.
- No voiceover cut off mid-word. No abrupt ending before script completes.
`.trim();

/** @deprecated Use AD_FILM_CRAFT_SPEC */
export const REALISM_AND_EDIT_SPEC = AD_FILM_CRAFT_SPEC;

export const SAFETY_BLOCK =
  "SAFETY: Professional brand advertisement. All people fully clothed. No nudity or revealing attire. Family-friendly, safe for work.";

export function buildReferenceImagesBlock(hasReferenceImages: boolean): string {
  if (!hasReferenceImages) {
    return "Create visuals based on the creative treatment above.";
  }
  return `REFERENCE IMAGES (CRITICAL — source of truth):
The attached reference images show the EXACT product and/or logo. Depict with pixel-level fidelity:
same shape, colors, packaging, label text, proportions, and branding. Do NOT redesign, reimagine, or alter the product.
The product must be recognizable in every shot where it appears.`;
}

function buildSegmentContext(input: VeoPromptInput): string {
  const { segmentIndex, segmentCount, clipDurationSeconds, totalDurationSeconds } = input;
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return "";

  const total = totalDurationSeconds ?? clipDurationSeconds * segmentCount;
  if (segmentIndex === 0) {
    return `
SEGMENT 1 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
FIRST HALF — Hook, product introduction, setup. End on a resolved beat (hero product shot, pause, or held frame) for a clean stitch point.`;
  }
  return `
SEGMENT 2 of ${segmentCount} (${clipDurationSeconds}s clip / ${total}s total ad):
SECOND HALF — Continue the SAME story. Match lighting, grade, location, wardrobe, and product EXACTLY from segment 1.
Start with a new motivated angle (match-cut or whip-pan from segment 1 ending). Payoff, emotional climax, brand CTA.`;
}

/** Assemble a complete director-grade Veo prompt. */
export function buildVeoVideoPrompt(input: VeoPromptInput): string {
  const {
    brandName,
    productName,
    style,
    clipDurationSeconds,
    totalDurationSeconds,
    aspectRatio,
    segmentIndex,
    segmentCount,
    finalVideoPrompt,
    fallbackPrompt,
    voiceoverScript,
    storyboard,
    hasReferenceImages,
    headline,
    subtext,
  } = input;

  const styleSpec = getStyleDirectorSpec(style);
  const segmentOffset =
    segmentIndex != null && segmentCount != null && segmentIndex > 0
      ? clipDurationSeconds * segmentIndex
      : 0;

  const scopedStoryboard =
    segmentCount != null && segmentCount > 1 && segmentIndex != null
      ? filterStoryboardForSegment(storyboard, segmentIndex, clipDurationSeconds)
      : storyboard;

  const trimmedVoiceover = voiceoverScript
    ? truncateVoiceover(voiceoverScript, computeVoiceoverBudget(clipDurationSeconds).maxWords)
    : "";

  const creativeTreatment =
    finalVideoPrompt?.trim() ||
    fallbackPrompt?.trim() ||
    `Create a ${clipDurationSeconds}-second premium brand film for ${productName || "the product"} by ${brandName || "the brand"}.`;

  const totalLabel = totalDurationSeconds ?? clipDurationSeconds;

  return [
    `DIRECTOR'S BRIEF — ${clipDurationSeconds}s premium brand film for ${brandName || "the brand"} / ${productName || "the product"}.`,
    `Total ad length: ${totalLabel}s. Aspect ratio: ${aspectRatio}. Style: ${style || "Commercial"}.`,
    buildSegmentContext(input),

    `ROLE: ${styleSpec.role}`,
    `AESTHETIC: ${styleSpec.aesthetic}`,
    `CINEMATOGRAPHY: ${styleSpec.cinematography}`,
    `LIGHTING: ${styleSpec.lighting}`,
    `PACING: ${styleSpec.pacing}`,
    `LENS: ${styleSpec.lensFeel}`,
    `REFERENCES: ${styleSpec.references}`,

    `CREATIVE TREATMENT:\n${creativeTreatment}`,

    buildShotByShotBlock(scopedStoryboard, clipDurationSeconds, segmentOffset),

    AD_FILM_CRAFT_SPEC,

    buildSoundDesignBlock(!!trimmedVoiceover, clipDurationSeconds),

    buildVoiceoverPromptBlock(trimmedVoiceover, clipDurationSeconds),

    buildOpeningClosingPromptBlock(clipDurationSeconds),

    headline ? `On-screen headline (if applicable): "${headline}"` : "",
    subtext ? `On-screen subtext (if applicable): "${subtext}"` : "",

    buildReferenceImagesBlock(hasReferenceImages),

    SAFETY_BLOCK,
  ]
    .filter(Boolean)
    .join("\n\n");
}
