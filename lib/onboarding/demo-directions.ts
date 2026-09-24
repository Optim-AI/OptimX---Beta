/**
 * Distinct creative directions for the onboarding demo set.
 * Directions adapt to brand context — not a fixed luxury/editorial template.
 */

import type { BrandSnapshot } from '@/app/web/src/components/creative-studio/types';
import type { PosterVisualDirection } from '@/lib/creative-studio/poster-generation';

/** Configurable size of the onboarding creative set. */
export const ONBOARDING_DEMO_VARIATION_COUNT = 4;

/** Minimum successful creatives required to complete the demo. */
export const ONBOARDING_DEMO_MIN_CREATIVES = 2;

export type DemoCreativeDirectionId =
  | 'product_hero'
  | 'lifestyle'
  | 'promotional'
  | 'editorial'
  | 'bold_commercial';

export type DemoCreativeDirection = {
  id: DemoCreativeDirectionId;
  label: string;
  shortDescription: string;
  visualDirection: PosterVisualDirection;
  purpose: string;
  composition: string;
  messaging: string;
  typography: string;
  productPresentation: string;
  colorDirection: string;
  copyRules: string;
};

const PRODUCT_HERO: DemoCreativeDirection = {
  id: 'product_hero',
  label: 'Product Hero',
  shortDescription: 'Clean product-led launch creative',
  visualDirection: 'minimal',
  purpose: 'Premium product presentation with strong packshot visibility.',
  composition:
    'Centered or slightly off-center product hero. Generous but not empty margins. Product should occupy roughly 45–65% of the frame.',
  messaging: 'Short brand or product headline. One factual benefit line max if available.',
  typography: 'Strong hierarchy: one short headline, optional single support line, brand/product name.',
  productPresentation:
    'Hero packshot must be clearly visible, undistorted, and faithful to the reference product image. Avoid tiny product placement.',
  colorDirection: 'Use brand primary colors; keep background calm so the product reads first.',
  copyRules:
    'No generic CTAs like "Discover Your Favorite". No invented claims or stats. Prefer silence over filler copy.',
};

const LIFESTYLE: DemoCreativeDirection = {
  id: 'lifestyle',
  label: 'Lifestyle',
  shortDescription: 'Brand-in-context creative',
  visualDirection: 'trendy',
  purpose: 'Place the product in a relevant lifestyle context that matches the brand world.',
  composition:
    'Product integrated in a contextual scene. Product still clearly identifiable — not a tiny prop.',
  messaging: 'Emotional or contextual line grounded in brand tone; avoid manufactured lifestyle claims.',
  typography: 'Lighter supporting type; headline shorter than product-hero treatment.',
  productPresentation:
    'Real product reference remains the hero SKU. Environment supports the brand — never replace the product.',
  colorDirection: 'Scene lighting and palette should feel on-brand; avoid stock-photo clichés.',
  copyRules: 'Minimal copy. No fake testimonials. No unsupported benefits.',
};

const PROMOTIONAL: DemoCreativeDirection = {
  id: 'promotional',
  label: 'Promotional',
  shortDescription: 'Benefit-focused commercial creative',
  visualDirection: 'commercial',
  purpose: 'Conversion-oriented framing emphasizing a clear product benefit.',
  composition:
    'Product prominent with clear message zone. Commercial stop-power without clutter.',
  messaging:
    'Lead with a concise benefit from brand context (value prop / category). No invented discounts or urgency.',
  typography: 'Bold, readable commercial hierarchy. One primary message only.',
  productPresentation: 'Packshot large and sharp. Avoid busy overlays across packaging artwork.',
  colorDirection: 'High contrast for message; brand colors for accents.',
  copyRules: 'No fake offers, percentages, or scarcity. Only benefits present in brand context.',
};

const EDITORIAL: DemoCreativeDirection = {
  id: 'editorial',
  label: 'Editorial',
  shortDescription: 'Brand-led visual direction',
  visualDirection: 'premium',
  purpose: 'Stronger brand identity and expressive brand storytelling.',
  composition:
    'Editorial framing with intentional negative space and type. Product still present and recognizable.',
  messaging: 'Brand-forward line or tagline if available; otherwise product category statement.',
  typography: 'Expressive but restrained type. Avoid dense paragraphs.',
  productPresentation: 'Product as design element — visible, accurate, not cropped awkwardly.',
  colorDirection: 'Refined palette from brand colors; avoid forcing luxury gold/marble clichés.',
  copyRules: 'No filler body copy. No invented brand manifesto.',
};

