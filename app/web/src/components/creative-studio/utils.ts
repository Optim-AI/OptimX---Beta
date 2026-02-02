// Creative Studio Shared Utilities
// Extracted from pages/creative-studio.tsx for modularity

import type { BrandSnapshot, PosterConfig } from './types';

/**
 * Theme Configuration Map
 * Maps UI theme selections to specific marketing design rules
 */
export const THEME_CONFIG: Record<string, {
  visualStyle: string;
  colorPalette: string;
  typography: string;
  composition: string;
  lighting: string;
  textures: string;
  negativeSpace: string;
}> = {
  minimal: {
    visualStyle: "Bauhaus style, geometric precision, functional design",
    colorPalette: "Monochromatic palettes, limited color palette (2-3 colors max), high contrast black and white",
    typography: "Thin sans-serif typography, Helvetica or similar, minimal text, large letter spacing",
    composition: "40% negative space minimum, centered composition, grid-based layout",
    lighting: "Even, flat lighting, no dramatic shadows",
    textures: "Smooth surfaces, matte finishes, no textures",
    negativeSpace: "Extensive white space, breathing room around elements"
  },
  professional: {
    visualStyle: "Grid-based corporate layouts, clean corporate aesthetic, trustworthy design",
    colorPalette: "Trust-building blues and whites, corporate color schemes, professional grays",
    typography: "Clean sans-serif fonts, professional typography, clear hierarchy",
    composition: "Grid-based layout, balanced composition, clear visual hierarchy",
    lighting: "Clean, even studio lighting, professional photography style",
    textures: "Clean surfaces, professional materials",
    negativeSpace: "Organized spacing, clear sections, readable layout"
  },
  elegant: {
    visualStyle: "Luxury goods photography style, sophisticated design, refined aesthetic",
    colorPalette: "Gold and silk textures, rich deep colors, metallic accents, premium color schemes",
    typography: "Serif fonts, elegant typography, sophisticated letterforms, classic typefaces",
    composition: "Classical composition, balanced elegance, refined spacing",
    lighting: "Chiaroscuro lighting (dramatic light and shadow), soft directional lighting, luxury photography",
    textures: "Gold textures, silk materials, premium surfaces, luxury finishes",
    negativeSpace: "Generous spacing, elegant proportions, refined layout"
  },
  premium: {
    visualStyle: "Luxury goods photography style, high-end aesthetic, sophisticated design",
    colorPalette: "Gold and silk textures, rich deep colors, metallic accents, premium color schemes",
    typography: "Serif fonts, elegant typography, sophisticated letterforms, classic typefaces",
    composition: "Classical composition, balanced elegance, refined spacing",
    lighting: "Chiaroscuro lighting (dramatic light and shadow), soft directional lighting, luxury photography",
    textures: "Gold textures, silk materials, premium surfaces, luxury finishes",
    negativeSpace: "Generous spacing, elegant proportions, refined layout"
  },
  bold: {
    visualStyle: "Brutalist design elements, high-impact visuals, strong graphic design",
    colorPalette: "High-contrast color blocking (e.g., Black/Yellow, Red/White), bold color combinations, saturated colors",
    typography: "Oversized typography, bold fonts, heavy weights, impactful letterforms",
    composition: "Strong geometric shapes, bold compositions, high visual impact",
    lighting: "Dramatic lighting, high contrast, bold shadows",
    textures: "Bold textures, strong patterns, graphic elements",
    negativeSpace: "Strategic negative space, bold use of space, strong visual hierarchy"
  },
  playful: {
    visualStyle: "3D claymorphism or vaporwave aesthetics, fun and energetic design",
    colorPalette: "Vibrant gradients, bright colors, playful color combinations, neon accents",
    typography: "Rounded shapes, friendly fonts, playful typography, curved letterforms",
    composition: "Dynamic compositions, rounded shapes, organic layouts",
    lighting: "Soft, colorful lighting, playful shadows, vibrant atmosphere",
    textures: "3D clay textures, soft materials, rounded surfaces",
    negativeSpace: "Playful spacing, organic flow, dynamic layout"
  },
  trendy: {
    visualStyle: "3D claymorphism or vaporwave aesthetics, modern contemporary style, current design trends",
    colorPalette: "Vibrant gradients, bright colors, trendy color combinations, modern palettes",
    typography: "Modern fonts, trendy typography, contemporary letterforms",
    composition: "Modern compositions, trendy layouts, fresh approach",
    lighting: "Modern lighting, contemporary style, fresh atmosphere",
    textures: "Modern textures, trendy materials, contemporary surfaces",
    negativeSpace: "Modern spacing, trendy proportions, fresh layout"
  },
  festive: {
    visualStyle: "Celebratory design, joyful aesthetic, festive atmosphere",
    colorPalette: "Rich, warm colors, festive color schemes, celebratory palettes",
    typography: "Decorative fonts, festive typography, celebratory letterforms",
    composition: "Dynamic, engaging compositions, festive layouts",
    lighting: "Warm lighting, celebratory atmosphere, festive mood",
    textures: "Festive textures, celebratory materials, warm surfaces",
    negativeSpace: "Engaging spacing, festive proportions, dynamic layout"
  },
  dynamic: {
    visualStyle: "High-action focal points, movement-focused design, energetic aesthetic",
    colorPalette: "Energetic colors, dynamic color schemes, high-energy palettes",
    typography: "Dynamic typography, movement-oriented fonts, energetic letterforms",
    composition: "Dutch angles, motion blur effects, high-action compositions, dynamic layouts",
    lighting: "Dynamic lighting, motion-focused, energetic atmosphere",
    textures: "Dynamic textures, movement-oriented materials, energetic surfaces",
    negativeSpace: "Dynamic spacing, movement-oriented proportions, energetic layout"
  }
};

