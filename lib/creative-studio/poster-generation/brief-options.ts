/**
 * Composer options for the poster brief: ad goals (with the details each goal
 * needs) and placements. Shared by the composer UI and the brief builder.
 * Pure module — safe in the browser.
 */

import type { PosterAdGoal, PosterAspectRatio } from "./types";

export type GoalDetailKey =
  | "offer"
  | "offerEnds"
  | "proof"
  | "occasion"
  | "orderBy"
  | "feature"
  | "transformation";

export type GoalDetails = Partial<Record<GoalDetailKey, string>>;

export type GoalOption = {
  id: PosterAdGoal;
  label: string;
  /** One line shown under the chip when selected */
  hint: string;
  fields: Array<{ key: GoalDetailKey; label: string; placeholder: string; required?: boolean }>;
};

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "launch",
    label: "Launch",
    hint: "Introduce a new product — the product is the hero.",
    fields: [],
  },
  {
    id: "offer",
    label: "Sale / Offer",
    hint: "Make the offer unmissable.",
    fields: [
      { key: "offer", label: "Offer", placeholder: "e.g. Flat 30% off", required: true },
      { key: "offerEnds", label: "Ends", placeholder: "e.g. this weekend only" },
    ],
  },
  {
    id: "festive",
    label: "Festive",
    hint: "An occasion poster that sells the product as a gift.",
    fields: [
      { key: "occasion", label: "Occasion", placeholder: "e.g. Diwali", required: true },
      { key: "orderBy", label: "Order by", placeholder: "e.g. 30 October" },
    ],
  },
  {
    id: "feature",
    label: "Feature",
    hint: "Prove one feature or benefit.",
    fields: [{ key: "feature", label: "Feature to show", placeholder: "e.g. 40-hour battery", required: true }],
  },
  {
    id: "before_after",
    label: "Before / After",
    hint: "Show the change the product makes.",
    fields: [
      { key: "transformation", label: "The change", placeholder: "e.g. frizzy to smooth hair in one use", required: true },
    ],
  },
  {
    id: "social_proof",
    label: "Social proof",
    hint: "Lead with what customers say.",
    fields: [
      { key: "proof", label: "Proof (exactly as it may be stated)", placeholder: "e.g. Rated 4.8/5 by 12,000+ customers", required: true },
    ],
  },
  {
    id: "awareness",
    label: "Awareness",
    hint: "Make the brand memorable.",
    fields: [],
  },
];

export type PlacementId = "instagram_feed" | "instagram_square" | "story_reel" | "whatsapp_status" | "web_banner";

export const PLACEMENT_OPTIONS: Array<{
  id: PlacementId;
  label: string;
  aspectRatio: PosterAspectRatio;
  platformHint: string;
}> = [
  { id: "instagram_feed", label: "Instagram / Facebook feed", aspectRatio: "4:5", platformHint: "Instagram and Facebook feed (mobile)" },
  { id: "instagram_square", label: "Square post", aspectRatio: "1:1", platformHint: "Square social post" },
  { id: "story_reel", label: "Story / Reel", aspectRatio: "9:16", platformHint: "Instagram Stories / Reels (keep top and bottom clear of app UI)" },
  { id: "whatsapp_status", label: "WhatsApp status", aspectRatio: "9:16", platformHint: "WhatsApp Status (full-screen vertical, viewed on phones)" },
  { id: "web_banner", label: "Web / link ad", aspectRatio: "1.91:1", platformHint: "Landscape link ad / website banner" },
];

/** The default placement for an aspect ratio (used when the user only picks a size). */
export function placementForAspect(aspect: PosterAspectRatio): PlacementId {
  return PLACEMENT_OPTIONS.find((p) => p.aspectRatio === aspect)?.id ?? "instagram_feed";
}

/** Required detail fields for a goal that are still empty. */
export function missingGoalDetails(goal: PosterAdGoal | null | undefined, details: GoalDetails): string[] {
  const option = GOAL_OPTIONS.find((g) => g.id === goal);
  if (!option) return [];
  return option.fields.filter((f) => f.required && !(details[f.key] || "").trim()).map((f) => f.label);
}
