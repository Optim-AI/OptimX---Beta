/**
 * ffmpeg-static path resolution for serverless.
 * Vercel/Lambda cannot reliably exec files under /var/task, so the binary is
 * copied to /tmp and marked executable before spawn.
 */
import { chmodSync, copyFileSync, existsSync, statSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

const SERVERLESS_FFMPEG_PATH = "/tmp/ffmpeg";

function onServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT
  );
}

function isNonEmptyFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile() && statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

export function getFfmpegExecutable(): string {
  const bundled = process.env.FFMPEG_BIN || ffmpegStatic;
  if (!bundled || !isNonEmptyFile(bundled)) {
    throw new Error(
      `ffmpeg binary is missing from this deployment (${bundled || "ffmpeg-static returned no path"}). ` +
        "Voiceover mux needs node_modules/ffmpeg-static/ffmpeg in the function bundle."
    );
  }

  if (!onServerless()) {
    return bundled;
  }

  if (
    !isNonEmptyFile(SERVERLESS_FFMPEG_PATH) ||
    statSync(SERVERLESS_FFMPEG_PATH).size !== statSync(bundled).size
  ) {
    copyFileSync(bundled, SERVERLESS_FFMPEG_PATH);
  }
  chmodSync(SERVERLESS_FFMPEG_PATH, 0o755);
  return SERVERLESS_FFMPEG_PATH;
}
