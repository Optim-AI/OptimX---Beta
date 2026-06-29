/**
 * OptimX Film Engine — declarative film style profiles.
 *
 * Each style is a data profile. To add a new cinematic language (e.g. a new
 * brand look), add a profile here — do not edit branching logic anywhere else.
 */

import type { FilmStyle } from "./types";

export const FILM_STYLES: FilmStyle[] = [
  {
    id: "apple_premium",
    label: "Apple — Premium Minimal",
    match: ["apple", "premium", "minimal", "minimalist", "product showcase", "clean"],
    pacing: "measured",
    cameraLanguage: "locked-off and slow motorized moves; precise, deliberate framing",
    editingGrammar: "few cuts, long holds, match cuts on motion; nothing rushed",
    lightingLanguage: "soft, even, high-key; gradient seamless background; gentle falloff",
    movementStyle: "smooth dolly and slider, micro push-ins; zero handheld",
    colorScience: "clean neutral whites, controlled contrast, true-to-life color",
    emotionalWeight: "premium",
    transitionRules: "match cut on shape or motion; never a hard random jump",
    realismLevel: "photoreal",
    references: "premium minimalist product films; macro detail; negative space",
  },
  {
    id: "nike_energetic",
    label: "Nike — Kinetic Energy",
    match: ["nike", "energetic", "bold", "sport", "fitness", "hype", "dynamic"],
    pacing: "rapid",
    cameraLanguage: "dynamic handheld, whip pans, low angles, speed ramps",
    editingGrammar: "fast rhythmic cuts on beat; hard cuts on action; kinetic montage",
    lightingLanguage: "high contrast, hard rim light, dramatic shadows, punchy",
    movementStyle: "tracking, snap zooms, body-following handheld",
    colorScience: "saturated, crushed blacks, bold graphic color",
    emotionalWeight: "intense",
    transitionRules: "whip-pan and motion-continuity cuts; energy never drops",
    realismLevel: "photoreal",
    references: "kinetic sport cinematography; speed ramps; energetic cut rhythm",
  },
  {
    id: "ugc_authentic",
    label: "UGC — Authentic Handheld",
    match: ["ugc", "authentic", "selfie", "creator", "tiktok", "reel", "real person", "casual"],
    pacing: "punchy",
    cameraLanguage: "eye-level selfie framing, natural handheld sway, phone-camera feel",
    editingGrammar: "jump cuts, quick reactions, talking-to-camera energy",
    lightingLanguage: "natural room light, window light; imperfect but believable",
    movementStyle: "handheld, slight shake, casual reframing",
    colorScience: "natural phone-camera color, mild contrast, true skin tones",
    emotionalWeight: "raw",
    transitionRules: "jump cuts and reaction cuts; feels spontaneous, not polished",
    realismLevel: "photoreal",
    references: "Creator UGC; iPhone front camera; honest recommendation",
  },
  {
    id: "luxury_cinematic",
    label: "Luxury — Cinematic Prestige",
    match: ["luxury", "rolex", "perfume", "fragrance", "watch", "jewel", "prestige", "elegant", "cinematic"],
    pacing: "slow-burn",
    cameraLanguage: "elegant slow dolly, shallow depth, macro detail, anamorphic feel",
    editingGrammar: "long luxurious holds, slow dissolves, deliberate reveals",
    lightingLanguage: "chiaroscuro, single motivated key, rich highlights and shadow",
    movementStyle: "slow cinematic glides, orbiting product moves",
    colorScience: "warm film grade, deep blacks, gold highlights, Kodak 2383 feel",
    emotionalWeight: "premium",
    transitionRules: "motivated dissolves and match cuts; reveals are earned",
    realismLevel: "photoreal",
    references: "Luxury fragrance and watch films; anamorphic; film grain",
  },
  {
    id: "dove_warm",
    label: "Dove — Warm Lifestyle",
    match: ["dove", "warm", "lifestyle", "family", "care", "skincare", "wellness", "gentle"],
    pacing: "measured",
    cameraLanguage: "intimate medium close-ups, gentle handheld, eye-level human framing",
    editingGrammar: "soft motivated cuts, breathing room, emotional pacing",
    lightingLanguage: "soft diffused natural light, warm fill, flattering skin",
    movementStyle: "slow push-ins, gentle follow; calm and human",
    colorScience: "warm pastel grade, soft contrast, healthy skin tones",
    emotionalWeight: "warm",
    transitionRules: "soft cuts on gesture or gaze; never jarring",
    realismLevel: "photoreal",
    references: "warm modest human-centered skincare commercials; real-life intimacy",
  },
  {
    id: "redbull_punchy",
    label: "Red Bull — High-Energy Hook",
    match: ["red bull", "redbull", "hook", "viral", "attention", "fast", "scroll"],
    pacing: "rapid",
    cameraLanguage: "GoPro/POV, extreme angles, fast tracking, pattern-interrupt framing",
    editingGrammar: "very fast cuts, speed ramps, immediate hooks, no slow intro",
    lightingLanguage: "bright punchy daylight or neon; high energy",
    movementStyle: "rapid handheld, POV, snap moves",
    colorScience: "vivid saturated color, high contrast",
    emotionalWeight: "intense",
    transitionRules: "hard cuts and whip-pans on beat; relentless momentum",
    realismLevel: "photoreal",
    references: "action-led edits; POV energy; scroll-stopping momentum",
  },
  {
    id: "commercial_default",
    label: "Commercial — Broadcast Standard",
    match: ["commercial", "broadcast", "tv", "default", "brand"],
    pacing: "measured",
    cameraLanguage: "clean motivated moves, professional framing, mix of sizes",
    editingGrammar: "motivated cuts (match, rack focus, hard cut on action); 3–7 shots",
    lightingLanguage: "bright, clean, well-lit; natural skin tones; unified grade",
    movementStyle: "dolly, slider, controlled handheld where motivated",
    colorScience: "unified LUT, balanced contrast, broadcast-safe color",
    emotionalWeight: "warm",
    transitionRules: "match cut on action; whip-pan; rack focus; no morphs",
    realismLevel: "photoreal",
    references: "Tier-1 agency TV commercials",
  },
];

const DEFAULT_STYLE = FILM_STYLES.find((s) => s.id === "commercial_default")!;

/**
 * Resolve a FilmStyle from free-form creativeFormat/style/description tokens.
 * Falls back to the broadcast commercial profile.
 */
export function getFilmStyle(...hints: Array<string | undefined>): FilmStyle {
  const haystack = hints.filter(Boolean).join(" ").toLowerCase();
  if (!haystack.trim()) return DEFAULT_STYLE;

  let best: { style: FilmStyle; score: number } | null = null;
  for (const style of FILM_STYLES) {
    let score = 0;
    for (const token of style.match) {
      if (haystack.includes(token)) score += token.length; // longer matches win
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { style, score };
    }
  }
  return best?.style ?? DEFAULT_STYLE;
}

export function getFilmStyleById(id: string): FilmStyle {
  return FILM_STYLES.find((s) => s.id === id) ?? DEFAULT_STYLE;
}
