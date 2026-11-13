/**
 * The shot library — the shot list a product photographer would plan, and the
 * direction each shot gives the set, light and camera.
 */

import type { LightingMood, ProductProfile, ShootSettings, ShotDefinition } from "./types";

type KindShot = ShotDefinition & { dir: (p: ProductProfile, around: boolean) => string };
const props3 = (p: ProductProfile, fallback: string) => p.storyProps.slice(0, 3).join(", ") || fallback;
const INDIAN = "Indian home styling: steel and brass utensils, natural textures, warm and authentic.";

/** Shots made for a kind of product — food sellers, drinks brands and cafés shoot differently. */
const KIND_SHOTS: KindShot[] = [
  // Pickles, spices, snacks, sweets
  { id: "food_ingredients", group: "catalogue", kinds: ["packaged_food"], label: "Ingredient spread", purpose: "Show what's inside — product page, ads", description: "The pack surrounded by small bowls of its raw ingredients.", method: "scene", defaultAspect: "4:5",
    dir: (p) => `A rustic wooden table: the product surrounded by small bowls and scatterings of its raw ingredients (${props3(p, "whole spices, chillies, garlic")}). Overhead-angle warm daylight. ${INDIAN}` },
  { id: "food_served", group: "lifestyle", kinds: ["packaged_food"], label: "Served with food", purpose: "Make people hungry — social, ads", description: "The product served with a meal it goes with, the pack beside it.", method: "guided", defaultAspect: "4:5",
    dir: (p) => `The product served the way people eat it — a generous portion on a steel plate or banana leaf with the dish it goes with (for example parathas, curd rice or dal-chawal), the open pack right beside it. Appetising close-up, warm natural light. ${INDIAN}` },
  { id: "food_scoop", group: "people", kinds: ["packaged_food"], label: "The scoop", purpose: "Texture and freshness — reels, ads", description: "A spoon lifting product out of the open pack, close-up.", method: "guided", defaultAspect: "4:5", usesModel: true,
    dir: () => "Macro close-up: a hand lifting a heaped spoonful out of the open product, showing rich texture and oil sheen, the pack's label visible behind. Shallow depth of field, warm light." },
  { id: "food_kitchen", group: "lifestyle", kinds: ["packaged_food"], label: "Kitchen counter", purpose: "Everyday use — product page, social", description: "On a real Indian kitchen counter.", method: "scene", defaultAspect: "4:5",
    dir: () => `On a real Indian home kitchen counter with a few everyday items (steel dabba, wooden spoon, fresh herbs) softly out of focus, morning window light. ${INDIAN}` },
  { id: "food_spice_heap", group: "studio", kinds: ["packaged_food"], label: "Spice heap", purpose: "Masala & spice brands — ads", description: "Mounds of colourful spices around the pack.", method: "scene", defaultAspect: "4:5",
    dir: (p) => `On a dark stone surface with vivid mounds and scatterings of ${props3(p, "turmeric, red chilli powder, coriander and whole spices")} around it, dramatic side light making the colours glow.` },
  { id: "food_hamper", group: "studio", kinds: ["packaged_food"], label: "Gift hamper", purpose: "Diwali, Rakhi, gifting sales", description: "In a festive gift box with ribbon and dry fruits.", method: "scene", defaultAspect: "4:5",
    dir: () => "Inside an open festive gift hamper box with satin ribbon, dry fruits and marigold petals, warm golden light with soft bokeh, celebratory." },
  // Beverages
  { id: "bev_ice_cold", group: "studio", kinds: ["beverage"], label: "Ice-cold", purpose: "Refreshment — ads, summer", description: "Condensation droplets and crushed ice.", method: "scene", defaultAspect: "4:5",
    dir: () => "Standing in crushed ice with frosty condensation droplets running down it, cool backlight making the drink glow, crisp and refreshing." },
  { id: "bev_pour", group: "people", kinds: ["beverage"], label: "The pour", purpose: "Appetite appeal — reels, ads", description: "Pouring into a glass with a splash.", method: "guided", defaultAspect: "4:5",
    dir: () => "The drink being poured from the product into a clear glass with a lively splash and bubbles, frozen motion, backlit, the label readable." },
  { id: "bev_fruit_burst", group: "studio", kinds: ["beverage"], label: "Flavour burst", purpose: "Show the flavour — ads, social", description: "Among the fruits and ingredients that flavour it.", method: "scene", defaultAspect: "4:5",
    dir: (p) => `Surrounded by fresh ${props3(p, "fruit slices, mint and citrus")} with a few splashes frozen mid-air, bright punchy light, vibrant colour.` },
  { id: "bev_cafe_table", group: "lifestyle", kinds: ["beverage"], label: "Café table", purpose: "Lifestyle — social, product page", description: "On a sunny café table with a glass.", method: "scene", defaultAspect: "4:5",
    dir: () => "On a sunny café table beside a filled glass with ice, soft background bokeh of a café, natural daylight." },
  { id: "bev_cheers", group: "people", kinds: ["beverage"], label: "Cheers", purpose: "Social, moments, campaigns", description: "Friends clinking glasses with the drink.", method: "guided", defaultAspect: "4:5", usesModel: true,
    dir: () => "Two or three friends' hands clinking glasses of the drink, the product bottle in focus in the foreground, warm candid moment, natural light." },
  { id: "bev_outdoor", group: "lifestyle", kinds: ["beverage"], label: "Outdoors", purpose: "Summer, travel, picnic campaigns", description: "On a picnic blanket in sunshine.", method: "scene", defaultAspect: "4:5",
    dir: () => "On a picnic blanket outdoors in bright sunshine with fruit and a glass nearby, green grass and sky softly out of focus." },
  // Café and restaurant dishes (the dish is the product)
  { id: "cafe_delivery", group: "catalogue", kinds: ["cafe_food"], label: "Delivery-app listing", purpose: "Swiggy, Zomato, menu", description: "The dish on a clean neutral background, menu-photo style.", method: "scene", defaultAspect: "1:1",
    dir: () => "On a clean light-grey seamless background, soft even top light, centred, appetising and true to colour — the standard food-delivery menu photo." },
  { id: "cafe_hero", group: "studio", kinds: ["cafe_food"], label: "Hero plate", purpose: "Menu, ads, social", description: "The classic 45° menu shot on a styled table.", method: "scene", defaultAspect: "4:5",
    dir: () => "On a styled restaurant table, shot at a 45-degree angle, with cutlery and a napkin, warm moody restaurant light and soft background bokeh, mouth-watering." },
  { id: "cafe_spread", group: "lifestyle", kinds: ["cafe_food"], label: "Table spread", purpose: "Combos, social, ads", description: "Top-down spread with sides, drinks and hands reaching in.", method: "guided", defaultAspect: "4:5",
    dir: () => "Top-down flat lay of a table spread: the dish in the centre with sides, dips and drinks around it, a couple of hands reaching in, vibrant and abundant." },
  { id: "cafe_steam", group: "studio", kinds: ["cafe_food"], label: "Steam & sizzle", purpose: "Hot and fresh — reels, ads", description: "Rising steam on a dark moody set.", method: "scene", defaultAspect: "4:5",
    dir: () => "On a dark slate surface with wisps of steam rising and a warm rim light, moody, hot and freshly made." },
  { id: "cafe_bite", group: "people", kinds: ["cafe_food"], label: "The bite", purpose: "Craving — ads, social", description: "Someone enjoying a bite.", method: "guided", defaultAspect: "4:5", usesModel: true,
    dir: () => "A person happily taking a bite of the dish, candid, close-up, café setting softly blurred, natural light." },
  { id: "cafe_takeaway", group: "lifestyle", kinds: ["cafe_food"], label: "Takeaway box", purpose: "Delivery & cloud kitchens", description: "In takeaway packaging, ready to go.", method: "guided", defaultAspect: "4:5",
    dir: () => "The dish in an open takeaway box with a branded-looking plain paper bag and a drink beside it, on a bright counter, ready for delivery." },
  // Clothing and accessories
  { id: "fashion_folded", group: "catalogue", kinds: ["fashion"], label: "Folded", purpose: "Product page, catalogue", description: "Neatly folded on a clean backdrop, the way a boutique lays it out.", method: "guided", defaultAspect: "4:5",
    dir: (_p) => "The garment neatly folded into a tidy rectangle with the collar, placket or main design on top, on a clean seamless backdrop, photographed from slightly above, soft even light with a gentle shadow. Crisp folds, true fabric colour." },
  { id: "fashion_detail", group: "studio", kinds: ["fashion"], label: "Fabric & print detail", purpose: "Show quality — product page, ads", description: "A close-up of the fabric, print, stitching or buttons.", method: "guided", defaultAspect: "4:5",
    dir: () => "Macro close-up of the fabric: the weave, print, stitching and a button or trim in sharp focus, raking side light that shows the texture of the cloth, shallow depth of field falling away at the edges." },
  { id: "fashion_worn", group: "people", kinds: ["fashion"], label: "Worn", purpose: "Fit and drape — ads, social", description: "A model wearing it in a real setting.", method: "guided", defaultAspect: "4:5", usesModel: true,
    dir: () => "A model wearing the product in a real everyday setting, cropped from shoulders to mid-thigh so the fit and drape are clear, relaxed natural pose, soft daylight, background softly out of focus." },
  { id: "fashion_flatlay", group: "lifestyle", kinds: ["fashion"], label: "Outfit flat lay", purpose: "Instagram, styling ideas", description: "Laid flat from above with the pieces that complete the look.", method: "guided", defaultAspect: "4:5",
    dir: () => "Top-down flat lay: the garment laid flat and gently shaped on a textured surface, with two or three accessories that complete the outfit (footwear, a watch or jewellery, a bag) arranged around it with deliberate spacing, soft even daylight." },
  { id: "fashion_hanger", group: "lifestyle", kinds: ["fashion"], label: "On the hanger", purpose: "Boutique feel — social, product page", description: "Hanging on a wooden hanger by a window or textured wall.", method: "guided", defaultAspect: "4:5",
    dir: () => "The garment hanging on a wooden hanger from a hook against a textured plaster wall beside a window, natural side light showing how the fabric falls, a plant or stool softly out of focus." },
  // Skincare, haircare, cosmetics
  { id: "beauty_ingredients", group: "studio", kinds: ["beauty"], label: "Key ingredients", purpose: "What's inside — ads, product page", description: "Surrounded by the botanicals and ingredients it's made with.", method: "scene", defaultAspect: "4:5",
    dir: (p) => `On a pale stone slab surrounded by fresh ${props3(p, "botanicals, petals and leaves")} with a few water droplets, clean bright light with soft shadows, fresh and natural.` },
  { id: "beauty_texture", group: "studio", kinds: ["beauty"], label: "Texture swatch", purpose: "Show the formula — ads, social", description: "The product beside a smear or drop of what's inside.", method: "guided", defaultAspect: "4:5",
    dir: () => "The product standing beside a generous smear, swirl or drop of its contents on a sheet of glass or smooth stone, shot from a low three-quarter angle, glossy highlights on the texture, clean minimal set." },
  { id: "beauty_shelf", group: "lifestyle", kinds: ["beauty"], label: "Bathroom shelf", purpose: "Everyday routine — product page, social", description: "On a bathroom shelf or vanity with a towel and a plant.", method: "scene", defaultAspect: "4:5",
    dir: () => "On a bathroom vanity or stone shelf with a folded cotton towel, a small plant and a ceramic dish softly out of focus, soft morning window light, calm and clean." },
  { id: "beauty_in_use", group: "people", kinds: ["beauty"], label: "Applying it", purpose: "How it's used — reels, ads", description: "A hand dispensing or applying the product, close-up.", method: "guided", defaultAspect: "4:5", usesModel: true,
    dir: () => "Close-up of a hand dispensing the product onto fingertips, the pack held in the other hand with its label facing the camera, healthy natural skin, bathroom softly blurred behind, soft daylight." },
];

