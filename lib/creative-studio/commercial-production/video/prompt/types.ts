import type { CommercialAspectRatio } from "../../campaign/types";
import type { CommercialShot } from "../../shot-planner/types";
import type { VisualTreatment } from "../../commercial-director/types";
import type { VideoProviderId } from "../providers/ids";

/**
 * Structured generation prompt. Do not pass raw director prose to a video model.
 */
export interface CompiledPrompt {
  subject: string;
  action: string;
  environment: string;
  composition: string;
  camera: string;
  lighting: string;
  motion: string;
  visualTreatment: string;
  continuity: string;
  productRequirements: string;
  negativeConstraints: string;
  /** Provider-optimized text assembled from the fields above. */
  promptText: string;
  negativePrompt?: string;
}

export interface PromptCompileInput {
  shot: CommercialShot;
  visualTreatment: VisualTreatment;
  aspectRatio: CommercialAspectRatio;
  providerId: VideoProviderId;
}

export interface PromptCompiler {
  compile(input: PromptCompileInput): CompiledPrompt;
}
