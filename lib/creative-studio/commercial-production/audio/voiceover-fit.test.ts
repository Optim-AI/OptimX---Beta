/**
 * Voiceover fit + mux tests. Uses the bundled ffmpeg on synthetic media (no network).
 *
 * Run: npx tsx lib/creative-studio/commercial-production/audio/voiceover-fit.test.ts
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import {
  atempoChain,
  buildVoiceoverFilterGraph,
  muxVoiceoverOntoVideo,
  parseFfmpegProbe,
  probeMediaBuffer,
} from "./mux-voiceover";
import {
  MAX_NATURAL_TEMPO,
  planVoiceoverFit,
  VOICEOVER_TAIL_SECONDS,
  voiceoverWordBudgetFactor,
} from "./voiceover-fit";

const execFileAsync = promisify(execFile);

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

async function synth(dir: string, name: string, args: string[]): Promise<Buffer> {
  const out = join(dir, name);
  await execFileAsync(getFfmpegExecutable(), ["-y", "-hide_banner", "-loglevel", "error", ...args, out]);
  return readFile(out);
}

/** Seconds of audible (non-silent) audio at the very end of a file. */
async function trailingSilenceSeconds(buffer: Buffer, dir: string): Promise<number> {
  const path = join(dir, "check.mp4");
  await import("node:fs/promises").then((fs) => fs.writeFile(path, buffer));
  const { stderr } = await execFileAsync(
    getFfmpegExecutable(),
    ["-hide_banner", "-i", path, "-af", "silencedetect=n=-45dB:d=0.2", "-f", "null", "-"],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  const probe = parseFfmpegProbe(stderr);
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const lastStart = starts[starts.length - 1];
  const lastEnd = ends[ends.length - 1];
  const duration = probe.durationSeconds ?? 0;
  // Silence open at EOF (or closed exactly at EOF) => trailing silence from lastStart.
  const openAtEof = starts.length > ends.length || (lastEnd != null && duration - lastEnd < 0.1);
  return lastStart != null && openAtEof ? duration - lastStart : 0;
}

async function main() {
  console.log("\nVoiceover fit tests\n");

  await test("speech inside the window fits unchanged", () => {
    const plan = planVoiceoverFit({ speechSeconds: 25, videoSeconds: 30 });
    assert.equal(plan.action, "fits");
  });

  await test("slight overrun is sped up, not cut", () => {
    const plan = planVoiceoverFit({ speechSeconds: 30, videoSeconds: 30 });
    assert.equal(plan.action, "speed_up");
    if (plan.action !== "speed_up") return;
    assert.ok(plan.tempo <= MAX_NATURAL_TEMPO);
    assert.ok(30 / plan.tempo <= 30 - VOICEOVER_TAIL_SECONDS + 1e-6);
  });

  await test("large overrun asks for a shorter script", () => {
    const plan = planVoiceoverFit({ speechSeconds: 38, videoSeconds: 30 });
    assert.equal(plan.action, "rewrite");
    if (plan.action !== "rewrite") return;
    assert.ok(38 * plan.lengthRatio < plan.windowSeconds);
  });

  await test("rewrite disallowed falls back to a speed-up", () => {
    const plan = planVoiceoverFit({ speechSeconds: 38, videoSeconds: 30, allowRewrite: false });
    assert.equal(plan.action, "speed_up");
  });

  await test("Indic word budgets are smaller than English", () => {
    assert.equal(voiceoverWordBudgetFactor("english"), 1);
    assert.ok(voiceoverWordBudgetFactor("tamil") < 1);
  });

  await test("atempo chains stages outside 0.5–2.0", () => {
    assert.equal(atempoChain(1), "");
    assert.equal(atempoChain(1.1), "atempo=1.1000");
    assert.equal(atempoChain(3), "atempo=2,atempo=1.5000");
  });

  await test("filter graph keeps a ducked bed and pads the voiceover", () => {
    const graph = buildVoiceoverFilterGraph({ videoSeconds: 30, voiceoverTempo: 1.05, withBackground: true });
    assert.ok(graph.includes("apad"));
    assert.ok(graph.includes("sidechaincompress"));
    assert.ok(graph.includes("atempo=1.0500"));
    assert.ok(!graph.includes("shortest"));
  });

  const dir = await mkdtemp(join(tmpdir(), "vo-fit-test-"));
  try {
    // 6s video with a quiet music-like tone; 6.5s "voiceover" (longer than the video).
    const video = await synth(dir, "video.mp4", [
      "-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=6",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    ]);
    const voice = await synth(dir, "vo.wav", [
      "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=24000:duration=6.5",
      "-ac", "1",
    ]);

    await test("probe reads duration and audio presence", async () => {
      const p = await probeMediaBuffer(video, "mp4");
      assert.ok(p.hasAudio);
      assert.ok(Math.abs((p.durationSeconds ?? 0) - 6) < 0.15);
    });

    await test("long voiceover is sped up to finish before the end (no chop)", async () => {
      const voProbe = await probeMediaBuffer(voice, "wav");
      const plan = planVoiceoverFit({
        speechSeconds: voProbe.durationSeconds!,
        videoSeconds: 6,
        allowRewrite: false,
      });
      assert.equal(plan.action, "speed_up");
      const muxed = await muxVoiceoverOntoVideo({
        videoBuffer: video,
        audioBuffer: voice,
        voiceoverTempo: plan.action === "speed_up" ? plan.tempo : 1,
        keepBackgroundAudio: false,
      });
      const out = await probeMediaBuffer(muxed, "mp4");
      assert.ok(Math.abs((out.durationSeconds ?? 0) - 6) < 0.15, `duration ${out.durationSeconds}`);
      const tail = await trailingSilenceSeconds(muxed, dir);
      assert.ok(tail >= 0.7, `expected silent tail after the voiceover, got ${tail.toFixed(2)}s`);
    });

    await test("mux with background bed keeps video length", async () => {
      const muxed = await muxVoiceoverOntoVideo({ videoBuffer: video, audioBuffer: voice, voiceoverTempo: 1.2 });
      const out = await probeMediaBuffer(muxed, "mp4");
      assert.ok(out.hasAudio);
      assert.ok(Math.abs((out.durationSeconds ?? 0) - 6) < 0.15, `duration ${out.durationSeconds}`);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
