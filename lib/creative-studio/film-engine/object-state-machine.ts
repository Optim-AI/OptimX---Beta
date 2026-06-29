/**
 * OptimX Film Engine — Object State Machine + Material Intelligence.
 *
 * Defines legal state transitions for product containers and how different
 * materials behave on screen. The physics engine uses this to reject impossible
 * actions (liquid from a closed bottle) and to inject the mechanical steps a
 * shot must show before a result.
 */

import type { MaterialKind } from "./types";

export interface ContainerProfile {
  id: string;
  label: string;
  match: RegExp;
  /** Ordered legal states. A shot may not jump states (e.g. Sealed → Pouring). */
  states: string[];
  /** Mechanical steps required to go from rest to dispensing. */
  sequence: string[];
}

export const CONTAINER_PROFILES: ContainerProfile[] = [
  {
    id: "pump_bottle",
    label: "Pump bottle (facewash, soap, lotion)",
    match: /facewash|face wash|cleanser|foaming|pump|soap|hand wash|sanitizer|lotion dispenser/i,
    states: ["Closed", "Picked up", "Pump pressed", "Dispensing", "Applied"],
    sequence: ["Pick up bottle", "Press pump", "Product dispenses to palm", "Apply"],
  },
  {
    id: "dropper_bottle",
    label: "Dropper bottle (beard oil, serum)",
    match: /beard oil|face oil|hair oil|serum|dropper|essence/i,
    states: ["Closed", "Cap unscrewed", "Dropper drawn", "Dispensing", "Applied"],
    sequence: ["Unscrew cap", "Draw dropper", "Squeeze drops out", "Apply"],
  },
  {
    id: "rtd_shake_bottle",
    label: "Ready-to-drink shake bottle (screw cap)",
    match:
      /protein\s*shake|ready[\s-]?to[\s-]?drink|\brtd\b|\b(protein|vitamin)\s+(shake|drink)\b|\bshake\s+bottle/i,
    states: ["Cap on", "Cap unscrewed", "Cap removed", "At lips", "Sipping"],
    sequence: [
      "Pick up bottle",
      "Unscrew and remove cap",
      "Open neck visible",
      "Raise to lips",
      "Sip",
    ],
  },
  {
    id: "screw_bottle",
    label: "Screw-cap bottle (shampoo, juice, liquid)",
    match: /shampoo|conditioner|bottle|juice|drink|beverage|body wash|oil\b/i,
    states: ["Closed", "Cap removed", "Tilted", "Pouring", "Empty"],
    sequence: ["Grip bottle", "Remove cap", "Tilt", "Liquid pours"],
  },
  {
    id: "food_packet",
    label: "Food / snack packet",
    match: /packet|pouch|chips|snack|noodle|granola|cereal|sachet/i,
    states: ["Sealed", "Torn open", "Opening visible", "Pouring", "Empty"],
    sequence: ["Hold packet", "Tear seal", "Opening visible", "Pour contents"],
  },
  {
    id: "jar",
    label: "Jar / canister (coffee, powder)",
    match: /coffee|protein powder|powder|jar|canister|tin/i,
    states: ["Closed", "Lid removed", "Open", "Scooping", "Transferring"],
    sequence: ["Open lid", "Spoon enters", "Scoop", "Transfer to vessel"],
  },
  {
    id: "tube",
    label: "Squeeze tube (toothpaste, cream)",
    match: /toothpaste|tooth paste|tube|ointment/i,
    states: ["Sealed", "Cap removed", "Squeezed", "Extruding"],
    sequence: ["Remove cap", "Squeeze tube", "Product extrudes"],
  },
  {
    id: "atomizer",
    label: "Atomizer / spray (perfume, mist)",
    match: /perfume|cologne|fragrance|mist|spray|atomiz/i,
    states: ["Capped", "Uncapped", "Pressed", "Misting"],
    sequence: ["Remove cap", "Press atomizer", "Mist disperses"],
  },
];

const DEFAULT_CONTAINER: ContainerProfile = {
  id: "generic",
  label: "General product",
  match: /$^/,
  states: ["At rest", "Handled", "Activated", "In use", "Result visible"],
  sequence: ["Show product", "Hands contact it", "Complete the activating action", "Show the result"],
};

export function detectContainerProfile(productName?: string, category?: string, description?: string): ContainerProfile {
  const haystack = `${productName || ""} ${category || ""} ${description || ""}`;
  return CONTAINER_PROFILES.find((p) => p.match.test(haystack)) ?? DEFAULT_CONTAINER;
}

/** A state is "open/dispensing capable" once it has progressed past the closed states. */
export function stateAllowsDispensing(profile: ContainerProfile, state: string): boolean {
  const idx = profile.states.findIndex((s) => s.toLowerCase() === state.trim().toLowerCase());
  if (idx < 0) return /open|pour|dispens|spray|squeez|scoop|appl|mist|extrud/i.test(state);
  // dispensing typically possible from the 3rd state onward
  return idx >= 2;
}

/** A state allows drinking/sipping once the cap is off (index >= 2 for RTD shake). */
export function stateAllowsConsumption(profile: ContainerProfile, state: string): boolean {
  if (profile.id === "rtd_shake_bottle") {
    const idx = stateIndex(profile, state);
    if (idx < 0) return /open|sip|drink|lips/i.test(state);
    return idx >= 2;
  }
  return stateAllowsDispensing(profile, state);
}

/** Index of a state within the profile, or -1 if unknown. */
export function stateIndex(profile: ContainerProfile, state: string): number {
  return profile.states.findIndex((s) => s.toLowerCase() === state.trim().toLowerCase());
}

// ───────────────────────────────────────────────────────────────────────────
// Material intelligence — how substances behave on screen.
// ───────────────────────────────────────────────────────────────────────────

export const MATERIAL_BEHAVIOR: Record<MaterialKind, string> = {
  water: "thin and fast — splashes, clear, runs quickly, light refraction",
  oil: "glossy and viscous — slow glassy drip, rich sheen, clings",
  cream: "thick and smooth — holds shape, smears, soft matte spread",
  foam: "airy and bubbly — expands, holds peaks, dissolves slowly",
  powder: "fine and dry — puffs, scatters, settles, no flow",
  granules: "discrete grains — pour and bounce, individual particles",
  honey: "very viscous — slow ribbon, continuous strand, glossy",
  gel: "translucent and bouncy — holds shape, jiggles, wet sheen",
  solid: "rigid — no flow, casts hard shadow, stable",
  glass: "transparent and reflective — refraction, caustics, specular edges",
  metal: "specular — sharp highlights, mirror reflections, cool tone",
  fabric: "soft drape — folds, wrinkles, subtle motion, matte",
  none: "behaves true to its real-world material",
};

export function materialBehavior(material?: MaterialKind): string {
  return MATERIAL_BEHAVIOR[material ?? "none"];
}
