/**
 * "Fix a part" — redo one shot of a finished ad.
 *
 * Preview (free): cut the shot → Gemini writes the fix → correct its first frame.
 * Apply: animate the corrected frame → splice the picture back in at the shot edges
 * → keep the original sound untouched → redraw the end card → store.
 * Only the picture inside the window changes; voice, music and timing stay exactly the same.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { uploadVideoBuffer } from "@/lib/creative-studio/video-delivery";
import { probeMediaBuffer } from "../audio/mux-voiceover";
import { applyStoredEndCard } from "../finishing/attach-end-card";
import type { StoredEndCard } from "../campaign-executor/types";
import { animateFrameWithGemini, type FrameAnimator } from "./animate-frame";
import { fixFrameWithGemini, type FrameFixer } from "./fix-frame";
import { planFixWithGemini, type FixInstructions, type FixPlanner } from "./plan-fix";
import { extractFrame, MAX_CLIP_STRETCH } from "./shots";

const execFileAsync = promisify(execFile);

/** Keep the clip sent to Gemini small enough to send inline. */
const MAX_CLIP_BYTES = 12 * 1024 * 1024;
/** Ignore slivers shorter than this when the window touches the start or end. */
const EDGE_EPSILON_SECONDS = 0.05;

async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync(getFfmpegExecutable(), ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

/** Cut [start, end] (picture only), re-encoded so it starts on an exact frame. */
export async function cutSegment(video: Buffer, startSeconds: number, endSeconds: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-fixcut-"));
  try {
    const input = join(dir, "in.mp4");
    const output = join(dir, "cut.mp4");
    await writeFile(input, video);
    // Lower quality only if needed to stay small enough to send inline.
    for (const crf of ["20", "26", "32"]) {
      await ffmpeg([
        "-ss", startSeconds.toFixed(3),
        "-i", input,
        "-t", (endSeconds - startSeconds).toFixed(3),
        "-an",
        "-c:v", "libx264", "-crf", crf, "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output,
      ]);
      const clip = await readFile(output);
      if (clip.length <= MAX_CLIP_BYTES) return clip;
    }
    throw new Error("The part to fix is too large to send for editing.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** ffmpeg filter graph replacing the picture in [start, end] with input 1. */
export function buildSpliceFilter(input: {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  /** Length of the replacement clip; a slightly short one is slowed to fit. */
  editedSeconds?: number;
}): string {
  const { startSeconds: s, endSeconds: e, durationSeconds: d, width: w, height: h, fps } = input;
  const stretch =
    input.editedSeconds && input.editedSeconds > 0
      ? Math.min(MAX_CLIP_STRETCH, Math.max(1, (e - s) / input.editedSeconds))
      : 1;
  const slow = stretch > 1.001 ? `setpts=${stretch.toFixed(4)}*PTS,` : "";
  const norm = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${fps},format=yuv420p`;
  const parts: string[] = [];
  const labels: string[] = [];
  if (s > EDGE_EPSILON_SECONDS) {
    parts.push(`[0:v]trim=0:${s.toFixed(3)},setpts=PTS-STARTPTS,${norm}[pre]`);
    labels.push("[pre]");
  }
  // The edit may come back a few frames short or long: hold its last frame, then cut to length.
  parts.push(
    `[1:v]${slow}${norm},tpad=stop_mode=clone:stop_duration=${(e - s).toFixed(3)},trim=0:${(e - s).toFixed(3)},setpts=PTS-STARTPTS[fix]`
  );
  labels.push("[fix]");
  if (e < d - EDGE_EPSILON_SECONDS) {
    parts.push(`[0:v]trim=start=${e.toFixed(3)},setpts=PTS-STARTPTS,${norm}[post]`);
    labels.push("[post]");
  }
  parts.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=0[v]`);
  return parts.join(";");
}

/** Replace the picture in [start, end] with the edited clip; the soundtrack is copied untouched. */
export async function spliceSegment(input: {
  master: Buffer;
  edited: Buffer;
  startSeconds: number;
  endSeconds: number;
}): Promise<Buffer> {
  const probe = await probeMediaBuffer(input.master, "mp4");
  if (!probe.durationSeconds || !probe.width || !probe.height) {
    throw new Error("Could not read the video to apply the fix.");
  }
  const editedProbe = await probeMediaBuffer(input.edited, "mp4");
  const dir = await mkdtemp(join(tmpdir(), "skalx-fixsplice-"));
  try {
    const masterPath = join(dir, "master.mp4");
    const editPath = join(dir, "edit.mp4");
    const output = join(dir, "out.mp4");
    await writeFile(masterPath, input.master);
    await writeFile(editPath, input.edited);
    await ffmpeg([
      "-i", masterPath,
      "-i", editPath,
      "-filter_complex",
      buildSpliceFilter({
        startSeconds: input.startSeconds,
        endSeconds: Math.min(input.endSeconds, probe.durationSeconds),
        durationSeconds: probe.durationSeconds,
        width: probe.width,
        height: probe.height,
        fps: probe.fps || 24,
        editedSeconds: editedProbe.durationSeconds ?? undefined,
      }),
      "-map", "[v]",
      "-map", "0:a?",
      "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      "-t", probe.durationSeconds.toFixed(3),
      "-movflags", "+faststart",
      output,
    ]);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function aspectOf(width?: number, height?: number): "9:16" | "16:9" {
  return width && height && width > height ? "16:9" : "9:16";
}

export interface FixPreview {
  instructions: FixInstructions;
  /** First frame of the part being redone, before and after the correction (PNG). */
  beforeFrame: Buffer;
  afterFrame: Buffer;
}

/** Free preview: plan the fix and correct the first frame. Nothing is animated or billed. */
export async function previewFix(
  input: {
    master: Buffer;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    width?: number;
    height?: number;
    request: string;
    productName?: string;
  },
  options: { planner?: FixPlanner; fixer?: FrameFixer } = {}
): Promise<{ ok: true; preview: FixPreview } | { ok: false; reason: string }> {
  const clip = await cutSegment(input.master, input.startSeconds, input.endSeconds);
  const plan = await (options.planner ?? planFixWithGemini)({
    clip,
    clipSeconds: input.endSeconds - input.startSeconds,
    request: input.request,
    productName: input.productName,
  });
  if (!plan.ok) return plan;

  const beforeFrame = await extractFrame(input.master, input.startSeconds);
  // The ad ends on a clear product shot — the best picture of the real label.
  const productShot = await extractFrame(input.master, Math.max(0, input.durationSeconds - 1.5));
  const afterFrame = await (options.fixer ?? fixFrameWithGemini)({
    frame: beforeFrame,
    instruction: plan.instructions.frameEditInstruction,
    productReferences: [productShot],
    aspectRatio: aspectOf(input.width, input.height),
  });
  return { ok: true, preview: { instructions: plan.instructions, beforeFrame, afterFrame } };
}

export interface FixResult {
  /** Fixed picture + original sound, no overlays — the next fix starts from here. */
  masterVideoUrl: string;
  /** What the user sees (overlays redrawn). */
  videoUrl: string;
}

/** Animate the approved frame and put the new shot into the ad. */
export async function runFix(
  input: {
    master: Buffer;
    finishing?: { endCard?: StoredEndCard };
    startSeconds: number;
    endSeconds: number;
    fixedFrame: Buffer;
    motionPrompt: string;
    deadlineAt: number;
  },
  options: { animator?: FrameAnimator; log?: (event: string, payload: Record<string, unknown>) => void } = {}
): Promise<FixResult> {
  const log = options.log ?? ((event, payload) => console.log(`[fix] ${event}`, payload));
  const { startSeconds, endSeconds } = input;

  const { master } = input;
  const probe = await probeMediaBuffer(master, "mp4");
  const clip = await (options.animator ?? animateFrameWithGemini)({
    frame: input.fixedFrame,
    motionPrompt: input.motionPrompt,
    seconds: endSeconds - startSeconds,
    aspectRatio: aspectOf(probe.width, probe.height),
    deadlineAt: input.deadlineAt,
  });
  const clipProbe = await probeMediaBuffer(clip, "mp4");
  log("fix.animated", { bytes: clip.length, clipSeconds: clipProbe.durationSeconds, needed: endSeconds - startSeconds });

  const fixedMaster = await spliceSegment({ master, edited: clip, startSeconds, endSeconds });
  const masterVideoUrl = await uploadVideoBuffer(fixedMaster);

  let videoUrl = masterVideoUrl;
  const endCard = input.finishing?.endCard;
  if (endCard) {
    try {
      videoUrl = (await applyStoredEndCard(fixedMaster, endCard)).videoUrl;
    } catch (err) {
      // Same rule as generation: the end card is polish, the fix still ships.
      log("fix.end_card_failed", { message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { masterVideoUrl, videoUrl };
}
