/**
 * OptimX Film Engine — core contracts.
 *
 * This file defines the model-agnostic data structures every engine reads and
 * writes. The reasoning pipeline (creative director → scene graph → physics →
 * editor → compressor) operates entirely on these types. Only the final
 * renderer adapter knows which video model (Veo, Runway, Kling, …) it targets.
 *
 * Rule: engines ENRICH and VALIDATE these structures. They never re-decide
 * something the Creative Director already decided.
 */

import type { AdFrameworkId } from "../strategy-types";

// ───────────────────────────────────────────────────────────────────────────
// Film style profiles — declarative, replaces `if (style === ...)` branching.
// Add a new cinematic style by adding a profile, not by editing logic.
// ───────────────────────────────────────────────────────────────────────────

export type PacingProfile = "slow-burn" | "measured" | "punchy" | "rapid";

export type EmotionalWeight = "light" | "warm" | "intense" | "premium" | "raw";

export type RealismLevel = "photoreal" | "stylized" | "animated";

export interface FilmStyle {
  /** Stable id, e.g. "apple_premium". */
  id: string;
  /** Human label, e.g. "Apple — Premium Minimal". */
  label: string;
  /** Matching tokens (creativeFormat/style/userDescription) used for lookup. */
  match: string[];
  pacing: PacingProfile;
  cameraLanguage: string;
  editingGrammar: string;
  lightingLanguage: string;
  movementStyle: string;
  colorScience: string;
  emotionalWeight: EmotionalWeight;
  transitionRules: string;
  realismLevel: RealismLevel;
  /** Short reference shorthand, e.g. "Apple product films, Sony A7S, soft key". */
  references: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Creative Direction — the master decision object.
// Produced once by the Creative Director. Every downstream engine reads it.
// ───────────────────────────────────────────────────────────────────────────

export interface EmotionalBeat {
  /** Progress window, e.g. "0-20%". */
  zone: string;
  /** Target emotion, e.g. "Curiosity". */
  emotion: string;
  /** What must happen emotionally in this window. */
  intent: string;
}

/** Viewer Attention plan — what the eye looks at, for how long, and why it moves. */
export interface AttentionCue {
  /** What the viewer is looking at. */
  focus: string;
  /** Approximate dwell time before attention should move. */
  durationSeconds: number;
  /** Emotion this focus should create. */
  emotion: string;
  /** What motivates attention to move to the next focus (action, eyeline, motion). */
  moveTrigger: string;
}

export interface ProductRevealStrategy {
  /** When the product first clearly appears. */
  revealAtSeconds: number;
  /** How it is revealed (earned by story, not a random insert). */
  revealStyle: string;
  /** The closing hero composition. */
  heroMoment: string;
}

export interface CreativeDirection {
  // — Strategy —
  campaignObjective: string;
  audiencePsychology: string;
  coreMessage: string;
  hookType: string;
  cta: string;
  frameworkId?: AdFrameworkId;

  // — Emotion + attention —
  emotionalJourney: EmotionalBeat[];
  viewerAttentionPlan: AttentionCue[];

  // — Product —
  productRevealStrategy: ProductRevealStrategy;

  // — Craft intent (what, not how-as-code) —
  pacingCurve: PacingProfile;
  visualHierarchy: string[];
  cameraIntent: string;
  lightingIntent: string;
  editingStyle: string;
  soundIntent: string;
  performanceStyle: string;
  realismLevel: RealismLevel;
  cinematicReferences: string;

  // — Resolved style profile —
  filmStyle: FilmStyle;

