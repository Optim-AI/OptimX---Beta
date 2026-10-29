/** Photo Studio shared types (see docs/PHOTO_STUDIO_DESIGN.md). */

export type PhotoAspect = "1:1" | "4:5" | "9:16";

/** exact = deterministic composite of the real cut-out; scene = AI set + real cut-out
 *  composited and relit; guided = AI renders the product (held/used) from the photo. */
export type ShotMethod = "exact" | "scene" | "guided";

export type ShotGroup = "catalogue" | "studio" | "lifestyle" | "people";

export type LightingMood = "studio_soft" | "natural_daylight" | "golden_hour" | "dramatic";

export type ModelPreferences = {
  gender?: "any" | "woman" | "man";
  age?: "any" | "18-25" | "25-40" | "40+";
  /** Free text, e.g. "South Asian, casual streetwear" */
  look?: string;
};

export type ShootSettings = {
  aspect: PhotoAspect;
  lighting: LightingMood;
  /** Backdrop / set colour (hex), usually a brand colour */
  backdrop: string;
  model?: ModelPreferences;
};

export type ProductProfile = {
  name: string;
  productType: string;
  category: string;
  /** Packaging / surface finish: glossy, matte, glass, metal, fabric… */
  finish: string;
  sizeClass: "tiny" | "handheld" | "tabletop" | "large";
  colors: string[];
  usageContexts: string[];
  audience: string;
  /** Props or ingredients that tell what it is (e.g. chillies, anchovies) */
  storyProps: string[];
  isFood: boolean;
  isWearable: boolean;
  /** How the uploaded photo shows it */
  viewAngle: "front" | "three_quarter" | "top_down" | "side" | "unknown";
  /** Photo has a plain, uniform background (cut-out friendly) */
  plainBackground: boolean;
  /** A hand or another object touches/overlaps the product in the photo */
  obstructed?: boolean;
  notes: string;
};

export type ShotDefinition = {
  id: string;
  group: ShotGroup;
  label: string;
  /** Where the photo is used */
  purpose: string;
  description: string;
  method: ShotMethod;
  defaultAspect: PhotoAspect;
  usesModel?: boolean;
};

export type ShotResult = {
  shotId: string;
  url: string;
  method: ShotMethod;
  aspect: PhotoAspect;
  /** Guided shots: fidelity score 0–10 from the check (null when not checked) */
  fidelity?: number | null;
  createdAt: string;
};
