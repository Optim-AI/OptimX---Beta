/**
 * OptimX Film Engine — Application Site Intelligence.
 *
 * Where does a product actually get applied? A face serum goes on the FACE, not
 * the forearm. Body lotion goes on arms/legs. Hair oil on the scalp. Getting
 * this wrong produces nonsense ads (serum rubbed on an elbow), so the engine
 * resolves the correct, on-body site per product and tells the renderer to use
 * ONLY that site — while staying modest and brand-safe.
 */

export type ApplicationSite =
  | "face"
  | "under-eye"
  | "lips"
  | "hair-scalp"
  | "beard"
  | "hands"
  | "nails"
  | "teeth"
  | "body"
  | "feet"
  | "none";

export interface ApplicationSpec {
  site: ApplicationSite;
  /** Human phrase used directly in the prompt. */
  siteDescription: string;
  /** The applying gesture. */
  gesture: string;
  /** Sites the model must NOT use (prevents the "serum on arm" bug). */
  forbiddenSites: string[];
  /** True when the site is inherently exposed & modest (face, hands, hair). */
  modestByDefault: boolean;
}

interface SiteRule {
  match: RegExp;
  spec: ApplicationSpec;
}

const SITE_RULES: SiteRule[] = [
  {
    // Eye-specific first (more specific than generic face).
    match: /\b(under[-\s]?eye|eye cream|eye serum|dark circle)\b/i,
    spec: {
      site: "under-eye",
      siteDescription: "the under-eye area, dabbed gently with a ring finger",
      gesture: "gentle tapping/patting motion under the eyes",
      forbiddenSites: ["arm", "forearm", "elbow", "leg", "hand back"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(lip balm|lip mask|lip oil|lipstick|lip care|chapstick)\b/i,
    spec: {
      site: "lips",
      siteDescription: "the lips",
      gesture: "applying along the lips",
      forbiddenSites: ["arm", "forearm", "elbow", "leg"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(beard oil|beard balm|beard|moustache)\b/i,
    spec: {
      site: "beard",
      siteDescription: "the beard and jawline, massaged into facial hair",
      gesture: "massaging into the beard along the jaw",
      forbiddenSites: ["arm", "forearm", "elbow", "leg"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(shampoo|conditioner|hair oil|hair serum|hair mask|scalp|hair growth|anti[-\s]?dandruff)\b/i,
    spec: {
      site: "hair-scalp",
      siteDescription: "the hair and scalp",
      gesture: "massaging into the scalp / running through hair",
      forbiddenSites: ["arm", "forearm", "elbow", "leg"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(hand cream|hand wash|hand sanitiz|hand lotion|cuticle)\b/i,
    spec: {
      site: "hands",
      siteDescription: "the hands, rubbed between palms and over the back of the hand",
      gesture: "rubbing into the hands",
      forbiddenSites: ["face", "arm", "leg"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(nail|cuticle oil|nail polish)\b/i,
    spec: {
      site: "nails",
      siteDescription: "the fingernails and cuticles",
      gesture: "applying to the nails",
      forbiddenSites: ["face", "arm", "leg"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(toothpaste|tooth\s?paste|mouthwash|teeth whiten)\b/i,
    spec: {
      site: "teeth",
      siteDescription: "the teeth (brushing) / mouth",
      gesture: "brushing teeth",
      forbiddenSites: ["arm", "leg", "face skin"],
      modestByDefault: true,
    },
  },
  {
    // FACE — broad skincare. Placed AFTER eye/lip/beard so they win when specific.
    match: /\b(face\s?wash|facewash|cleanser|face cream|face serum|face oil|facial|moisturiz|moisturis|vitamin c|niacinamide|retinol|hyaluronic|toner|essence|spf|sunscreen|day cream|night cream|brighten|anti[-\s]?aging|serum)\b/i,
    spec: {
      site: "face",
      siteDescription: "the face — cheeks, forehead, nose and jawline",
      gesture: "smoothing/massaging over the face with fingertips",
      forbiddenSites: ["arm", "forearm", "elbow", "leg", "back of hand only"],
      modestByDefault: true,
    },
  },
  {
    // BODY products — modest sites only (forearm / lower leg), fully clothed.
    match: /\b(body lotion|body butter|body wash|body oil|body cream|shower gel|moisturizing lotion|bath)\b/i,
    spec: {
      site: "body",
      siteDescription: "the forearms or lower legs only (model stays fully clothed)",
      gesture: "smoothing onto the forearm / lower leg",
      forbiddenSites: ["chest", "torso", "back", "intimate areas", "face"],
      modestByDefault: true,
    },
  },
  {
    match: /\b(foot|feet|heel|foot cream)\b/i,
    spec: {
      site: "feet",
      siteDescription: "the feet and heels",
      gesture: "massaging into the heels",
      forbiddenSites: ["face", "chest"],
      modestByDefault: true,
    },
  },
];

const NON_TOPICAL: ApplicationSpec = {
  site: "none",
  siteDescription: "used/demonstrated naturally for its real purpose (not rubbed on skin)",
  gesture: "natural use appropriate to the product",
  forbiddenSites: ["random skin application"],
  modestByDefault: true,
};

/**
 * Resolve the correct application site for a product. Returns `none` for
 * products that are not applied to the body (food, drinks, gadgets, apparel…).
 */
export function resolveApplicationSite(
  productName?: string,
  category?: string,
  description?: string
): ApplicationSpec {
  const haystack = `${productName || ""} ${category || ""} ${description || ""}`;

  // Non-topical categories short-circuit to "none".
  if (/\b(food|snack|noodle|drink|beverage|coffee|tea|juice|supplement|gadget|device|app|software|apparel|shoe|cloth|wear)\b/i.test(haystack)) {
    // …unless it's clearly a topical sub-product (e.g. "coffee body scrub").
    if (!/\b(scrub|lotion|cream|serum|oil|mask|balm)\b/i.test(haystack)) {
      return NON_TOPICAL;
    }
  }

  for (const rule of SITE_RULES) {
    if (rule.match.test(haystack)) return rule.spec;
  }
  return NON_TOPICAL;
}

/** Prompt-ready directive that forces the right site and forbids the wrong ones. */
export function applicationSiteDirective(spec: ApplicationSpec): string {
  if (spec.site === "none") {
    return `Product use: ${spec.siteDescription}. Do not invent a skin-application shot.`;
  }
  return (
    `Application site (CRITICAL): apply ONLY to ${spec.siteDescription}. ` +
    `Gesture: ${spec.gesture}. ` +
    `Never apply this product to: ${spec.forbiddenSites.join(", ")}.`
  );
}
