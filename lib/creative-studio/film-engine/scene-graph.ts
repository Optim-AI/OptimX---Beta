/**
 * OptimX Film Engine — Scene Graph builder.
 *
 * Converts the loosely-typed storyboard (LLM JSON) into a structured Scene →
 * Shot → (FrameIntent, Actors, Objects, Camera, Transition) graph that the
 * physics, editor, continuity, and compressor engines can reason over.
 *
 * It is tolerant: if the storyboard is sparse, it derives a sensible graph from
 * the CreativeDirection's framework beats so the pipeline never produces an
 * orphan, beat-less shot list.
 */

import { AD_FRAMEWORKS } from "../ad-frameworks";
import type { AdFrameworkId } from "../strategy-types";
import type {
  ActorDirection,
  CameraPlan,
  CreativeDirection,
  FrameIntent,
  MaterialKind,
  Scene,
  SceneGraph,
  Shot,
  TrackedObject,
  TransitionPlan,
} from "./types";

/** Loose storyboard scene as produced by generate-script (superset of fields). */
export interface RawStoryboardScene {
  scene?: number;
  beat?: string;
  time_range?: string;
  duration?: string | number;
  visual_description?: string;
  description?: string;
  marketing_message?: string;
  shot_purpose?: string;
  emotion?: string;
  emotional_zone?: string;
  motion_style?: string;
  camera?: string;
  voiceover_line?: string;
  voiceover_script?: string;
  dialogue_direction?: string;
  transition_to_next?: string;
  product_state?: string;
  container_state?: string;
  proof_element?: string;
}

const BEAT_CANON: Array<{ test: RegExp; label: string }> = [
  { test: /hook|curiosity|interrupt|attention/i, label: "Hook" },
  { test: /problem|pain|struggle|frustrat|before/i, label: "Problem" },
  { test: /agitat/i, label: "Agitation" },
  { test: /discover|realiz|insight/i, label: "Discovery" },
  { test: /solution|product|demo|reveal/i, label: "Product" },
  { test: /transform|benefit|proof|result|after|social/i, label: "Transformation" },
  { test: /payoff|cta|brand|close|journey/i, label: "Payoff" },
];

export function canonicalBeat(beat?: string): string {
  if (!beat?.trim()) return "";
  for (const { test, label } of BEAT_CANON) {
    if (test.test(beat)) return label;
  }
  return beat.trim();
}

function parseTimeRange(timeRange?: string): { start: number; end: number } | null {
  if (!timeRange) return null;
  const m = timeRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { start: parseFloat(m[1]), end: parseFloat(m[2]) };
}

