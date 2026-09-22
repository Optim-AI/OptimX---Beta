/**
 * Vendor request shape for documentation / future adapters.
 * The live RunwayProvider builds this internally.
 */

export interface RunwayGenerateVideoRequest {
  model: string;
  promptText: string;
  promptImage?: string;
  ratio: string;
  duration: number;
}
