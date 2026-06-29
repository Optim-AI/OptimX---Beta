/**
 * OptimX Film Engine — Prompt Compressor.
 *
 * Model-agnostic compression. Takes the full reasoning (direction + scene graph
 * + physics/editor digests) and produces a prioritized, budget-respecting block
 * of prompt sections. Renderers feed their token budget in; the compressor drops
 * the lowest-priority sections first so the hook, product, and CTA always survive.
 */

import {
  applicationSiteDirective,
  resolveApplicationSite,
} from "./application-site";
import type { BrandPromptContext } from "../brand-context";
import { buildBrandContextBlock } from "../brand-context";
import type { CreativeDirection, SceneGraph, Shot } from "./types";
import { flattenShots } from "./types";

/**
 * Anatomy + continuity lock. Prevents the most common AI-video defects
 * (extra/duplicate limbs, warped hands, morphing bodies) which are worst at
 * cut/transition boundaries. Kept terse so it survives token budgeting.
 */
export function anatomyLockDirective(): string {
  return (
    "Anatomy lock: exactly one consistent person; anatomically correct body with " +
    "two arms, two hands, five fingers each; no duplicate, extra, or floating limbs; " +
    "no warped or merged hands; body stays consistent through every frame and cut. " +
    "Transitions are clean hard/match cuts to a fresh angle — never morphs or melts " +
    "that spawn extra limbs."
  );
}

/** ~4 chars per token heuristic — same approximation used for Veo budgeting. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().length / 4);
}

export interface PromptSection {
  /** Lower number = higher priority = kept longest. */
  priority: number;
  label: string;
  text: string;
}

/** Build prioritized sections for a single clip (segment of the full film). */
export function buildPromptSections(args: {
  direction: CreativeDirection;
  graph: SceneGraph;
  voiceover?: string;
  physicsDigest?: string;
  editorDigest?: string;
  aspectRatio: string;
  segmentIndex?: number;
  segmentCount?: number;
  brandContext?: BrandPromptContext;
}): PromptSection[] {
  const {
    direction,
    graph,
    voiceover,
    physicsDigest,
    editorDigest,
    aspectRatio,
    brandContext,
  } = args;
  const shots = selectSegmentShots(graph, args.segmentIndex, args.segmentCount);
  const sections: PromptSection[] = [];

  // P0 — the spoken ad (most important for "feels like an ad").
  if (voiceover?.trim()) {
    sections.push({
      priority: 0,
      label: "Voiceover",
      text: `Spoken ad (natural delivery, lip-synced if on camera): "${voiceover.trim()}"`,
    });
  }

  // P1 — what we're selling + the core message.
  sections.push({
    priority: 1,
    label: "Brief",
    text: `${direction.filmStyle.label} ${direction.totalDurationSeconds}s ad for ${
      direction.brandName ? direction.brandName + " " : ""
    }${direction.productName}. ${direction.coreMessage}. CTA: ${direction.cta}.`,
  });

  const brandBlock = buildBrandContextBlock(brandContext, direction.brandName);
  if (brandBlock) {
    sections.push({ priority: 1, label: "Brand", text: brandBlock });
  }

  // Segment 2 stitch continuity (same talent, no morph/extra limbs).
  if (args.segmentIndex === 1 && (args.segmentCount ?? 0) > 1) {
    sections.push({
      priority: 2,
      label: "Continuity",
      text:
        "SEGMENT 2: continue the SAME story, person, wardrobe, lighting, and product from segment 1. " +
        "If a continuity frame reference is attached, match it exactly. " +
        "Match-cut or motivated angle only — no scene reset, no duplicate limbs, no morphing.",
    });
  }

  // P2 — correctness constraints (NEVER dropped): application site + anatomy.
  const appSpec = resolveApplicationSite(
    direction.productName,
    direction.category,
    direction.coreMessage
  );
  sections.push({
    priority: 2,
    label: "Constraints",
    text: `${applicationSiteDirective(appSpec)} ${anatomyLockDirective()}`,
  });

  // P3 — shot-by-shot action (the actual film).
  sections.push({
    priority: 3,
    label: "Shots",
    text: shots.map(renderShotLine).join(" "),
  });

  // P4 — look & camera.
  sections.push({
    priority: 4,
    label: "Look",
    text: `Camera: ${direction.cameraIntent}. Light: ${direction.lightingIntent}. Grade: ${direction.filmStyle.colorScience}. ${direction.filmStyle.references}.`,
  });

  // P5 — physical realism.
  if (physicsDigest?.trim()) {
    sections.push({ priority: 5, label: "Physics", text: physicsDigest.trim() });
  }

  // P6 — edit / story discipline.
  if (editorDigest?.trim()) {
    sections.push({ priority: 6, label: "Edit", text: editorDigest.trim() });
  }

  // P7 — format guardrails.
  sections.push({
    priority: 7,
    label: "Format",
    text: `Aspect ${aspectRatio}. Photoreal, broadcast quality. STRICT zero on-screen text — no captions, slogans, floating brand typography, flavor callouts, or end-card words. Brand and product names in voiceover only. Product identical to reference pack.`,
  });

  return sections;
}

