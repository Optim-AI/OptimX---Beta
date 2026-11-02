/**
 * Step B of a fix: bring the corrected still to life.
 *
 * Gemini Omni Flash (image → video) starts from the corrected frame, so it inherits
 * the same person, clothes, light and room. Its sound is discarded — the ad's own
 * voiceover and music are kept.
 */

import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";

export const FIX_VIDEO_MODEL = process.env.FIX_VIDEO_MODEL?.trim() || "gemini-omni-1.1-flash";
const CREATE_TIMEOUT_MS = 6 * 60_000;
const FILE_POLL_MS = 4_000;

export type FrameAnimator = (input: {
  frame: Buffer;
  motionPrompt: string;
  seconds: number;
  aspectRatio: "9:16" | "16:9";
  deadlineAt: number;
}) => Promise<Buffer>;

type InteractionContent = { type?: string; mime_type?: string; data?: string; uri?: string };

/** Pull the generated video (inline bytes or a file uri) out of an Interactions response. */
export function findOutputVideo(json: unknown): { data?: string; uri?: string } | null {
  const steps = (json as { steps?: Array<{ type?: string; content?: InteractionContent[] }> })?.steps || [];
  for (const step of steps) {
    if (step.type && step.type !== "model_output") continue;
    const video = (step.content || []).find((c) => c.type === "video" && (c.data || c.uri));
    if (video) return { data: video.data, uri: video.uri };
  }
  return null;
}

async function downloadGeneratedFile(uri: string, apiKey: string, deadlineAt: number): Promise<Buffer> {
  const fileName = uri.match(/files\/[^/:?]+/)?.[0];
  if (!fileName) {
    const res = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
    if (!res.ok) throw new Error(`Could not download the fixed clip (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  while (Date.now() < deadlineAt) {
    const meta = await fetch(`${GEMINI_REST_BASE}/${fileName}`, { headers: { "x-goog-api-key": apiKey } });
    const state = meta.ok ? ((await meta.json()) as { state?: string }).state : undefined;
    if (state === "FAILED") throw new Error("The fixed clip could not be processed.");
    if (state === "ACTIVE") {
      const res = await fetch(`${GEMINI_REST_BASE}/${fileName}:download?alt=media`, {
        headers: { "x-goog-api-key": apiKey },
      });
      if (!res.ok) throw new Error(`Could not download the fixed clip (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    await new Promise((resolve) => setTimeout(resolve, FILE_POLL_MS));
  }
  throw new Error("The fix took too long. Please try again.");
}

/** Live animator: Gemini Omni Flash image_to_video via the Interactions API. */
export const animateFrameWithGemini: FrameAnimator = async ({ frame, motionPrompt, seconds, aspectRatio, deadlineAt }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Fixing is not available right now.");

  const prompt = `${motionPrompt}

This is a ${Math.ceil(seconds)}-second shot that continues a video ad, starting exactly from this image. Keep the same person, face, clothes, room, lighting and colours throughout. Keep the camera as it is in the image unless told otherwise. The product keeps its exact shape and label. No on-screen text, captions or logos. Nobody speaks: lips stay closed, no dialogue.`;

  const res = await fetch(`${GEMINI_REST_BASE}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(Math.max(30_000, Math.min(CREATE_TIMEOUT_MS, deadlineAt - Date.now()))),
    body: JSON.stringify({
      model: FIX_VIDEO_MODEL,
      input: [
        { type: "image", data: frame.toString("base64"), mime_type: "image/png" },
        { type: "text", text: prompt },
      ],
      generation_config: { video_config: { task: "image_to_video" } },
      response_format: { type: "video", aspect_ratio: aspectRatio, resolution: "720p", delivery: "uri" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Animating the fix failed: ${message}`);
  }
  const video = findOutputVideo(json);
  if (video?.data) return Buffer.from(video.data, "base64");
  if (video?.uri) return downloadGeneratedFile(video.uri, apiKey, deadlineAt);
  throw new Error("The video model returned no clip.");
};
