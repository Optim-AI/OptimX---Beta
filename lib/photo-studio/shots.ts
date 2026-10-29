/**
 * The shot library — the shot list a product photographer would plan, and the
 * direction each shot gives the set, light and camera.
 */

import type { LightingMood, ProductProfile, ShootSettings, ShotDefinition } from "./types";

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
    method: "guided",
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
];

export function getShot(id: string): ShotDefinition | null {
  return SHOTS.find((s) => s.id === id) ?? null;
}

/** The shot list a photographer would start from for this product. */
export function recommendShots(profile: ProductProfile): string[] {
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

function modelDescription(settings: ShootSettings): string {
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
      return `A top-down flat lay on a textured surface (linen, stone or wood) in tones that suit ${s.backdrop}: the product in the centre with ${props(p)} arranged around it with deliberate spacing. Lighting: ${light}.`;
    case "in_hand":
      return `A close-up of a hand${s.model?.gender && s.model.gender !== "any" ? ` (${s.model.gender === "woman" ? "a woman's" : "a man's"} hand)` : ""} holding the product naturally in ${contextFor(p)}, showing its real size. Natural skin, relaxed grip that doesn't cover the label. Lighting: ${light}. Shallow depth of field.`;
    case "on_model":
      return `A lifestyle portrait of ${modelDescription(s)} holding and enjoying the product in ${contextFor(p)}. Candid, natural expression, product clearly visible near the face or chest with the label facing camera. Lighting: ${light}. Editorial campaign photography, 50mm lens.`;
    case "in_use":
      return `A candid close shot of the product being used${p.isFood ? " — being opened, poured or eaten" : ""} by ${modelDescription(s)} in ${contextFor(p)}. Hands and action in focus, product label readable. Lighting: ${light}.`;
    default:
      return `A clean studio product photograph. Lighting: ${light}.`;
  }
}
