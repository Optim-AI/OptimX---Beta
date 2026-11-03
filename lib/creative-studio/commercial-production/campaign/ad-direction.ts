/**
 * Ad direction — the owner's tap-only answers from "Help me write it":
 * what viewers should do, how it should feel, who is on screen, and where.
 *
 * Kept as structured fields (not only text) so the ideas, the director, the
 * video prompt and the voiceover all honour them — especially who is on screen,
 * so faces, clothes and homes match the owner's market.
 */

export type ViewerActionId =
  | "order_online"
  | "visit_shop"
  | "call_whatsapp"
  | "remember_brand"
  | "festival_wishes"
  | "try_new";

export type MoodId = "warm_family" | "fun" | "premium" | "exciting" | "tradition" | "calm";

export type CastRegionId =
  | "south_indian"
  | "north_indian"
  | "all_india"
  | "east_northeast_indian"
  | "other_asian"
  | "middle_eastern"
  | "western"
  | "no_people";

export type CastAgeId = "children" | "young_adults" | "parents" | "grandparents";

export type SettingId = "home_kitchen" | "shop" | "office" | "outdoors" | "festive_home" | "studio";

export interface AdDirection {
  viewerAction?: ViewerActionId;
  mood?: MoodId;
  castRegion?: CastRegionId;
  castAges?: CastAgeId[];
  setting?: SettingId;
  /** Anything the owner says must be shown or said, in their words. */
  mustInclude?: string;
}

export const VIEWER_ACTIONS: Record<ViewerActionId, { label: string; prompt: string; cta?: string }> = {
  order_online: { label: "Order online", prompt: "order the product online", cta: "Order now" },
  visit_shop: { label: "Visit my shop", prompt: "visit the shop in person", cta: "Visit us today" },
  call_whatsapp: { label: "Call or WhatsApp", prompt: "call or WhatsApp the business", cta: "Call or WhatsApp us" },
  remember_brand: { label: "Remember my brand", prompt: "remember and trust the brand" },
  festival_wishes: { label: "Festival wishes", prompt: "feel warmly greeted by the brand for the occasion" },
  try_new: { label: "Try the new product", prompt: "try the new product for the first time", cta: "Try it today" },
};

export const MOODS: Record<MoodId, { label: string; prompt: string }> = {
  warm_family: { label: "Warm & family", prompt: "warm, homely and family-centred" },
  fun: { label: "Fun & funny", prompt: "light, playful and gently funny" },
  premium: { label: "Premium", prompt: "elegant, refined and premium" },
  exciting: { label: "Exciting", prompt: "energetic, upbeat and exciting" },
  tradition: { label: "Trust & tradition", prompt: "trustworthy, rooted in tradition and heritage" },
  calm: { label: "Calm", prompt: "calm, gentle and reassuring" },
};

export const CAST_REGIONS: Record<CastRegionId, { label: string; prompt: string }> = {
  south_indian: {
    label: "South Indian",
    prompt:
      "South Indian people (Tamil Nadu, Kerala, Karnataka, Andhra/Telangana) — their natural looks, everyday clothing (saree, veshti, salwar, casual wear) and South Indian homes, food and surroundings",
  },
  north_indian: {
    label: "North Indian",
    prompt:
      "North Indian people (Punjab, Delhi, Uttar Pradesh, Rajasthan and nearby) — their natural looks, everyday clothing (kurta, salwar, saree, casual wear) and North Indian homes and surroundings",
  },
  all_india: {
    label: "All-India mix",
    prompt: "a natural mix of Indian people from different regions, everyday modern Indian clothing and homes",
  },
  east_northeast_indian: {
    label: "East & Northeast Indian",
    prompt:
      "East and Northeast Indian people (Bengal, Odisha, Assam and the Northeast) — their natural looks, clothing and homes",
  },
  other_asian: {
    label: "Other Asian",
    prompt: "East or Southeast Asian people with local everyday clothing and homes",
  },
  middle_eastern: {
    label: "Middle Eastern",
    prompt: "Middle Eastern / Gulf people with local everyday clothing and homes",
  },
  western: {
    label: "Western",
    prompt: "Western (European / North American) people with everyday Western clothing and homes",
  },
  no_people: {
    label: "No people",
    prompt: "NO people on screen — show only the product (hands at most)",
  },
};