type CreativeSet = { id: string; label: string; purpose: string; description: string; set: (p: ProductProfile) => string };

/** Themed sets — each brings its own surface, props and light (the lighting/backdrop settings don't apply). */
function CREATIVE_SETS(): CreativeSet[] {
  return [
    { id: "theme_on_ice", label: "On Ice", purpose: "Summer, cooling, fresh launches", description: "Product standing on a block of clear ice with frost and scattered ice cubes.",
      set: () => "standing on a block of crystal-clear ice with frost, scattered ice cubes and a little cold mist, crisp cool blue-white light with sparkling highlights on the ice" },
    { id: "theme_fresh_pile", label: "Fresh Pile", purpose: "Ingredients, freshness, food & beauty", description: "Product nestled in a generous pile of its ingredients filling the frame.",
      set: (p) => `nestled into a generous, abundant pile of ${p.storyProps.slice(0, 3).join(", ") || "its fresh ingredients"} that fills the frame around and behind it, bright natural light, rich saturated colour` },
    { id: "theme_amber_hour", label: "Amber Hour", purpose: "Premium ads, warm brand mood", description: "Warm low sunlight with palm-leaf shadows on a plaster wall.",
      set: () => "on a warm sandstone ledge against a plaster wall, low golden late-afternoon sunlight raking across with crisp palm-leaf shadows, warm amber tones" },
    { id: "theme_water_ripple", label: "Water Ripple", purpose: "Clean, hydrating, skincare & drinks", description: "Product standing in shallow clear water with ripples and light caustics.",
      set: () => "standing in a thin layer of crystal-clear water with gentle concentric ripples around its base and dancing caustic light patterns, fresh aqua tones, bright clean light" },
    { id: "theme_festive", label: "Festive Lights", purpose: "Diwali, festive sales, gifting", description: "Warm fairy-light bokeh with diyas and marigolds.",
      set: () => "on a rich festive table with glowing brass diyas, fresh marigold flowers and a few petals, warm golden fairy-light bokeh in the background, celebratory Diwali mood" },
    { id: "theme_pastel_pop", label: "Pastel Pop", purpose: "Gen-Z ads, launches, social", description: "Bold pastel colour blocks and geometric shapes with hard shadows.",
      set: () => "on a stack of bold pastel colour-block geometric shapes (cylinders, arches, cubes) in two or three candy colours, hard directional sunlight casting crisp graphic shadows, playful and modern" },
    { id: "theme_marble_luxe", label: "Marble Luxe", purpose: "Luxury, premium, gifting", description: "Dark veined marble with gold accents and moody light.",
      set: () => "on polished dark veined marble with a few brushed-gold accents, moody low-key lighting with a soft rim light and deep shadows, luxurious editorial feel" },
    { id: "theme_soft_linen", label: "Soft Linen", purpose: "Calm, natural, wellness brands", description: "Draped linen, dried flowers and soft morning window light.",
      set: () => "on softly draped natural linen with a few dried flowers and a ceramic dish, soft diffused morning window light, airy neutral tones, calm and minimal" },
    { id: "theme_sand_stone", label: "Sand & Stone", purpose: "Natural, earthy, outdoor brands", description: "Rippled sand and smooth stones in warm sun.",
      set: () => "on rippled fine sand with a few smooth sculptural stones, warm direct sun with soft long shadows, earthy desert palette" },
    { id: "theme_garden", label: "Garden Fresh", purpose: "Botanical, organic, everyday", description: "Among lush leaves and flowers in dappled light.",
      set: () => "among lush green leaves and a few fresh flowers on a mossy stone, dappled sunlight filtering through foliage, vibrant natural greens" },
  ];
}

