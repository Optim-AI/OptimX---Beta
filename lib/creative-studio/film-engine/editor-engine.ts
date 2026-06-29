/**
 * OptimX Film Engine — Editor + Storytelling engine.
 *
 * The editor brain judges whether the cut works as a STORY, not a montage:
 *  - every shot must have a purpose (reject "looks cool")
 *  - the beat order must progress (Hook → … → Payoff)
 *  - the product must be revealed by the planned moment
 *  - transitions between shots must be motivated
 *  - the emotional arc must rise and resolve
 *
 * Like the physics engine, it returns issues and an ordering — it does not throw.
 */

import { flattenShots } from "./types";
import type {
  CreativeDirection,
  SceneGraph,
  Shot,
  ValidationIssue,
  ValidationResult,
} from "./types";

/** Canonical narrative order used to detect out-of-order beats. */
const BEAT_ORDER = [
  "Hook",
  "Problem",
  "Agitation",
  "Discovery",
  "Product",
  "Transformation",
  "Payoff",
];

const FILLER_PHRASES = [
  "looks cool",
  "looks great",
  "beautiful shot",
  "cinematic shot",
  "nice visual",
  "aesthetic",
];

function beatRank(beat: string): number {
  const idx = BEAT_ORDER.indexOf(beat);
  return idx < 0 ? BEAT_ORDER.length : idx;
}

/** Validate the edit as a story. */
export function validateEdit(graph: SceneGraph, direction: CreativeDirection): ValidationResult {
  const shots = flattenShots(graph);
  const issues: ValidationIssue[] = [];

  if (shots.length === 0) {
    return { ok: false, issues: [{ severity: "error", message: "No shots to edit." }] };
  }

  // 1. Every shot must justify itself.
  shots.forEach((shot) => {
    const purpose = shot.frameIntent.purpose?.trim().toLowerCase() || "";
    if (!purpose) {
      issues.push({
        severity: "warning",
        shotIndex: shot.index,
        message: `Shot ${shot.index + 1} has no stated purpose.`,
        fix: "Give it a marketing/story reason or cut it.",
      });
    } else if (FILLER_PHRASES.some((p) => purpose.includes(p)) && purpose.length < 40) {
      issues.push({
        severity: "warning",
        shotIndex: shot.index,
        message: `Shot ${shot.index + 1} exists only because it "${purpose}" — not a story reason.`,
        fix: "Replace with a beat purpose (advance story, reveal product, build proof, deliver payoff).",
      });
    }
  });

  // 2. Beats should generally progress forward.
  let maxRank = -1;
  shots.forEach((shot) => {
    const rank = beatRank(shot.beat);
    if (rank < maxRank - 1) {
      issues.push({
        severity: "info",
        shotIndex: shot.index,
        message: `Shot ${shot.index + 1} (${shot.beat}) jumps backward in the narrative.`,
        fix: "Re-order toward Hook → Problem → Product → Transformation → Payoff unless intentional.",
      });
    }
    maxRank = Math.max(maxRank, rank);
  });

  // 3. Product must be revealed by the planned moment.
  const revealAt = direction.productRevealStrategy.revealAtSeconds;
  const firstProductShot = shots.find((s) => s.objects.some((o) => o.id === "product"));
  if (!firstProductShot) {
    issues.push({
      severity: "error",
      message: "Product never clearly appears in any shot.",
      fix: `Reveal ${direction.productName} by ~${revealAt}s.`,
    });
  } else if (firstProductShot.startSeconds > revealAt + Math.max(2, revealAt * 0.4)) {
    issues.push({
      severity: "warning",
      shotIndex: firstProductShot.index,
      message: `Product first appears at ${firstProductShot.startSeconds}s, later than planned ~${revealAt}s.`,
      fix: "Move the product reveal earlier so the benefit has time to land.",
    });
  }

  // 4. Must end on a payoff / hero.
  const last = shots[shots.length - 1];
  if (beatRank(last.beat) < beatRank("Transformation")) {
    issues.push({
      severity: "warning",
      shotIndex: last.index,
      message: `Film ends on "${last.beat}" — no payoff/brand lock-in.`,
      fix: "Close on a Transformation or Payoff beat with the hero product + CTA.",
    });
  }

  // 5. Transitions should be motivated, not random.
  shots.forEach((shot) => {
    if (shot.transitionToNext && /random|hard random|jump/i.test(shot.transitionToNext.type)) {
      issues.push({
        severity: "info",
        shotIndex: shot.index,
        message: `Transition after shot ${shot.index + 1} is unmotivated (${shot.transitionToNext.type}).`,
        fix: "Use match cut, object/motion continuity, or eye-line match.",
      });
    }
  });

  return { ok: issues.every((i) => i.severity !== "error"), issues };
}

/**
 * Return shots in coherent narrative order. Stable: preserves original order
 * within the same beat, only fixing gross beat-level disorder.
 */
export function orderShotsForStory(graph: SceneGraph): Shot[] {
  return flattenShots(graph)
    .map((shot, i) => ({ shot, i }))
    .sort((a, b) => {
      const r = beatRank(a.shot.beat) - beatRank(b.shot.beat);
      if (r !== 0) return r;
      return a.shot.startSeconds - b.shot.startSeconds || a.i - b.i;
    })
    .map(({ shot }) => shot);
}

/** Compact editor/storytelling directive for the renderer. */
export function editorPromptDigest(direction: CreativeDirection): string {
  return [
    `Editing: ${direction.editingStyle}.`,
    `One continuous story, motivated cuts only — never a stitched montage.`,
    `Arc must rise and resolve: ${direction.emotionalJourney.map((b) => b.emotion).join(" → ")}.`,
    `End on the hero + CTA: "${direction.cta}".`,
  ].join(" ");
}