export const CAST_AGES: Record<CastAgeId, { label: string; prompt: string }> = {
  children: { label: "Children", prompt: "children" },
  young_adults: { label: "Young adults", prompt: "young adults" },
  parents: { label: "Parents", prompt: "parents" },
  grandparents: { label: "Grandparents", prompt: "grandparents" },
};

export const SETTINGS: Record<SettingId, { label: string; prompt: string }> = {
  home_kitchen: { label: "Home kitchen", prompt: "a real lived-in home kitchen or dining area" },
  shop: { label: "Shop", prompt: "inside the business's shop or store" },
  office: { label: "Office", prompt: "an everyday office or workplace" },
  outdoors: { label: "Street / outdoors", prompt: "a street, market or outdoor everyday location" },
  festive_home: { label: "Festival at home", prompt: "a home decorated for a festival" },
  studio: { label: "Clean studio", prompt: "a clean, simple studio set" },
};

const MAX_MUST_INCLUDE = 300;

function pick<T extends string>(table: Record<T, unknown>, value: unknown): T | undefined {
  return typeof value === "string" && value in table ? (value as T) : undefined;
}

/** Keep only known ids; returns undefined when nothing was answered. */
export function normalizeAdDirection(raw: unknown): AdDirection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const ages = Array.isArray(r.castAges)
    ? Array.from(new Set(r.castAges.map((a) => pick(CAST_AGES, a)).filter((a): a is CastAgeId => Boolean(a))))
    : [];
  const direction: AdDirection = {
    viewerAction: pick(VIEWER_ACTIONS, r.viewerAction),
    mood: pick(MOODS, r.mood),
    castRegion: pick(CAST_REGIONS, r.castRegion),
    castAges: ages.length ? ages : undefined,
    setting: pick(SETTINGS, r.setting),
    mustInclude:
      typeof r.mustInclude === "string" && r.mustInclude.trim()
        ? r.mustInclude.trim().slice(0, MAX_MUST_INCLUDE)
        : undefined,
  };
  const answered = Object.fromEntries(Object.entries(direction).filter(([, v]) => v !== undefined)) as AdDirection;
  return Object.keys(answered).length ? answered : undefined;
}

/** Default spoken / end-card call to action for the chosen viewer action. */
export function viewerActionCta(direction?: AdDirection): string | undefined {
  return direction?.viewerAction ? VIEWER_ACTIONS[direction.viewerAction].cta : undefined;
}

/** Who is on screen, as one line — also used by storyboard pictures. */
export function castLine(direction?: AdDirection): string | undefined {
  if (!direction?.castRegion && !direction?.castAges?.length) return undefined;
  if (direction.castRegion === "no_people") return CAST_REGIONS.no_people.prompt;
  const who = direction.castRegion ? CAST_REGIONS[direction.castRegion].prompt : "people";
  const ages = direction.castAges?.map((a) => CAST_AGES[a].prompt).join(", ");
  return ages ? `${who}; ages: ${ages}` : who;
}

export function adDirectionToPromptBlock(direction?: AdDirection): string {
  if (!direction) return "";
  const lines: string[] = [];
  const cast = castLine(direction);
  if (cast) lines.push(`- Who is on screen (MUST follow): ${cast}.`);
  if (direction.setting) lines.push(`- Where: ${SETTINGS[direction.setting].prompt}.`);
  if (direction.mood) lines.push(`- Feeling: ${MOODS[direction.mood].prompt}.`);
  if (direction.viewerAction) {
    lines.push(`- After watching, viewers should: ${VIEWER_ACTIONS[direction.viewerAction].prompt}. The ending must lead to this.`);
  }
  if (direction.mustInclude) lines.push(`- The owner says this must be shown or said: "${direction.mustInclude}"`);
  return lines.length ? `OWNER'S DIRECTION (CRITICAL — the owner chose these):\n${lines.join("\n")}` : "";
}
