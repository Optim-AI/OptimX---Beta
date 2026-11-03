/**
 * Lay a Gemini TTS voiceover onto a Seedance video via ffmpeg.
 *
 * The voiceover is never cut: it is sped up (atempo) to fit when needed and
 * padded with silence to the full video length. Seedance's own music / ambience
 * is kept underneath as a ducked bed so the commercial does not sound bare.
 */

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";

const execFileAsync = promisify(execFile);

/** Music / ambience bed level under the voiceover (before ducking). */
const BACKGROUND_BED_VOLUME = 0.35;
const END_FADE_SECONDS = 0.4;

export interface MuxVoiceoverInput {
  videoBuffer: Buffer;
  audioBuffer: Buffer;
  /** Prefer wav from Gemini TTS. */
  audioExtension?: "wav" | "mp3" | "pcm";
  /** Speed factor applied to the voiceover (1 = unchanged). */
  voiceoverTempo?: number;
  /** Keep the video's own audio as a ducked music bed. Default true. */
  keepBackgroundAudio?: boolean;
}

export interface MediaProbe {
  durationSeconds: number | null;
  hasAudio: boolean;
  width?: number;
  height?: number;
  fps?: number;
}

/** Parse duration + audio presence from `ffmpeg -i` stderr. */
export function parseFfmpegProbe(stderr: string): MediaProbe {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSeconds = m
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : null;
  const size = stderr.match(/Stream #\d+:\d+.*Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
  return {
    durationSeconds,
    hasAudio: /Stream #\d+:\d+.*Audio:/.test(stderr),
    width: size ? Number(size[1]) : undefined,
    height: size ? Number(size[2]) : undefined,
    fps: (() => {
      const f = stderr.match(/Stream #\d+:\d+.*Video:.*?(\d+(?:\.\d+)?) fps/);
      return f ? Number(f[1]) : undefined;
    })(),
  };
}

async function probeFile(path: string): Promise<MediaProbe> {
  // `ffmpeg -i` with no output exits non-zero but prints stream info to stderr.
  try {
    const { stderr } = await execFileAsync(getFfmpegExecutable(), ["-hide_banner", "-i", path], {
      timeout: 30_000,
    });
    return parseFfmpegProbe(stderr);
  } catch (e) {
    return parseFfmpegProbe(String((e as { stderr?: string })?.stderr ?? ""));
  }
}

export async function probeMediaBuffer(buffer: Buffer, extension: string): Promise<MediaProbe> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-probe-"));
  const path = join(dir, `media.${extension}`);
  try {
    await writeFile(path, buffer);
    return await probeFile(path);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** ffmpeg atempo accepts 0.5–2.0 per stage; chain for anything outside. */
export function atempoChain(tempo: number): string {
  if (!Number.isFinite(tempo) || Math.abs(tempo - 1) < 0.001) return "";
  const stages: string[] = [];
  let remaining = tempo;
  while (remaining > 2) {
    stages.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    stages.push("atempo=0.5");
    remaining /= 0.5;
  }
  stages.push(`atempo=${remaining.toFixed(4)}`);
  return stages.join(",");
}

export function buildVoiceoverFilterGraph(input: {
  videoSeconds: number;
  voiceoverTempo: number;
  withBackground: boolean;
}): string {
  const tempo = atempoChain(input.voiceoverTempo);
  const fadeStart = Math.max(0, input.videoSeconds - END_FADE_SECONDS).toFixed(3);
  const vo = `[1:a]aresample=48000,${tempo ? `${tempo},` : ""}apad`;
  const finish = `afade=t=out:st=${fadeStart}:d=${END_FADE_SECONDS}[aout]`;

  if (!input.withBackground) {
    return `${vo},${finish}`;
  }
  // Duck the bed while the voiceover speaks, then mix (no normalize, so VO keeps its level).
  return [
    `${vo},asplit=2[vo][vokey]`,
    `[0:a]aresample=48000,volume=${BACKGROUND_BED_VOLUME}[bed]`,
    `[bed][vokey]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[ducked]`,
    `[ducked][vo]amix=inputs=2:duration=first:normalize=0,${finish}`,
  ].join(";");
}

/**
 * Mux TTS audio onto a video. Video stream is copied; audio is AAC.
 * Output length always equals the video length.
 */
export async function muxVoiceoverOntoVideo(input: MuxVoiceoverInput): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-vo-"));
  const videoPath = join(dir, "input.mp4");
  const audioExt = input.audioExtension || "wav";
  const audioPath = join(dir, `voiceover.${audioExt}`);
  const outputPath = join(dir, "output.mp4");

  try {
    await writeFile(videoPath, input.videoBuffer);
    await writeFile(audioPath, input.audioBuffer);

    const video = await probeFile(videoPath);
    if (!video.durationSeconds) {
      throw new Error("Could not read the generated video's duration for voiceover mux");
    }
    const withBackground = input.keepBackgroundAudio !== false && video.hasAudio;
    const filterGraph = buildVoiceoverFilterGraph({
      videoSeconds: video.durationSeconds,
      voiceoverTempo: input.voiceoverTempo ?? 1,
      withBackground,
    });

    await execFileAsync(
      getFfmpegExecutable(),
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-filter_complex",
        filterGraph,
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        video.durationSeconds.toFixed(3),
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }
    );

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Download a remote video URL (or data URL) into a Buffer.
 */
export async function downloadVideoToBuffer(videoUrl: string): Promise<Buffer> {
  if (videoUrl.startsWith("data:")) {
    const comma = videoUrl.indexOf(",");
    if (comma < 0) throw new Error("Invalid data URL for video download");
    return Buffer.from(videoUrl.slice(comma + 1), "base64");
  }

  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download video for voiceover mux (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
