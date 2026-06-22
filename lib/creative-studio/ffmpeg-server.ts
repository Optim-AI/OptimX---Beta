/**
 * ffmpeg-static path resolution for serverless (Vercel copies binary to /tmp for exec permission).
 */
import { chmodSync, copyFileSync, existsSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

const VERCEL_FFMPEG_PATH = "/tmp/ffmpeg";

export function getFfmpegExecutable(): string {
  const bundled = ffmpegStatic;
  if (!bundled) {
    throw new Error("ffmpeg binary not available (ffmpeg-static).");
  }

  if (process.env.VERCEL) {
    try {
      if (!existsSync(VERCEL_FFMPEG_PATH)) {
        copyFileSync(bundled, VERCEL_FFMPEG_PATH);
        chmodSync(VERCEL_FFMPEG_PATH, 0o755);
      }
      return VERCEL_FFMPEG_PATH;
    } catch (e) {
      console.warn("ffmpeg /tmp copy failed, using bundled path:", e);
    }
  }

  return bundled;
}
