/**
 * Shot tools for "Fix a part" (ffmpeg only, no AI).
 *
 * A fix redraws a moment by animating a corrected first frame, so the redone part
 * should start where a shot starts and end where it cuts away — then both joins look
 * like ordinary edits instead of a patch.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { MAX_FIX_SECONDS, MIN_FIX_SECONDS } from "./fix-pricing";

const execFileAsync = promisify(execFile);

/** ffmpeg scene-change score above which a frame starts a new shot. */
const SCENE_THRESHOLD = 0.3;
/**
 * A generated clip (about MAX_FIX_SECONDS long) may be slowed by up to this factor to
 * fill a slightly longer shot — far less visible than cutting back mid-shot.
 */
export const MAX_CLIP_STRETCH = 1.25;
/** Ignore "cuts" closer than this to each other or to the ends (flashes, fades). */
const MIN_SHOT_GAP_SECONDS = 0.5;
const MAX_THUMBNAILS = 30;

async function withTempVideo<T>(video: Buffer, fn: (path: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-shots-"));
  try {
    const path = join(dir, "in.mp4");
    await writeFile(path, video);
    return await fn(path, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Parse `showinfo` pts_time values from ffmpeg stderr into clean, sorted cut times. */
export function parseShotCuts(stderr: string, durationSeconds: number): number[] {
  const times = [...stderr.matchAll(/pts_time:(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const cuts: number[] = [];
  for (const t of times.sort((a, b) => a - b)) {
    if (t < MIN_SHOT_GAP_SECONDS || t > durationSeconds - MIN_SHOT_GAP_SECONDS) continue;
    if (cuts.length && t - cuts[cuts.length - 1] < MIN_SHOT_GAP_SECONDS) continue;
    cuts.push(Math.round(t * 100) / 100);
  }
  return cuts;
}

/** Times (seconds) where the video cuts to a new shot. */
export async function detectShotCuts(video: Buffer, durationSeconds: number): Promise<number[]> {
  return withTempVideo(video, async (path) => {
    let stderr = "";
    try {
      ({ stderr } = await execFileAsync(
        getFfmpegExecutable(),
        ["-hide_banner", "-i", path, "-filter:v", `select='gt(scene,${SCENE_THRESHOLD})',showinfo`, "-an", "-f", "null", "-"],
        { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }
      ));
    } catch (e) {
      stderr = String((e as { stderr?: string })?.stderr ?? "");
    }
    return parseShotCuts(stderr, durationSeconds);
  });
}

export interface FixWindow {
  /** What the user picked on the timeline. */
  selectedStart: number;
  selectedEnd: number;
  /** What will actually be redone (snapped to shot edges, at most MAX_FIX_SECONDS). */
  startSeconds: number;
  endSeconds: number;
  /** The shot runs on past the redone part, so the join at the end is mid-shot. */
  endsMidShot: boolean;
}

/**
 * Snap the user's selection out to the shot it sits in: start at the cut before it,
 * end at the cut after it. Long shots are capped at MAX_FIX_SECONDS from the start.
 */
export function snapToShots(
  selectedStart: number,
  selectedEnd: number,
  cuts: number[],
  durationSeconds: number
): FixWindow {
  const round = (n: number) => Math.round(n * 100) / 100;
  let selStart = Math.max(0, Math.min(selectedStart, durationSeconds));
  let selEnd = Math.max(0, Math.min(selectedEnd, durationSeconds));
  if (selEnd < selStart) [selStart, selEnd] = [selEnd, selStart];
  if (selEnd - selStart > MAX_FIX_SECONDS) selEnd = selStart + MAX_FIX_SECONDS;

  // Snap before applying the minimum, so a short scene never pulls in the next one.
  const shotStart = [0, ...cuts].filter((c) => c <= selStart + 1e-6).pop() ?? 0;
  const shotEnd = [...cuts, durationSeconds].find((c) => c >= selEnd - 1e-6) ?? durationSeconds;
  if (selEnd - selStart < MIN_FIX_SECONDS) {
    selEnd = Math.min(shotEnd, selStart + MIN_FIX_SECONDS);
    selStart = Math.max(shotStart, selEnd - MIN_FIX_SECONDS);
  }

  // Prefer the whole shot — a clip may be slowed slightly to fill it (see MAX_CLIP_STRETCH).
  // If it is longer than that, start at the shot (so the first join is a real cut).
  let start = shotStart;
  let end = shotEnd;
  if (end - start > MAX_FIX_SECONDS * MAX_CLIP_STRETCH) {
    start = selEnd - shotStart <= MAX_FIX_SECONDS ? shotStart : selStart;
    end = start + MAX_FIX_SECONDS;
  }
  if (end - start < MIN_FIX_SECONDS) end = Math.min(durationSeconds, start + MIN_FIX_SECONDS);
  return {
    selectedStart: round(selStart),
    selectedEnd: round(selEnd),
    startSeconds: round(start),
    endSeconds: round(end),
    endsMidShot: end < shotEnd - 0.05,
  };
}

/** One still frame (PNG) at time t. */
export async function extractFrame(video: Buffer, atSeconds: number): Promise<Buffer> {
  return withTempVideo(video, async (path, dir) => {
    const out = join(dir, "frame.png");
    await execFileAsync(
      getFfmpegExecutable(),
      ["-y", "-hide_banner", "-loglevel", "error", "-ss", Math.max(0, atSeconds).toFixed(3), "-i", path, "-frames:v", "1", out],
      { timeout: 60_000 }
    );
    return readFile(out);
  });
}

/** Small JPEG thumbnails, one per second (at most MAX_THUMBNAILS), for the timeline strip. */
export async function extractThumbnails(
  video: Buffer,
  durationSeconds: number,
  height = 96
): Promise<Array<{ atSeconds: number; dataUrl: string }>> {
  const count = Math.min(MAX_THUMBNAILS, Math.max(1, Math.ceil(durationSeconds)));
  const step = durationSeconds / count;
  return withTempVideo(video, async (path, dir) => {
    await execFileAsync(
      getFfmpegExecutable(),
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", path,
        "-vf", `fps=1/${step.toFixed(4)},scale=-2:${height}`,
        "-frames:v", String(count),
        "-q:v", "6",
        join(dir, "thumb-%03d.jpg"),
      ],
      { timeout: 120_000 }
    );
    const thumbs: Array<{ atSeconds: number; dataUrl: string }> = [];
    for (let i = 1; i <= count; i++) {
      const buf = await readFile(join(dir, `thumb-${String(i).padStart(3, "0")}.jpg`)).catch(() => null);
      if (!buf) break;
      thumbs.push({
        atSeconds: Math.round((i - 1) * step * 100) / 100,
        dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`,
      });
    }
    return thumbs;
  });
}