export const SHOTS: ShotDefinition[] = [
  {
    id: "marketplace_white",
    group: "catalogue",
    label: "Marketplace packshot",
    purpose: "Main image on Amazon, Flipkart, Shopify",
    description: "Pure white (RGB 255) background, product ~85% of the frame, soft contact shadow. Marketplace-compliant.",
    method: "exact",
    defaultAspect: "1:1",
  },
  {
    id: "color_sweep",
    group: "catalogue",
    label: "Colour sweep",
    purpose: "Product page gallery, catalogue, brand store",
    description: "Seamless backdrop in your brand colour with a soft floor shadow.",
    method: "exact",
    defaultAspect: "4:5",
  },
  {
    id: "acrylic_reflection",
    group: "catalogue",
    label: "Mirror reflection",
    purpose: "Premium product page and ads",
    description: "Product on glossy acrylic with a clean mirror reflection.",
    method: "exact",
    defaultAspect: "4:5",
  },
  {
    id: "styled_still_life",
    group: "studio",
    label: "Styled still life",
    purpose: "Product page, social feed",
    description: "Product on a styled set with the props and ingredients that tell what it is.",
    method: "scene",
    defaultAspect: "4:5",
  },
  {
    id: "pedestal",
    group: "studio",
    label: "Sculptural pedestal",
    purpose: "Premium ads, launches, gifting",
    description: "Product on plinths and sculptural forms in a single-colour set, directional light.",
    method: "scene",
    defaultAspect: "4:5",
  },
  {
    id: "levitation",
    group: "studio",
    label: "Levitation / splash",
    purpose: "Scroll-stopping ads, launches",
    description: "Product floating with ingredients or elements frozen mid-air around it.",
    method: "scene",
    defaultAspect: "4:5",
  },
  {
    id: "lifestyle_context",
    group: "lifestyle",
    label: "Lifestyle in context",
    purpose: "Product page, social, ads",
    description: "Product in the place it's really used — kitchen counter, desk, bathroom shelf, outdoors.",
    method: "scene",
    defaultAspect: "4:5",
  },
  {
    id: "flat_lay",
    group: "lifestyle",
    label: "Flat lay",
    purpose: "Instagram, bundles, 'what's inside'",
    description: "Top-down arrangement of the product with its props on a textured surface.",
    method: "scene",
    pose: "laid",
    defaultAspect: "4:5",
  },
  {
    id: "in_hand",
    group: "people",
    label: "In hand",
    purpose: "Shows real size and handling",
    description: "A hand holding the product naturally, so shoppers can judge its size.",
    method: "guided",
    defaultAspect: "4:5",
    usesModel: true,
  },
  {
    id: "on_model",
    group: "people",
    label: "Model with product",
    purpose: "Ads, social, brand campaigns",
    description: "A model using or holding the product in a real moment.",
    method: "guided",
    defaultAspect: "4:5",
    usesModel: true,
  },
  {
    id: "in_use",
    group: "people",
    label: "Product in use",
    purpose: "Shows how it works or how it's enjoyed",
    description: "The product being used — poured, applied, eaten, worn — close and candid.",
    method: "guided",
    defaultAspect: "4:5",
    usesModel: true,
  },
  {
    id: "detail_macro",
    group: "studio",
    label: "Close-up detail",
    purpose: "Show quality and texture — product page, ads",
    description: "A tight close-up of the material, texture or what's inside.",
    method: "guided",
    defaultAspect: "4:5",
  },
  {
    id: "on_the_go",
    group: "people",
    label: "On the go",
    purpose: "Everyday life — social, ads",
    description: "The product out and about: in the car, at a desk, in a bag, on a commute.",
    method: "guided",
    defaultAspect: "4:5",
    usesModel: true,
  },
  // Category shots: offered only for their product kind, shown first.
  ...KIND_SHOTS.map(({ dir: _dir, ...def }) => def),
  // Creative sets: themed scenes built around the real product (like seasonal templates).
  ...CREATIVE_SETS().map((t) => ({
    id: t.id,
    group: "creative" as const,
    label: t.label,
    purpose: t.purpose,
    description: t.description,
    method: "scene" as const,
    defaultAspect: "4:5" as const,
  })),
];

