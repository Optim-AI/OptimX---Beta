/**
 * Step B of a fix: bring the corrected still to life.
 *
 * Runway Seedance (image → video) starts from the corrected frame, so it inherits
 * the same person, clothes, light and room. Its sound is discarded — the ad's own
 * voiceover and music are kept.
 */

import {
  createRunwayVideoTask,
  downloadRunwayOutput,
  getRunwayTask,
  runwayRatioForAspect,
} from "../video/providers/runway-client";

/** Seedance's shortest clip; the splice takes only the seconds it needs. */
const MIN_CLIP_SECONDS = 4;
const POLL_MS = 5_000;

export type FrameAnimator = (input: {
  frame: Buffer;
  motionPrompt: string;
  seconds: number;
  aspectRatio: "9:16" | "16:9";
  deadlineAt: number;
}) => Promise<Buffer>;

export function buildFixMotionPrompt(motionPrompt: string, seconds: number): string {
  return `${motionPrompt}

This is a ${Math.ceil(seconds)}-second shot that continues a video ad, starting exactly from this image. Keep the same person, face, clothes, room, lighting and colours throughout. Keep the camera as it is in the image unless told otherwise. The product keeps its exact shape and label. No on-screen text, captions or logos. Nobody speaks: lips stay closed, no dialogue.`;
}

/** Live animator: Runway Seedance image_to_video from the corrected frame. */
export const animateFrameWithRunway: FrameAnimator = async ({ frame, motionPrompt, seconds, aspectRatio, deadlineAt }) => {
  const task = await createRunwayVideoTask({
    promptText: buildFixMotionPrompt(motionPrompt, seconds),
    duration: Math.max(MIN_CLIP_SECONDS, Math.ceil(seconds)),
    ratio: runwayRatioForAspect(aspectRatio),
    promptImage: `data:image/png;base64,${frame.toString("base64")}`,
  });

  while (Date.now() < deadlineAt) {
    const status = await getRunwayTask(task.id);
    if (status.status === "SUCCEEDED") {
      const url = status.output?.[0];
      if (!url) throw new Error("The video model returned no clip.");
      return downloadRunwayOutput(url);
    }
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`Animating the fix failed: ${status.failure || status.error || status.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("The fix took too long. Please try again.");
};