  // — Bookkeeping —
  totalDurationSeconds: number;
  productName: string;
  brandName: string;
  category?: string;
}

/** Input the Creative Director reasons over. Maps 1:1 from API request fields. */
export interface CreativeDirectorInput {
  brandName?: string;
  productName?: string;
  category?: string;
  userDescription?: string;
  creativeFormat?: string;
  style?: string;
  hookType?: string;
  campaignGoal?: string;
  cta?: string;
  keyMessage?: string;
  totalDurationSeconds: number;
  creativeStrategy?: {
    targetAudience?: string;
    corePainPoint?: string;
    coreDesire?: string;
    biggestObjection?: string;
    campaignGoal?: string;
    hookType?: string;
    creativeAngle?: string;
    cta?: string;
    conversionObjective?: string;
    frameworkId?: AdFrameworkId;
  };
  /** Force a specific film style profile (from preview variants). */
  filmStyleId?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Scene Graph — structured replacement for flat storyboard strings.
// Scene → Shot → (FrameIntent, Actors, Objects, Camera, Transition)
// ───────────────────────────────────────────────────────────────────────────

/** Physical material — drives how substances should behave on screen. */
export type MaterialKind =
  | "water"
  | "oil"
  | "cream"
  | "foam"
  | "powder"
  | "granules"
  | "honey"
  | "gel"
  | "solid"
  | "glass"
  | "metal"
  | "fabric"
  | "none";

/** A tracked physical object and its current state at a given shot. */
export interface TrackedObject {
  /** Stable id across shots, e.g. "bottle". */
  id: string;
  label: string;
  /** Current state at this shot, e.g. "Closed" | "Pouring". */
  state: string;
  material?: MaterialKind;
  /** Free-form notes (fill level, wetness…) carried by the visual memory engine. */
  notes?: string;
}

export interface ActorDirection {
  id: string;
  description: string;
  emotion: string;
  /** Natural micro-actions (blink, grip shift, posture) — anti-mannequin. */
  microActions: string[];
  dialogue?: string;
  dialogueDirection?: string;
}

export interface CameraPlan {
  shotSize: string;
  movement: string;
  lens?: string;
  /** Why the camera does what it does — never unmotivated. */
  motivation: string;
}

export interface TransitionPlan {
  /** Match Cut, Object Continuity, Eye Line Match, Motion Continuity, … */
  type: string;
  outgoing: string;
  incoming: string;
}

export interface FrameIntent {
  /** Why this shot exists (editor brain rejects "looks cool"). */
  purpose: string;
  marketingMessage?: string;
  emotion: string;
  attentionFocus: string;
}

export interface Shot {
  id: string;
  index: number;
  beat: string;
  startSeconds: number;
  durationSeconds: number;
  frameIntent: FrameIntent;
  actors: ActorDirection[];
  objects: TrackedObject[];
  camera: CameraPlan;
  visualDescription: string;
  transitionToNext?: TransitionPlan;
}

export interface Scene {
  id: string;
  beat: string;
  shots: Shot[];
}

export interface SceneGraph {
  scenes: Scene[];
  totalDurationSeconds: number;
  /** Continuity anchors locked across all shots (wardrobe, location, lighting…). */
  continuityLock: {
    character?: string;
    wardrobe?: string;
    location?: string;
    lighting?: string;
    timeOfDay?: string;
    product?: string;
  };
}

/** Flat shot view — convenience for engines that iterate shots regardless of scene. */
export function flattenShots(graph: SceneGraph): Shot[] {
  return graph.scenes.flatMap((s) => s.shots).sort((a, b) => a.index - b.index);
}

// ───────────────────────────────────────────────────────────────────────────
// Validation — physics / continuity engines return issues, never mutate blindly.
// ───────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  shotIndex?: number;
  objectId?: string;
  message: string;
  /** Suggested fix the LLM/regenerator can apply. */
  fix?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

// ───────────────────────────────────────────────────────────────────────────
// Renderer abstraction — model-agnostic. Only adapters know the target model.
// ───────────────────────────────────────────────────────────────────────────

export interface RenderRequest {
  direction: CreativeDirection;
  sceneGraph: SceneGraph;
  voiceoverScript?: string;
  aspectRatio: string;
  clipDurationSeconds: number;
  totalDurationSeconds: number;
  hasReferenceImages: boolean;
  headline?: string;
  subtext?: string;
}

/** Renderer output — a single clip's prompt, already within the model's budget. */
export interface CompressedShotPlan {
  prompt: string;
  voiceover?: string;
  durationSeconds: number;
  aspectRatio: string;
  segmentIndex?: number;
  segmentCount?: number;
  /** Estimated token count for observability. */
  estimatedTokens: number;
}

export interface VideoRendererCapabilities {
  id: string;
  label: string;
  maxPromptTokens: number;
  supportedDurations: number[];
  supportsReferenceImages: boolean;
  supportsNativeAudio: boolean;
  supportsNegativePrompt: boolean;
}

/**
 * A renderer turns the model-agnostic reasoning (direction + scene graph) into a
 * concrete, budget-respecting prompt for one clip. Swapping models = swapping
 * the adapter, not the engine.
 */
export interface VideoRenderer {
  readonly capabilities: VideoRendererCapabilities;
  buildPrompt(request: RenderRequest, segmentIndex?: number): CompressedShotPlan;
}
