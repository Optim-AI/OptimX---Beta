/**
 * Runway-specific prompt adapter.
 *
 * Takes a provider-agnostic CompiledPrompt and produces the promptText
 * string expected by the Runway API for the active model (Seedance 2.5).
 *
 * Does not import Veo prompt utilities.
 */

import type { CompiledPrompt } from "../types";
import type { ProviderAdapter, ProviderGenerateRequest } from "../../providers/types";
import type { VideoProviderId } from "../../providers/ids";

export interface RunwayPromptPayload {
  promptText: string;
  /** Optional negative guidance folded into promptText for models without a negative field. */
  negativeHint?: string;
}

export function adaptCompiledPromptForRunway(prompt: CompiledPrompt): RunwayPromptPayload {
  const negative = prompt.negativePrompt || prompt.negativeConstraints;
  const promptText = [
    prompt.promptText.trim(),
    negative ? `Avoid: ${negative}` : "",
  ]
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    promptText,
    negativeHint: negative || undefined,
  };
}

export class RunwayPromptAdapter implements ProviderAdapter<RunwayPromptPayload> {
  readonly providerId: VideoProviderId = "runway";

  toVendorRequest(request: ProviderGenerateRequest): RunwayPromptPayload {
    return adaptCompiledPromptForRunway(request.prompt);
  }
}

export const runwayPromptAdapter = new RunwayPromptAdapter();
