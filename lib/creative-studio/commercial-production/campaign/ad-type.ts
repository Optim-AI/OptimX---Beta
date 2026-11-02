/**
 * Ad type playbooks — what the commercial is selling, and therefore how it is built.
 *
 * Independent of visual style (creative-style.ts): a festival greeting can be
 * cinematic or motion graphics; a combo offer can be UGC or a product showcase.
 * The director and the Seedance prompt both read the playbook for the chosen type.
 */

export const AD_TYPE_IDS = [
  "product",
  "multi_product",
  "combo_offer",
  "brand",
  "shop_service",
  "festival",
  "launch",
] as const;

export type AdTypeId = (typeof AD_TYPE_IDS)[number];

export interface AdTypePlaybook {
  id: AdTypeId;
  label: string;
  /** What the ad must achieve, in one line. */
  job: string;
  /** Story shape that suits this job. */
  structure: string;
  /** How products appear. */
  productRule: string;
  /** Ad types that can run with no product photo at all. */
  productPhotoOptional: boolean;
}

const PLAYBOOKS: Record<AdTypeId, AdTypePlaybook> = {
  product: {
    id: "product",
    label: "One product",
    job: "Make people want this one product and act now.",
    structure: "Hook → the product in use or in detail → one clear benefit → product hero with the call to action.",
    productRule: "The single product is the hero; show its real packaging clearly at least twice.",
    productPhotoOptional: false,
  },
  multi_product: {
    id: "multi_product",
    label: "Several products",
    job: "Show the range so viewers find the one they want.",
    structure: "Hook → each product gets its own clear moment (same visual treatment so they feel like one family) → all products together → call to action.",
    productRule: "Every listed product appears clearly and recognisably at least once, each matching its own reference photo; end with the products together.",
    productPhotoOptional: false,
  },
  combo_offer: {
    id: "combo_offer",
    label: "Combo or offer",
    job: "Sell the deal: what you get together and why it is worth it now.",
    structure: "Hook on the value → show each item in the combo → bring them together as one bundle (gathered on a table, packed into one bag or box) → the deal moment → call to action with urgency.",
    productRule: "All combo items are shown together at least once, clearly, as a bundle the buyer gets; prices and offer text are added in post, never drawn.",
    productPhotoOptional: false,
  },
  brand: {
    id: "brand",
    label: "Brand film",
    job: "Make people feel what the brand stands for so they remember and trust it.",
    structure: "An emotional or human idea that expresses the brand's values → a memorable moment → brand resolve (logo or signature product).",
    productRule: "Products are optional and supporting; the idea and the feeling lead. If a product appears, it matches its reference.",
    productPhotoOptional: true,
  },
  shop_service: {
    id: "shop_service",
    label: "Shop or service",
    job: "Make local customers trust the shop or service and come in, call or book.",
    structure: "The customer's need → the welcoming place, people and service in action → the result or happy customer → invitation to visit or call.",
    productRule: "Show the real kind of place and service (counter, kitchen, clinic, workshop) with warm, trustworthy staff; products only as part of the service.",
    productPhotoOptional: true,
  },
  festival: {
    id: "festival",
    label: "Festival greeting",
    job: "Greet customers for the occasion and connect the brand with the celebration.",
    structure: "Festive opening rooted in how the occasion is really celebrated → the brand or product as part of the celebration (gifting, sharing, family) → warm festive close.",
    productRule: "Products appear naturally inside the celebration, never forced; keep the festival's real customs, colours and setting accurate and respectful.",
    productPhotoOptional: true,
  },
  launch: {
    id: "launch",
    label: "New launch",
    job: "Announce something new and build excitement to try it first.",
    structure: "Tease → the reveal → what is new about it → be the first to try it.",
    productRule: "Hold the full product back until a deliberate reveal moment, then show it clearly as the hero.",
    productPhotoOptional: false,
  },
};

const ALIASES: Record<string, AdTypeId> = {
  product: "product",
  single_product: "product",
  multi_product: "multi_product",
  products: "multi_product",
  combo: "combo_offer",
  combo_offer: "combo_offer",
  offer: "combo_offer",
  brand: "brand",
  shop: "shop_service",
  service: "shop_service",
  shop_service: "shop_service",
  festival: "festival",
  launch: "launch",
};

export function normalizeAdType(value: unknown): AdTypeId | undefined {
  if (typeof value !== "string") return undefined;
  return ALIASES[value.trim().toLowerCase()];
}

export function getAdTypePlaybook(id: AdTypeId | undefined): AdTypePlaybook {
  return PLAYBOOKS[id ?? "product"];
}

/** Prompt block shared by the director, the concept generator and the video prompt. */
export function adTypeToPromptBlock(
  playbook: AdTypePlaybook,
  context: { productNames: string[]; occasion?: string; shopDetails?: string }
): string {
  const lines = [
    `Ad type: ${playbook.label}. Job: ${playbook.job}`,
    `Structure: ${playbook.structure}`,
    `Products: ${playbook.productRule}`,
  ];
  if (context.productNames.length > 1) {
    lines.push(`Products in this ad: ${context.productNames.map((n, i) => `${i + 1}. ${n}`).join("; ")}.`);
  }
  if (context.occasion) {
    lines.push(`Occasion: ${context.occasion} — use how it is really celebrated in India (customs, colours, food, clothing, decorations), respectfully.`);
  }
  if (context.shopDetails) {
    lines.push(`Shop / service details: ${context.shopDetails}.`);
  }
  return lines.join(" ");
}

/** Upcoming Indian occasions by month, for season-aware suggestions in the UI. */
export const OCCASIONS_BY_MONTH: Record<number, string[]> = {
  1: ["Pongal", "Makar Sankranti", "Republic Day"],
  2: ["Valentine's Day", "Maha Shivaratri"],
  3: ["Holi", "Ugadi", "Ramzan"],
  4: ["Tamil New Year", "Vishu", "Eid al-Fitr", "Baisakhi"],
  5: ["Mother's Day", "Summer Sale"],
  6: ["Father's Day", "Back to School"],
  7: ["Monsoon Sale"],
  8: ["Independence Day", "Raksha Bandhan", "Onam", "Krishna Jayanthi"],
  9: ["Ganesh Chaturthi", "Onam", "Navratri"],
  10: ["Navratri", "Dussehra", "Diwali"],
  11: ["Diwali", "Children's Day", "Wedding Season"],
  12: ["Christmas", "New Year"],
};

/** Occasions for this month and next, de-duplicated, in order. */
export function suggestedOccasions(date: Date = new Date()): string[] {
  const m = date.getMonth() + 1;
  const next = (m % 12) + 1;
  return Array.from(new Set([...(OCCASIONS_BY_MONTH[m] || []), ...(OCCASIONS_BY_MONTH[next] || [])]));
}