export function getShot(id: string): ShotDefinition | null {
  return SHOTS.find((s) => s.id === id) ?? null;
}

/** The shot list a photographer would start from for this product. */
export function recommendShots(profile: ProductProfile): string[] {
  const kind = profile.kind;
  if (kind === "packaged_food") return ["marketplace_white", "food_ingredients", "food_served", "food_scoop", "food_kitchen", "theme_festive"];
  if (kind === "beverage") return ["marketplace_white", "bev_ice_cold", "bev_pour", "bev_fruit_burst", "bev_cafe_table", "in_hand"];
  if (kind === "cafe_food") return ["cafe_delivery", "cafe_hero", "cafe_spread", "cafe_steam", "cafe_bite"];
  if (kind === "fashion") return ["marketplace_white", "fashion_folded", "fashion_worn", "fashion_detail", "fashion_flatlay", "fashion_hanger"];
  if (kind === "beauty") return ["marketplace_white", "beauty_ingredients", "beauty_texture", "beauty_shelf", "beauty_in_use", "in_hand"];
  const ids = ["marketplace_white", "color_sweep", "styled_still_life", "lifestyle_context", "in_hand"];
  if (/glossy|glass|metal|chrome|premium|luxury/i.test(`${profile.finish} ${profile.notes}`)) ids.push("acrylic_reflection");
  if (profile.isFood || profile.storyProps.length >= 2) ids.push("levitation");
  if (profile.isWearable || /beauty|fashion|apparel|cosmetic|skincare|jewel|watch/i.test(profile.category)) ids.push("on_model");
  else if (profile.isFood) ids.push("in_use");
  if (profile.sizeClass === "large") return ids.filter((id) => id !== "in_hand" && id !== "levitation");
  return [...new Set(ids)];
}

