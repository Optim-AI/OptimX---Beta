/**
 * Category-aware scene guidance for onboarding demo posters.
 * Helps the generator pick environments that match the actual product type.
 */

import type { Product } from '@/app/web/src/components/creative-studio/types';

export type ProductSceneProfile = {
  categoryLabel: string;
  environment: string;
  lighting: string;
  props: string;
  mood: string;
  avoid: string;
};

function haystack(product: Partial<Product> | null | undefined, extras: string[] = []): string {
  if (!product && extras.length === 0) return '';
  return [
    product?.category,
    product?.product_name,
    product?.description,
    product?.short_benefit,
    ...(product?.key_benefits || []),
    ...extras,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Infer a scene profile from product metadata (never invents product claims).
 */
export function inferProductSceneProfile(
  product: Partial<Product> | null | undefined,
  brandExtras: string[] = []
): ProductSceneProfile {
  const hay = haystack(product, brandExtras);

  if (
    /skincare|skin care|serum|moisturizer|moisturiser|cleanser|beauty|cosmetic|face wash|lotion|sunscreen|haircare|hair care/.test(
      hay
    )
  ) {
    return {
      categoryLabel: 'skincare / beauty',
      environment:
        'Clean spa or bathroom vanity surface — soft stone, ceramic, or matte counter. Soft towels or water droplets as subtle accents only.',
      lighting: 'Soft diffused daylight or gentle studio beauty lighting; flattering, clean highlights on packaging.',
      props: 'Minimal: maybe a single leaf, soft cloth, or water droplet — never clutter.',
      mood: 'Calm, clean, elevated self-care.',
      avoid:
        'Food props, kitchens, gym equipment, spicy/rustic textures, busy lifestyle crowds.',
    };
  }

  if (
    /spice|masala|seasoning|chilli|chili|pepper|turmeric|curry|condiment|herb blend/.test(hay)
  ) {
    return {
      categoryLabel: 'spices / seasonings',
      environment:
        'Warm kitchen or pantry surface — wood, stone, or ceramic with subtle spice textures (whole spices nearby as supporting accents, not replacing the product).',
      lighting: 'Warm directional light that brings out rich spice tones; avoid cold clinical lighting.',
      props: 'Whole spices, mortar hints, or linen — keep product packaging the hero.',
      mood: 'Aromatic, authentic, culinary warmth.',
      avoid: 'Spa/beauty vanity, skincare droplets, cold clinical labs, candy-like props.',
    };
  }

  if (
    /snack|bar|nutrition|protein|cereal|granola|food|beverage|drink|coffee|tea|chocolate|cookie|biscuit|chips|crisp|meal|supplement|edible|yogurt|yoghurt/.test(
      hay
    )
  ) {
    return {
      categoryLabel: 'food / nutrition',
      environment:
        'Appetizing food-world setting — clean tabletop, marble or wood, soft natural ingredients that match the product category (e.g. nuts/fruit for a nutrition bar) without inventing unsupported claims.',
      lighting: 'Warm, appetizing food photography light; soft shadows; product pack clearly lit.',
      props: 'Relevant food accents only when they match the product world; never props that contradict the brand.',
      mood: 'Fresh, trustworthy, crave-worthy but premium — not junk-food clutter.',
      avoid: 'Spa vanities, clinical beauty lighting, industrial warehouses, unrelated luxury marble with no food context.',
    };
  }

  if (/fitness|gym|sport|athletic|protein powder|whey|activewear/.test(hay)) {
    return {
      categoryLabel: 'fitness / active',
      environment: 'Clean athletic or modern lifestyle setting — matte surfaces, subtle motion energy without clutter.',
      lighting: 'Crisp, energetic studio light with clear product read.',
      props: 'Minimal athletic cues; never crowd the packshot.',
      mood: 'Energetic, performance-oriented, modern.',
      avoid: 'Spa beauty vanity, spice rustic kitchens, childish props.',
    };
  }

  if (/tech|gadget|earbud|headphone|electronics|device|hardware|software|saas/.test(hay)) {
    return {
      categoryLabel: 'tech / electronics',
      environment: 'Modern desk or abstract tech surface — clean gradients, precise geometry, premium materials.',
      lighting: 'Cool-to-neutral precise studio lighting; crisp reflections on product.',
      props: 'Minimal tech accents; keep packaging/device accurate.',
      mood: 'Precise, modern, premium.',
      avoid: 'Food tables, spa settings, rustic kitchens.',
    };
  }

  return {
    categoryLabel: product?.category?.trim() || 'general consumer product',
    environment:
      'Clean, on-brand commercial surface that supports the product category without conflicting props.',
    lighting: 'Professional commercial lighting that flatters the real product packaging.',
    props: 'Minimal supporting props only if they clearly belong to the product world.',
    mood: 'Premium, clear, commercially usable.',
    avoid: 'Generic stock clichés, mismatched category worlds, tiny product placement.',
  };
}

export function formatSceneGuidanceForBrief(profile: ProductSceneProfile): string {
  return [
    `PRODUCT WORLD: ${profile.categoryLabel}`,
    `ENVIRONMENT: ${profile.environment}`,
    `LIGHTING: ${profile.lighting}`,
    `PROPS: ${profile.props}`,
    `MOOD: ${profile.mood}`,
    `AVOID: ${profile.avoid}`,
    'Choose background, surface, and props intelligently for THIS product category — food does not get a spa vanity; skincare does not get a snack table; spices do not get clinical beauty lighting.',
  ].join('\n');
}

/** Build a lightweight catalog entry from a raw product image URL (fullAnalyze fallback). */
export function productFromImageUrl(url: string, index: number): Product {
  return {
    product_name: `Product ${index + 1}`,
    price: null,
    description: '',
    key_benefits: [],
    product_images: [url],
    target_audience: '',
    emotional_angles: [],
    use_cases: [],
    short_benefit: '',
  };
}