/**
 * Get composition rules based on aspect ratio
 * These rules are MANDATORY and override artistic freedom
 */
export function getCompositionRules(ratio: "1:1" | "4:5" | "9:16" | "1.91:1"): string {
  const rules: Record<string, string> = {
    "1:1": "Centered, symmetrical composition. The hero element must be placed centrally. Visual weight radiates from the center. Balanced top-to-bottom layout.",
    "4:5": "Rule of thirds. Top 60%: Hero visual and emotion. Bottom 40%: Product details or CTA space. Strong vertical hierarchy.",
    "9:16": "CRITICAL SAFE ZONES: Top 15%: EMPTY. Bottom 15%: EMPTY. Only the middle 70% is usable. Follow a vertical Z-pattern. All key information must stay inside safe area. Failure to respect safe zones = unusable ad.",
    "1.91:1": "Wide horizontal layout. Golden Ratio or Rule of Thirds horizontally. Center or off-center hero. Left-to-right visual flow. Top 10% and bottom 10% kept clean for overlays. Designed for banners and professional placements."
  };
  
  return rules[ratio] || rules["1:1"];
}

/**
 * Generate production prompt that wraps user request with brand guidelines
 * This ensures AI adheres to brand colors, voice, and leaves space for logo
 */
export function generateProductionPrompt(userRequest: string, brand: BrandSnapshot | null): string {
  if (!brand) {
    return userRequest; // Return as-is if no brand guidelines
  }

  const parts: string[] = [];
  
  // Start with user's request
  parts.push(`User Request: ${userRequest}`);
  parts.push("");

  // Brand voice instruction
  if (brand.brandVoice) {
    const voiceInstructions: Record<string, string> = {
      Professional: "Maintain a professional, corporate, and trustworthy tone. Use formal language and polished design.",
      Playful: "Use a fun, energetic, and casual tone. Incorporate playful elements and friendly language.",
      Minimalist: "Keep the design clean, simple, and understated. Use minimal elements and plenty of white space.",
      Bold: "Create a confident, striking, and attention-grabbing design. Use strong visuals and impactful messaging."
    };
    parts.push(`Brand Voice: ${voiceInstructions[brand.brandVoice] || brand.brandVoice}`);
  } else if (brand.personality) {
    parts.push(`Brand Personality: ${brand.personality}`);
  }

  // Primary colors instruction
  if (brand.primaryColors && brand.primaryColors.length > 0) {
    parts.push(`CRITICAL: Use these exact brand colors: ${brand.primaryColors.join(", ")}`);
    parts.push("These colors must be prominently featured in the design. Do not use colors outside this palette.");
  } else if (brand.colors?.primary) {
    parts.push(`CRITICAL: Use brand color ${brand.colors.primary} as the primary color.`);
    if (brand.colors.secondary) {
      parts.push(`Secondary color: ${brand.colors.secondary}`);
    }
    if (brand.colors.accent) {
      parts.push(`Accent color: ${brand.colors.accent}`);
    }
  }

  // Font style instruction
  if (brand.fontStyles) {
    parts.push(`Typography: Use ${brand.fontStyles} font style throughout the design.`);
  }

  // Core value proposition
  if (brand.coreValueProp) {
    parts.push(`Core Value Proposition: "${brand.coreValueProp}"`);
    parts.push("This should be the main hook or headline in the creative.");
  }

  // Logo placement instruction
  if (brand.logo || brand.logoUrl) {
    parts.push("");
    parts.push("CRITICAL: A brand logo has been provided. You MUST:");
    parts.push("- Leave appropriate space in the layout for the logo placement");
    parts.push("- Design the composition so the logo can be placed naturally (typically top-left, top-center, or bottom-right)");
    parts.push("- Ensure the logo area has sufficient contrast and doesn't clash with other elements");
    parts.push("- The logo will be added separately, so design around its placement");
  }

  // Target audience
  if (brand.audience) {
    parts.push(`Target Audience: ${brand.audience}`);
    parts.push("Design and messaging should appeal specifically to this audience.");
  }

  // Brand description context
  if (brand.description) {
    parts.push(`Brand Context: ${brand.description}`);
  }

  return parts.join("\n");
}