const LIGHTING: Record<LightingMood, string> = {
  studio_soft: "soft, even, diffused studio light from both sides, gentle shadows, true colours",
  natural_daylight: "soft natural window daylight from one side, airy and fresh, natural shadows",
  golden_hour: "warm low golden-hour sunlight, long soft shadows, warm highlights",
  dramatic: "single hard key light with deep shadows and a crisp rim light, high contrast, moody",
};

export function lightingFor(mood: LightingMood): string {
  return LIGHTING[mood] ?? LIGHTING.studio_soft;
}

export function modelDescription(settings: ShootSettings): string {
  const m = settings.model || {};
  const who = m.gender === "woman" ? "a woman" : m.gender === "man" ? "a man" : "a person";
  const age = m.age && m.age !== "any" ? ` aged ${m.age}` : "";
  return `${who}${age}${m.look ? `, ${m.look}` : ""}`;
}

function contextFor(p: ProductProfile): string {
  return p.usageContexts[0] || (p.isFood ? "a home kitchen counter" : "a natural home setting");
}

const props = (p: ProductProfile) => (p.storyProps.length ? p.storyProps.slice(0, 5).join(", ") : "a few props that suit the product");

/**
 * Direction for the AI set (scene method: the set is built AROUND the real product
 * already in the frame — or, as a fallback, shot empty and the product composited
 * in) or the full shot (guided method).
 */
