/** Photo Studio shared types (see docs/PHOTO_STUDIO_DESIGN.md). */

export type PhotoAspect = "1:1" | "4:5" | "9:16";

/** exact = deterministic composite of the real cut-out; scene = AI set + real cut-out
 *  composited and relit; guided = AI renders the product (held/used) from the photo. */
export type ShotMethod = "exact" | "scene" | "guided";

export type ProductKind = "packaged_food" | "beverage" | "cafe_food" | "beauty" | "fashion" | "other";

export type ShotGroup = "catalogue" | "studio" | "lifestyle" | "people" | "creative";

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
  /** What kind of product — decides which category shots are offered */
  kind?: ProductKind;
  /** A hand or another object touches/overlaps the product in the photo */
  obstructed?: boolean;
  /** One sentence on how the product looks (container, colours, label), used in prompts */
  look?: string;
  /** The main words printed on it, spelled exactly, largest first */
  labelText?: string[];
  notes: string;
};

/** A scene written for one shot of one product (see art-direct.ts). */
export type ShotBrief = {
  /** The finished photograph in words: setting, props, camera angle, product pose, light */
  scene: string;
  /** Where the product stands in pasted-product (scene) shots */
  placement?: "left" | "centre" | "right";
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
  /** Only offered for these product kinds (category shots) */
  kinds?: ProductKind[];
  /** Scene shots: "laid" = the product lies flat, shot from directly above (flat lay) */
  pose?: "upright" | "laid";
};

export type ShotResult = {
  shotId: string;
  url: string;
  method: ShotMethod;
  aspect: PhotoAspect;
  /** Guided shots: fidelity score 0–10 from the check (null when not checked) */
  fidelity?: number | null;
  createdAt: string;
  /** Set on an edited photo: the photo it was made from */
  editedFrom?: string;
  /** The person's own words for the edit */
  editRequest?: string;
  /** Stable id of this photo (photos made before keep-to-pay have none) */
  id?: string;
  /**
   * false = a free draft: only a watermarked preview is shown until it is kept (1 image
   * credit). true = kept and paid for. Missing = made before keep-to-pay, already delivered.
   */
  kept?: boolean;
  keptAt?: string;
  /** Full-quality file in the private drafts bucket (server only, never sent to the browser) */
  storagePath?: string;
  /** Watermarked preview in the private drafts bucket (server only) */
  previewPath?: string;
  /** The full file has been copied to the public bucket; `url` is its public address */
  published?: boolean;
};

/** A photo as the browser sees it: a preview for drafts, the full file once kept. */
export type PhotoView = Omit<ShotResult, "storagePath" | "previewPath" | "published"> & { id: string; kept: boolean };