/**
 * Build a high-quality poster generation prompt
 * Combines Theme Visuals + Aspect Ratio Composition + Brand Data
 */
export function buildPosterPrompt(options: {
  userRequest: string;
  theme: string;
  aspectRatio: "1:1" | "4:5" | "9:16" | "1.91:1";
  brand: BrandSnapshot | null;
  hasProductImage: boolean;
  variant?: number; // 1, 2, or 3 for generating variants
}): string {
  const { userRequest, theme, aspectRatio, brand, hasProductImage, variant } = options;
  
  const themeConfig = THEME_CONFIG[theme] || THEME_CONFIG.professional;
  const compositionRules = getCompositionRules(aspectRatio);
  
  const parts: string[] = [];
  
  // ========== CORE SYSTEM ROLE & AUTHORITY ==========
  parts.push("You are a Senior Commercial Graphic Designer and Creative Director working at a top-tier digital marketing agency.");
  parts.push("Your task is to create high-conversion, paid-ad-quality marketing posters.");
  parts.push("");
  parts.push("You do NOT create:");
  parts.push("- Templates");
  parts.push("- UI layouts");
  parts.push("- Generic AI art");
  parts.push("- Decorative visuals");
  parts.push("");
  parts.push("You ONLY create:");
  parts.push("- Real marketing posters");
  parts.push("- Scroll-stopping ad creatives");
  parts.push("- Brand-consistent paid media assets");
  parts.push("");
  parts.push("Every decision must follow marketing logic, brand rules, and layout discipline.");
  parts.push("");
  
  // ========== FUNDAMENTAL DESIGN PRINCIPLES (GLOBAL RULES) ==========
  parts.push("=== FUNDAMENTAL DESIGN PRINCIPLES (APPLY TO EVERY POSTER) ===");
  parts.push("- One dominant idea per poster (product OR offer OR emotion)");
  parts.push("- Clear visual hierarchy (Hero → Headline → Support → CTA space)");
  parts.push("- Strong use of negative space");
  parts.push("- High contrast for readability");
  parts.push("- Commercial, agency-grade aesthetic");
  parts.push("- Never look like a UI screen or template");
  parts.push("");
  parts.push("If a design looks 'polite' or 'safe,' it is wrong.");
  parts.push("");
  
  // ========== USER REQUEST ==========
  parts.push(`=== USER REQUEST ===`);
  parts.push(`${userRequest}`);
  parts.push("");
  
  // ========== THEME-BASED DESIGN LOGIC (STRATEGIC DIRECTIVE) ==========
  parts.push(`=== THEME: ${theme.toUpperCase()} (STRATEGIC DIRECTIVE, NOT A FILTER) ===`);
  parts.push(`Visual Style: ${themeConfig.visualStyle}`);
  parts.push(`Color Palette: ${themeConfig.colorPalette}`);
  parts.push(`Typography: ${themeConfig.typography}`);
  parts.push(`Composition: ${themeConfig.composition}`);
  parts.push(`Lighting: ${themeConfig.lighting}`);
  parts.push(`Textures: ${themeConfig.textures}`);
  parts.push(`Negative Space: ${themeConfig.negativeSpace}`);
  parts.push("");
  
  // ========== ASPECT RATIO COMPOSITION RULES (CRITICAL - MANDATORY) ==========
  parts.push(`=== ASPECT RATIO: ${aspectRatio} (MANDATORY - OVERRIDES ARTISTIC FREEDOM) ===`);
  parts.push(compositionRules);
  parts.push("");
  
  // ========== BRAND GUIDELINE ENFORCEMENT (MANDATORY - MUST DOMINATE) ==========
  if (brand) {
    parts.push("=== BRAND GUIDELINES (MANDATORY - IF BRAND DATA EXISTS, IT MUST DOMINATE) ===");
    
    if (brand.primaryColors && brand.primaryColors.length > 0) {
      parts.push(`Brand Colors: Use ONLY the provided primary and secondary brand colors: ${brand.primaryColors.join(", ")}`);
      parts.push("No random or decorative colors allowed.");
    } else if (brand.colors?.primary) {
      parts.push(`Brand Colors: Use ONLY Primary ${brand.colors.primary}${brand.colors.secondary ? `, Secondary ${brand.colors.secondary}` : ''}${brand.colors.accent ? `, Accent ${brand.colors.accent}` : ''}`);
      parts.push("No random or decorative colors allowed.");
    }
    
    if (brand.fontStyles) {
      parts.push(`Typography: Follow detected or selected brand font style consistently: ${brand.fontStyles}`);
    }
    
    if (brand.brandVoice) {
      const voiceMap: Record<string, string> = {
        Professional: "Corporate, credible, structured",
        Playful: "Casual, energetic, expressive",
        Minimalist: "Understated, clean, confident",
        Bold: "Loud, confident, disruptive"
      };
      parts.push(`Brand Voice: ${voiceMap[brand.brandVoice] || brand.brandVoice}`);
    }
    
    if (brand.coreValueProp) {
      parts.push(`Core Value Proposition: "${brand.coreValueProp}"`);
      parts.push("This should be the main hook or headline in the creative.");
    }
    
    if (brand.logo || brand.logoUrl) {
      parts.push("Logo Space: Leave clear negative space for logo placement.");
      parts.push("Do NOT place busy elements behind logo area.");
    }
    
    if (brand.audience) {
      parts.push(`Target Audience: ${brand.audience}`);
      parts.push("Design must visually and emotionally appeal to the defined audience.");
    }
    
    parts.push("");
  }
  
  // ========== PRODUCT IMAGE RULES (NON-NEGOTIABLE) ==========
  if (hasProductImage) {
    parts.push("=== PRODUCT IMAGE RULES (NON-NEGOTIABLE) ===");
    parts.push("If a product image is provided:");
    parts.push("- Use ONLY that image");
    parts.push("- Do NOT regenerate or alter the product");
    parts.push("- Do NOT hallucinate variants");
    parts.push("- The product must remain visually unchanged");
    parts.push("");
    parts.push("Only backgrounds, graphics, lighting context, and layout may change.");
    parts.push("");
  }
  
  // ========== VARIANT GENERATION STRATEGY (ALWAYS 3) ==========
  if (variant) {
    parts.push(`=== VARIANT ${variant} GENERATION STRATEGY ===`);
    if (variant === 1) {
      parts.push("VARIANT 1 — SAFE / ON-BRAND:");
      parts.push("- Conservative");
      parts.push("- Maximum brand alignment");
      parts.push("- Clean and familiar");
      parts.push("- Trust-first execution");
    } else if (variant === 2) {
      parts.push("VARIANT 2 — CREATIVE PUSH:");
      parts.push("- Stronger typography");
      parts.push("- Bolder shapes");
      parts.push("- Higher visual energy");
      parts.push("- Still brand-safe");
    } else if (variant === 3) {
      parts.push("VARIANT 3 — EXPERIMENTAL:");
      parts.push("- Different composition");
      parts.push("- Alternate emphasis");
      parts.push("- Still commercial");
      parts.push("- Never messy or chaotic");
    }
    parts.push("");
  }
  
  // ========== OVERLAP & CLUTTER PREVENTION (CRITICAL) ==========
  parts.push("=== OVERLAP & CLUTTER PREVENTION (CRITICAL) ===");
  parts.push("The AI MUST enforce:");
  parts.push("- No text overlapping graphics");
  parts.push("- No graphics overlapping text");
  parts.push("- Minimum spacing between elements");
  parts.push("- Clear separation of layers");
  parts.push("- Intentional empty space for text");
  parts.push("");
  parts.push("If unsure → leave more space.");
  parts.push("");
  
  // ========== PRODUCTION QUALITY STANDARDS ==========
  parts.push("=== PRODUCTION QUALITY STANDARDS ===");
  parts.push("8K resolution");
  parts.push("Professional studio lighting");
  parts.push("Commercial photography look");
  parts.push("Sharp focus");
  parts.push("Magazine-quality finish");
  parts.push("");
  parts.push("NO:");
  parts.push("- Gibberish text");
  parts.push("- AI artifacts");
  parts.push("- Watermarks");
  parts.push("- Distorted anatomy");
  parts.push("- Pixelation");
  parts.push("- Low-quality textures");
  parts.push("");
  
  // ========== SYSTEM PRIORITY ORDER (CONFLICT RESOLUTION) ==========
  parts.push("=== SYSTEM PRIORITY ORDER (IF RULES CONFLICT, FOLLOW THIS ORDER) ===");
  parts.push("1. Brand Guidelines");
  parts.push("2. Aspect Ratio & Safe Zones");
  parts.push("3. Product Integrity");
  parts.push("4. Theme Logic");
  parts.push("5. Creative Expression");
  parts.push("");
  parts.push("Creativity must NEVER break higher rules.");
  parts.push("");
  
  // ========== CORE VISUAL INTENT ==========
  parts.push("=== CORE VISUAL INTENT ===");
  parts.push("Create bold, graphic marketing posters.");
  parts.push("Design like a paid ad, not an illustration.");
  parts.push("Typography is a visual element.");
  parts.push("Backgrounds must feel designed, not empty.");
  parts.push("Avoid polite or UI-like layouts.");
  
  return parts.join("\n");
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Convert File to data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert data URL back to File
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Generate a unique ID for messages/sessions
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default Ad Builder Data
 */
export const DEFAULT_AD_BUILDER_DATA = {
  step: 1 as const,
  product: null,
  adSetup: {
    style: "Cinematic" as const,
    duration: 6 as const,
    platform: "Instagram Reels / TikTok" as const,
    aspect_ratio: "9:16" as const,
  },
  voiceover: {
    enabled: true,
    tone: "Energetic" as const,
  },
  onScreenText: {
    enabled: true,
  },
};

/**
 * Default poster config
 */
export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  theme: "",
  aspectRatio: "1:1",
};