export function shotDirection(shotId: string, p: ProductProfile, s: ShootSettings, opts: { around?: boolean } = {}): string {
  const light = lightingFor(s.lighting);
  const around = opts.around === true;
  const kindShot = KIND_SHOTS.find((k) => k.id === shotId);
  if (kindShot) return `A professional product photograph: the product ${kindShot.dir(p, around)}`;
  switch (shotId) {
    case "styled_still_life":
      return `A styled product still-life set: a tabletop surface with ${props(p)} arranged around ${around ? "the product" : "an empty spot in the centre foreground"}. Set colours harmonise with ${s.backdrop}. Lighting: ${light}. Shot at product level with a 70mm lens, shallow depth of field.`;
    case "pedestal":
      return `A sculptural studio set in one colour family based on ${s.backdrop}: cylindrical plinths, an arch and a sphere, with ${around ? "the product standing on top of a plinth" : "an empty plinth top in the centre for the product"}. Lighting: ${light}. Minimal, premium, editorial.`;
    case "levitation":
      return `A high-speed studio shot: ${props(p)} frozen mid-air, flying outward ${around ? "around the floating product" : "from an empty centre where the product will float"}. Backdrop colour ${s.backdrop}. Lighting: ${light}. Crisp, energetic, no motion blur.`;
    case "lifestyle_context":
      return `A real ${contextFor(p)}, photographed for a lifestyle catalogue: ${around ? "the product standing on the surface in the foreground" : "an empty spot on the surface in the centre foreground"}, with a few everyday objects and ${props(p)} nearby, out of focus. Lighting: ${light}. Feels lived-in and authentic, not staged.`;
    case "flat_lay":
      return `A top-down flat lay photographed from directly overhead on a textured surface (linen, stone or wood) in tones that suit ${s.backdrop}: the product lying flat with its label facing the camera, turned at a slight angle, with ${props(p)} arranged around it with deliberate spacing. Lighting: ${light}.`;
    case "detail_macro":
      return `A macro close-up of the product's most telling detail — its material, surface texture, cap or closure, or the contents seen through the pack — filling the frame, raking side light that brings out texture, very shallow depth of field. Frame it so the label's printed text is outside the picture or far out of focus. Lighting: ${light}.`;
    case "on_the_go":
      return `A candid everyday moment away from home: ${modelDescription(s)} holding or using the product ${p.isWearable ? "while out in the city" : "in a car, at an office desk or on a commute"}, the label facing the camera, natural daylight, shallow depth of field, real and unposed.`;
    case "in_hand":
      return `A close-up of a hand${s.model?.gender && s.model.gender !== "any" ? ` (${s.model.gender === "woman" ? "a woman's" : "a man's"} hand)` : ""} holding the product naturally in ${contextFor(p)}, showing its real size. Natural skin, relaxed grip that doesn't cover the label. Lighting: ${light}. Shallow depth of field.`;
    case "on_model":
      return `A lifestyle portrait of ${modelDescription(s)} holding and enjoying the product in ${contextFor(p)}. Candid, natural expression, product clearly visible near the face or chest with the label facing camera. Lighting: ${light}. Editorial campaign photography, 50mm lens.`;
    case "in_use":
      return `A candid close shot of the product being used${p.isFood ? " — being opened, poured or eaten" : ""} by ${modelDescription(s)} in ${contextFor(p)}. Hands and action in focus, product label readable. Lighting: ${light}.`;
    default: {
      const theme = CREATIVE_SETS().find((t) => t.id === shotId);
      if (theme) {
        return `A styled, art-directed product photograph: the product ${theme.set(p)}. Hero composition with the product as the clear focal point, shallow depth of field on the background.`;
      }
      return `A clean studio product photograph. Lighting: ${light}.`;
    }
  }
}
