/**
 * Low-level Runway Dev HTTP client.
 *
 * INTERNAL — only RunwayProvider (runway-provider.ts) may import this module.
 * API routes and the Commercial Production Engine must use VideoProvider instead.
 *
 * Active model is configured via RUNWAY_VIDEO_MODEL (default: seedance2_5).
 */

import { getRunwayProviderConfig } from "./config.server";

export const RUNWAY_SEEDANCE_MODEL = "seedance2_5";
export const RUNWAY_API_KEY_SETUP_MESSAGE =
  "Video generation requires RUNWAY_API_KEY in .env.local (Runway Dev API). Get a key from https://dev.runwayml.com, add it, then restart npm run dev.";

export type RunwayTaskStatus =
  | "PENDING"
  | "THROTTLED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface RunwayTask {
  id: string;
  status: RunwayTaskStatus;
  output?: string[];
  failure?: string;
  error?: string;
}

/**
 * Seedance image reference for POST /v1/text_to_video.
 * OpenAPI PromptImage: { uri } only — no tag (additionalProperties: false).
 * Field name on the wire is `references`, not `referenceImages`.
 */
export interface RunwayReferenceImage {
  uri: string;
}

export interface CreateRunwayVideoTaskInput {
  promptText: string;
  /** Per-shot or campaign-level duration (Seedance 2.5: 4–30). Supports full 15s/30s campaign clips. */
  duration: number;
  ratio: string;
  /** Mapped to Seedance `references` on the request body. */
  referenceImages?: RunwayReferenceImage[];
  promptImage?: string;
}

function runwayHeaders(apiKey: string, apiVersion: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": apiVersion,
  };
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export function getRunwayApiKey(): string | undefined {
  return getRunwayProviderConfig().apiKey;
}

export function getRunwayActiveModel(): string {
  return getRunwayProviderConfig().model || RUNWAY_SEEDANCE_MODEL;
}

/** @deprecated Use getRunwayActiveModel — kept for clarity that Seedance is the active model. */
export function getRunwaySeedanceModel(): string {
  return getRunwayActiveModel();
}

/** Pixel ratio strings accepted by Seedance 2.5 on Runway. */
export function runwayRatioForAspect(
  aspectRatio: string,
  quality: "standard" | "high" = "standard"
): string {
  const hd = quality === "high";
  switch (aspectRatio) {
    case "16:9":
      return hd ? "1920:1080" : "1280:720";
    case "1:1":
      return hd ? "1080:1080" : "960:960";
    case "4:5":
    case "3:4":
      return hd ? "1080:1440" : "720:960";
    case "9:16":
    default:
      return hd ? "1080:1920" : "720:1280";
  }
}

export async function createRunwayVideoTask(input: CreateRunwayVideoTaskInput): Promise<RunwayTask> {
  const config = getRunwayProviderConfig();
  if (!config.apiKey) {
    throw new Error(RUNWAY_API_KEY_SETUP_MESSAGE);
  }

  const model = getRunwayActiveModel();
  const duration = Math.max(4, Math.min(30, Math.round(input.duration)));
  const hasStartFrame = Boolean(input.promptImage);
  const endpoint = hasStartFrame ? "/v1/image_to_video" : "/v1/text_to_video";
  const promptText = input.promptText.slice(0, 15000);
  const body: Record<string, unknown> = {
    model,
    promptText,
    duration,
    ratio: input.ratio,
  };

  if (hasStartFrame) {
    body.promptImage = input.promptImage;
  }
  // Seedance 2.5 text_to_video expects `references: [{ uri }]`, not `referenceImages`.
  if (input.referenceImages?.length && !hasStartFrame) {
    body.references = input.referenceImages.map((ref) => ({ uri: ref.uri }));
  }

  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    method: "POST",
    headers: runwayHeaders(config.apiKey, config.apiVersion),
    body: JSON.stringify(body),
  });
  const json = await readJson(response);
  if (!response.ok) {
    const issues = Array.isArray(json?.issues)
      ? json.issues
          .map((issue: { path?: unknown; message?: string }) => {
            const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
            return path ? `${path}: ${issue.message || ""}` : issue?.message || "";
          })
          .filter(Boolean)
          .join("; ")
      : "";
    const message =
      [json?.error || json?.message || json?.failure, issues].filter(Boolean).join(" — ") ||
      JSON.stringify(json).slice(0, 400);
    throw new Error(`Runway request failed (${response.status}): ${message}`);
  }

  const id = json.id || json.taskId;
  if (!id) {
    throw new Error("Runway did not return a task id.");
  }
  return {
    id: String(id),
    status: (json.status as RunwayTaskStatus) || "PENDING",
    output: json.output,
  };
}

export async function getRunwayTask(taskId: string): Promise<RunwayTask> {
  const config = getRunwayProviderConfig();
  if (!config.apiKey) {
    throw new Error(RUNWAY_API_KEY_SETUP_MESSAGE);
  }

  const response = await fetch(`${config.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: runwayHeaders(config.apiKey, config.apiVersion),
  });
  const json = await readJson(response);
  if (!response.ok) {
    const message = json?.error || json?.message || JSON.stringify(json).slice(0, 400);
    throw new Error(`Runway task poll failed (${response.status}): ${message}`);
  }

  return {
    id: String(json.id || taskId),
    status: json.status as RunwayTaskStatus,
    output: json.output,
    failure: [json.failure, json.failureCode].filter(Boolean).join(" / ") || undefined,
    error: json.error,
  };
}

export async function downloadRunwayOutput(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Runway video (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}