const BOLD_COMMERCIAL: DemoCreativeDirection = {
  id: 'bold_commercial',
  label: 'Bold',
  shortDescription: 'High-impact commercial creative',
  visualDirection: 'bold',
  purpose: 'High-impact creative with strong contrast and product clarity.',
  composition: 'Dynamic crop or angle with product dominant. Avoid chaotic overlays.',
  messaging: 'Punchy short headline from brand voice; keep it factual.',
  typography: 'Large type, few words. High contrast.',
  productPresentation: 'Oversized, clear packshot. Packaging fidelity mandatory.',
  colorDirection: 'Bold color blocks from brand palette.',
  copyRules: 'Extremely short copy. No decorative captions.',
};

const CATALOG: DemoCreativeDirection[] = [
  PRODUCT_HERO,
  LIFESTYLE,
  PROMOTIONAL,
  EDITORIAL,
  BOLD_COMMERCIAL,
];

function brandHaystack(brand: BrandSnapshot): string {
  const parts = [
    brand.personality,
    brand.brandVoice,
    brand.tone,
    ...(brand.brand_aesthetic || []),
    ...(brand.brand_tone || []),
    brand.industry,
    brand.productCategory,
    brand.offering,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Pick distinct directions for this brand. Always includes a product-hero baseline.
 * Does not force luxury/editorial on every company.
 */
export function selectDemoDirections(
  brand: BrandSnapshot,
  count: number = ONBOARDING_DEMO_VARIATION_COUNT
): DemoCreativeDirection[] {
  const hay = brandHaystack(brand);
  const picked: DemoCreativeDirection[] = [PRODUCT_HERO];

  const wantsLifestyle =
    /lifestyle|wellness|beauty|food|beverage|fitness|fashion|consumer|snack|nutrition|skincare|apparel/.test(
      hay
    ) || !/b2b|enterprise|saas|industrial|software/.test(hay);

  const wantsEditorial =
    /premium|elegant|minimal|luxury|editorial|design|artisan|craft/.test(hay);

  const wantsBold = /bold|energetic|youth|fun|playful|sport|street/.test(hay);

  const candidates: DemoCreativeDirection[] = [];
  if (wantsLifestyle) candidates.push(LIFESTYLE);
  candidates.push(PROMOTIONAL);
  if (wantsEditorial) candidates.push(EDITORIAL);
  else if (wantsBold) candidates.push(BOLD_COMMERCIAL);
  else candidates.push(EDITORIAL);
  if (wantsBold && !candidates.includes(BOLD_COMMERCIAL)) {
    candidates.push(BOLD_COMMERCIAL);
  }
  // Fill from catalog without duplicates
  for (const d of CATALOG) {
    if (candidates.length >= count) break;
    if (!candidates.find((c) => c.id === d.id) && d.id !== 'product_hero') {
      candidates.push(d);
    }
  }

  for (const d of candidates) {
    if (picked.length >= count) break;
    if (!picked.find((p) => p.id === d.id)) picked.push(d);
  }

  // Adapt product_hero visualDirection toward brand aesthetic
  const adapted = picked.map((d, i) => {
    if (i !== 0) return d;
    if (/minimal|clean|simple/.test(hay)) {
      return { ...d, visualDirection: 'minimal' as const };
    }
    if (/premium|elegant|luxury/.test(hay)) {
      return { ...d, visualDirection: 'premium' as const };
    }
    if (/bold|loud|strong/.test(hay)) {
      return { ...d, visualDirection: 'bold' as const };
    }
    if (/playful|fun|friendly/.test(hay)) {
      return { ...d, visualDirection: 'playful' as const };
    }
    return d;
  });

  return adapted.slice(0, count);
}

export function getDemoDirectionById(
  id: string
): DemoCreativeDirection | undefined {
  return CATALOG.find((d) => d.id === id);
}