function parseDurationSeconds(scene: RawStoryboardScene): number {
  const range = parseTimeRange(scene.time_range);
  if (range) return Math.max(0.5, range.end - range.start);
  if (typeof scene.duration === "number" && scene.duration > 0) return scene.duration;
  if (typeof scene.duration === "string") {
    const n = parseFloat(scene.duration.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 2;
}

/** Infer material from product/category context so the material engine can reason. */
export function inferMaterial(productName?: string, category?: string): MaterialKind {
  const h = `${productName || ""} ${category || ""}`.toLowerCase();
  if (/foam|cleanser|facewash|face wash|mousse/.test(h)) return "foam";
  if (/oil|serum/.test(h)) return "oil";
  if (/cream|lotion|moistur|balm|paste|gel/.test(h)) return "cream";
  if (/honey|syrup|sauce/.test(h)) return "honey";
  if (/coffee|powder|protein|flour|spice/.test(h)) return "powder";
  if (/granule|cereal|sugar|salt|rice/.test(h)) return "granules";
  if (/juice|water|drink|beverage|tea|shampoo|wash/.test(h)) return "water";
  if (/glass|bottle|jar/.test(h)) return "glass";
  if (/metal|can|tin/.test(h)) return "metal";
  if (/fabric|cloth|apparel|shirt|wear/.test(h)) return "fabric";
  return "none";
}

function inferCamera(scene: RawStoryboardScene, direction: CreativeDirection): CameraPlan {
  const raw = (scene.motion_style || scene.camera || "").trim();
  const vis = (scene.visual_description || scene.description || "").toLowerCase();
  let shotSize = "medium shot";
  if (/close|macro|detail/.test(vis)) shotSize = "close-up";
  else if (/wide|establish|room|environment/.test(vis)) shotSize = "wide shot";
  return {
    shotSize,
    movement: raw || direction.filmStyle.movementStyle,
    motivation: "camera follows the action and emotion of this beat",
  };
}

function inferObjects(
  scene: RawStoryboardScene,
  direction: CreativeDirection,
  material: MaterialKind
): TrackedObject[] {
  const state = scene.container_state || scene.product_state;
  if (!state && !/product|bottle|packet|jar|pump|tube|can/i.test(scene.visual_description || "")) {
    return [];
  }
  return [
    {
      id: "product",
      label: direction.productName,
      state: state || "present in frame",
      material,
      notes: scene.product_state && scene.container_state
        ? `product: ${scene.product_state}; container: ${scene.container_state}`
        : undefined,
    },
  ];
}

function inferActors(scene: RawStoryboardScene): ActorDirection[] {
  const vis = (scene.visual_description || scene.description || "").toLowerCase();
  const hasPerson = /person|man|woman|hand|face|model|talent|she|he|they|user/.test(vis);
  const dialogue = (scene.voiceover_line || scene.voiceover_script || "").trim();
  if (!hasPerson && !dialogue) return [];
  return [
    {
      id: "talent",
      description: "on-screen talent consistent across all shots",
      emotion: scene.emotion || scene.emotional_zone || "natural",
      microActions: ["natural blink", "subtle posture shift", "micro-expression reacting to product"],
      dialogue: dialogue || undefined,
      dialogueDirection: scene.dialogue_direction || undefined,
    },
  ];
}

function inferTransition(prev: RawStoryboardScene, next?: RawStoryboardScene): TransitionPlan | undefined {
  if (!next) return undefined;
  const explicit = prev.transition_to_next?.trim();
  const pv = (prev.visual_description || "").toLowerCase();
  const nv = (next.visual_description || "").toLowerCase();
  let type = explicit || "Match Cut";
  if (!explicit) {
    if (/hand reach|grab|pick/.test(pv) && /open|unscrew|tear|press/.test(nv)) type = "Object Continuity";
    else if (/push|dolly|zoom/.test(pv)) type = "Camera Continuation";
    else if (/turn|look|glance|eye/.test(pv)) type = "Eye Line Match";
    else if (/pour|dispense|scoop|apply/.test(pv)) type = "Motion Continuity";
    else if (/whip|pan|swish/.test(pv) || /whip|pan/.test(nv)) type = "Whip Transition";
  }
  return {
    type,
    outgoing: (prev.visual_description || prev.description || "").slice(0, 80),
    incoming: (next.visual_description || next.description || "").slice(0, 80),
  };
}

/**
 * Build a SceneGraph from an LLM storyboard + CreativeDirection.
 * Each storyboard scene becomes one shot, grouped under its canonical beat.
 */
export function buildSceneGraph(
  storyboard: RawStoryboardScene[] | undefined,
  direction: CreativeDirection
): SceneGraph {
  const total = direction.totalDurationSeconds;
  const material = inferMaterial(direction.productName, direction.category);

  const scenes = storyboard?.length
    ? buildFromStoryboard(storyboard, direction, material)
    : buildFromFramework(direction, material);

  return {
    scenes,
    totalDurationSeconds: total,
    continuityLock: {
      character: "same talent, face, and hairstyle in every shot",
      product: `${direction.productName} — identical label, color, packaging, fill level progression`,
      lighting: direction.lightingIntent,
    },
  };
}

function buildFromStoryboard(
  storyboard: RawStoryboardScene[],
  direction: CreativeDirection,
  material: MaterialKind
): Scene[] {
  const scenesByBeat = new Map<string, Scene>();
  let runningStart = 0;

  storyboard.forEach((raw, idx) => {
    const beat = canonicalBeat(raw.beat) || beatForProgress(idx, storyboard.length);
    const duration = parseDurationSeconds(raw);
    const range = parseTimeRange(raw.time_range);
    const startSeconds = range ? range.start : runningStart;
    runningStart = startSeconds + duration;

    const frameIntent: FrameIntent = {
      purpose:
        raw.shot_purpose?.trim() ||
        raw.marketing_message?.trim() ||
        `advance the ${beat} beat`,
      marketingMessage: raw.marketing_message?.trim(),
      emotion: raw.emotion || raw.emotional_zone || emotionForBeat(beat),
      attentionFocus: raw.marketing_message?.trim() || raw.visual_description?.slice(0, 60) || beat,
    };

    const shot: Shot = {
      id: `shot-${idx + 1}`,
      index: idx,
      beat,
      startSeconds,
      durationSeconds: duration,
      frameIntent,
      actors: inferActors(raw),
      objects: inferObjects(raw, direction, material),
      camera: inferCamera(raw, direction),
      visualDescription: (raw.visual_description || raw.description || "").trim(),
      transitionToNext: inferTransition(raw, storyboard[idx + 1]),
    };

    let scene = scenesByBeat.get(beat);
    if (!scene) {
      scene = { id: `scene-${beat.toLowerCase()}`, beat, shots: [] };
      scenesByBeat.set(beat, scene);
    }
    scene.shots.push(shot);
  });

  return Array.from(scenesByBeat.values());
}

/** Derive a graph purely from the framework when no storyboard is available. */
function buildFromFramework(direction: CreativeDirection, material: MaterialKind): Scene[] {
  const beats = frameworkBeatLabels(direction.frameworkId);
  const total = direction.totalDurationSeconds;
  const per = total / beats.length;

  return beats.map((beat, idx) => {
    const startSeconds = Math.round(idx * per);
    const canon = canonicalBeat(beat) || beat;
    const shot: Shot = {
      id: `shot-${idx + 1}`,
      index: idx,
      beat: canon,
      startSeconds,
      durationSeconds: Math.max(1, Math.round(per)),
      frameIntent: {
        purpose: `advance the ${canon} beat`,
        emotion: emotionForBeat(canon),
        attentionFocus: canon,
      },
      actors: [],
      objects:
        /product|solution|demo|after|benefit|payoff/i.test(canon)
          ? [{ id: "product", label: direction.productName, state: "in use", material }]
          : [],
      camera: {
        shotSize: idx === beats.length - 1 ? "hero product shot" : "medium shot",
        movement: direction.filmStyle.movementStyle,
        motivation: "camera follows the beat's action",
      },
      visualDescription: "",
    };
    return { id: `scene-${idx}`, beat: canon, shots: [shot] };
  });
}

function frameworkBeatLabels(frameworkId?: AdFrameworkId): string[] {
  if (frameworkId && AD_FRAMEWORKS[frameworkId]) {
    return AD_FRAMEWORKS[frameworkId].beats.map((b) => String(b));
  }
  return ["Hook", "Problem", "Product", "Transformation", "Payoff"];
}

function beatForProgress(idx: number, count: number): string {
  const arc = ["Hook", "Problem", "Discovery", "Product", "Transformation", "Payoff"];
  const i = Math.min(arc.length - 1, Math.floor((idx / Math.max(1, count)) * arc.length));
  return arc[i];
}

function emotionForBeat(beat: string): string {
  switch (canonicalBeat(beat)) {
    case "Hook":
      return "Curiosity";
    case "Problem":
    case "Agitation":
      return "Tension";
    case "Discovery":
    case "Product":
      return "Discovery";
    case "Transformation":
      return "Satisfaction";
    case "Payoff":
      return "Resolution";
    default:
      return "engaged";
  }
}