function renderShotLine(shot: Shot, i: number): string {
  const cam = `${shot.camera.shotSize}, ${shot.camera.movement}`;
  const action = shot.visualDescription || shot.frameIntent.purpose;
  const obj = shot.objects.find((o) => o.id === "product");
  const state = obj ? ` [${obj.label}: ${obj.state}]` : "";
  const emo = shot.frameIntent.emotion ? ` (${shot.frameIntent.emotion})` : "";
  const trans = shot.transitionToNext ? ` →${shot.transitionToNext.type}` : "";
  return `${i + 1}. ${shot.beat}: ${action}${state} — ${cam}${emo}.${trans}`;
}

/** Pick the shots belonging to a given segment when the film is split into clips. */
export function selectSegmentShots(
  graph: SceneGraph,
  segmentIndex?: number,
  segmentCount?: number
): Shot[] {
  const shots = flattenShots(graph);
  if (!segmentCount || segmentCount <= 1 || segmentIndex == null) return shots;

  const totalDur = graph.totalDurationSeconds;
  const segLen = totalDur / segmentCount;
  const start = segmentIndex * segLen;
  const end = start + segLen;
  const inWindow = shots.filter((s) => s.startSeconds >= start - 0.01 && s.startSeconds < end - 0.01);
  // Always return at least one shot so a segment is never empty.
  if (inWindow.length) return inWindow;
  const fallbackIdx = Math.min(shots.length - 1, Math.floor(segmentIndex * (shots.length / segmentCount)));
  return [shots[fallbackIdx]];
}

/**
 * Compress sections into a single prompt string within `maxTokens`.
 * Strategy: keep all sections if they fit; otherwise drop from the
 * lowest-priority end, then truncate the Shots section as a last resort.
 */
export function compressToBudget(sections: PromptSection[], maxTokens: number): { prompt: string; estimatedTokens: number } {
  const ordered = [...sections].sort((a, b) => a.priority - b.priority);

  let kept = [...ordered];
  const join = (list: PromptSection[]) => list.sort((a, b) => a.priority - b.priority).map((s) => s.text).join("\n");

  while (kept.length > 1 && estimateTokens(join(kept)) > maxTokens) {
    // remove current lowest priority (highest priority number)
    let dropIdx = 0;
    let dropPr = -1;
    kept.forEach((s, i) => {
      if (s.priority > dropPr) {
        dropPr = s.priority;
        dropIdx = i;
      }
    });
    // Never drop P0–P3 (voiceover, brief, correctness constraints, shots).
    if (dropPr <= 3) break;
    kept.splice(dropIdx, 1);
  }

  let prompt = join(kept);
  if (estimateTokens(prompt) > maxTokens) {
    prompt = truncateToTokens(prompt, maxTokens);
  }
  return { prompt, estimatedTokens: estimateTokens(prompt) };
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
  return (lastStop > maxChars * 0.6 ? slice.slice(0, lastStop + 1) : slice).trim();
}