/**
 * Available poster themes
 */
export const POSTER_THEMES = [
  { id: "minimal", label: "Minimal", description: "Clean, simple, modern" },
  { id: "professional", label: "Professional", description: "Corporate, trustworthy" },
  { id: "elegant", label: "Elegant", description: "Luxury, sophisticated" },
  { id: "premium", label: "Premium", description: "High-end, refined" },
  { id: "bold", label: "Bold", description: "Strong, impactful" },
  { id: "playful", label: "Playful", description: "Fun, energetic" },
  { id: "trendy", label: "Trendy", description: "Modern, contemporary" },
  { id: "festive", label: "Festive", description: "Celebratory, joyful" },
  { id: "dynamic", label: "Dynamic", description: "Motion, energy" },
];

/**
 * Available aspect ratios
 */
export const ASPECT_RATIOS = [
  { id: "1:1", label: "Square (1:1)", description: "Instagram feed, Facebook" },
  { id: "4:5", label: "Portrait (4:5)", description: "Instagram feed optimal" },
  { id: "9:16", label: "Story (9:16)", description: "Instagram/FB Stories, Reels" },
  { id: "1.91:1", label: "Landscape (1.91:1)", description: "Facebook/LinkedIn banner" },
] as const;

/**
 * Video styles for Ad Builder
 */
export const VIDEO_STYLES = [
  "Product Close-up",
  "Lifestyle",
  "Cinematic",
  "Luxury",
  "Minimalist",
  "Bold & Energetic",
  "Stop Motion",
  "3D Animation",
  "2D Animation",
  "Motion Graphics",
  "Whimsical",
  "Retro",
  "Neon",
] as const;

/**
 * Video durations
 */
export const VIDEO_DURATIONS = [6, 8, 10, 15] as const;

/**
 * Video platforms
 */
export const VIDEO_PLATFORMS = [
  "Instagram Reels / TikTok",
  "YouTube Shorts",
  "Instagram Feed",
  "YouTube Ad",
] as const;

/**
 * Video aspect ratios
 */
export const VIDEO_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5"] as const;
