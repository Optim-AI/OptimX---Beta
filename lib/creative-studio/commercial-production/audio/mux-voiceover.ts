/**
 * Replace Seedance video audio with Gemini TTS voiceover via ffmpeg.
 */

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";

const execFileAsync = promisify(execFile);

export interface MuxVoiceoverInput {
  videoBuffer: Buffer;
  audioBuffer: Buffer;
  /** Prefer wav from Gemini TTS. */
  audioExtension?: "wav" | "mp3" | "pcm";
}

/**
 * Mux TTS audio onto a video, replacing any existing audio track.
 * Video stream is copied; audio is AAC.
 */
export async function muxVoiceoverOntoVideo(
  input: MuxVoiceoverInput
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-vo-"));
  const videoPath = join(dir, "input.mp4");
  const audioExt = input.audioExtension || "wav";
  const audioPath = join(dir, `voiceover.${audioExt}`);
  const outputPath = join(dir, "output.mp4");

  try {
    await writeFile(videoPath, input.videoBuffer);
    await writeFile(audioPath, input.audioBuffer);

    const ffmpeg = getFfmpegExecutable();
    // Replace audio: keep video, use TTS as sole audio. -shortest stops when VO ends
    // if VO is shorter; video pad with -t from video duration via -map.
    await execFileAsync(
      ffmpeg,
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
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
