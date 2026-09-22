/**
 * Server-only provider configuration.
 * Do not import this module from client components or pages.
 * Secrets must never use NEXT_PUBLIC_*.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readOptionalNumber(name: string): number | undefined {
  const raw = readEnv(name);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export interface RunwayProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  apiVersion: string;
  costPerSecondUsd?: number;
}

export interface SeedanceProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  costPerSecondUsd?: number;
}

export interface VeoProviderConfig {
  apiKey?: string;
  model: string;
}

export function getRunwayProviderConfig(): RunwayProviderConfig {
  return {
    apiKey: readEnv("RUNWAY_API_KEY") ?? readEnv("RUNWAYML_API_SECRET"),
    baseUrl: readEnv("RUNWAY_API_BASE_URL") ?? "https://api.dev.runwayml.com",
    model: readEnv("RUNWAY_VIDEO_MODEL") ?? "seedance2_5",
    apiVersion: readEnv("RUNWAY_API_VERSION") ?? "2024-11-06",
    costPerSecondUsd: readOptionalNumber("RUNWAY_COST_PER_SECOND_USD"),
  };
}

export function getSeedanceProviderConfig(): SeedanceProviderConfig {
  return {
    apiKey: readEnv("SEEDANCE_API_KEY") ?? readEnv("BYTEPLUS_ARK_API_KEY"),
    baseUrl: readEnv("SEEDANCE_API_BASE_URL") ?? readEnv("BYTEPLUS_ARK_BASE_URL"),
    model: readEnv("SEEDANCE_VIDEO_MODEL") ?? "doubao-seedance-2-5",
    costPerSecondUsd: readOptionalNumber("SEEDANCE_COST_PER_SECOND_USD"),
  };
}

export function getVeoProviderConfig(): VeoProviderConfig {
  return {
    apiKey: readEnv("GEMINI_VEO_API_KEY") ?? readEnv("GEMINI_API_KEY") ?? readEnv("NANO_API_KEY"),
    model: readEnv("VEO_VIDEO_MODEL") ?? "veo-3.1-fast-generate-preview",
  };
}

export function hasRunwayCredentials(): boolean {
  return Boolean(getRunwayProviderConfig().apiKey);
}

export function hasSeedanceCredentials(): boolean {
  return Boolean(getSeedanceProviderConfig().apiKey);
}

export function hasVeoCredentials(): boolean {
  return Boolean(getVeoProviderConfig().apiKey);
}
