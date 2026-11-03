/**
 * "Fix a part" tests — pricing, plan parsing, and a real ffmpeg cut + splice (no network).
 *
 * Run: npx tsx lib/creative-studio/commercial-production/fix/fix.test.ts
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { probeMediaBuffer } from "../audio/mux-voiceover";
import { buildSpliceFilter, cutSegment, spliceSegment } from "./edit-segment";
import { describeFixPrice, fixBillableSeconds, priceFix } from "./fix-pricing";
import { findOutputVideo } from "./animate-frame";
import { parseFixInstructions } from "./plan-fix";
import { parseShotCuts, snapToShots } from "./shots";

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

async function main() {
  console.log("\nFix a part tests\n");

  await test("first two fixes up to 5s are free; then credits at 20/s", () => {
    const first = priceFix({ startSeconds: 4, endSeconds: 8, freeFixesUsed: 0 });
    assert.deepEqual(first, { free: true, credits: 0, freeFixesLeftAfter: 1 });
    assert.equal(describeFixPrice(first, 4), "Free fix · 1 of 2");
    const second = priceFix({ startSeconds: 0, endSeconds: 5, freeFixesUsed: 1 });
    assert.ok(second.free);
    const third = priceFix({ startSeconds: 4, endSeconds: 9, freeFixesUsed: 2 });
    assert.deepEqual(third, { free: false, credits: 100, reason: "free_fixes_used" });
    assert.match(describeFixPrice(third, 5), /used your 2 free fixes.*100 credits/);
  });

  await test("a fix longer than 5s is charged even with free fixes left", () => {
    const long = priceFix({ startSeconds: 2, endSeconds: 9.5, freeFixesUsed: 0 });
    assert.deepEqual(long, { free: false, credits: 160, reason: "too_long" });
    assert.match(describeFixPrice(long, fixBillableSeconds(2, 9.5)), /longer than 5 seconds.*8-second fix uses 160/);
  });

  await test("billable seconds round up and respect the 2s billing minimum", () => {
    assert.equal(fixBillableSeconds(3, 4), 2);
    assert.equal(fixBillableSeconds(3, 7.2), 5);
    assert.equal(fixBillableSeconds(0, 5), 5);
  });

  await test("shot cuts parse from ffmpeg showinfo; flashes and edges are ignored", () => {
    const stderr = [
      "[Parsed_showinfo_1] n:0 pts:100 pts_time:0.2 ...",
      "[Parsed_showinfo_1] n:1 pts:200 pts_time:8.75 ...",
      "[Parsed_showinfo_1] n:2 pts:300 pts_time:9.0 ...",
      "[Parsed_showinfo_1] n:3 pts:400 pts_time:12.4 ...",
      "[Parsed_showinfo_1] n:4 pts:500 pts_time:14.9 ...",
    ].join("\n");
    assert.deepEqual(parseShotCuts(stderr, 15), [8.75, 12.4]);
  });

  await test("selection snaps out to its scene; long scenes are capped at 8s", () => {
    // The pickle example: problem at 2–4s inside a 0–8.75s shot → redo the whole shot.
    const pickle = snapToShots(2, 4, [8.75, 12.4], 15);
    assert.deepEqual(pickle, {
      selectedStart: 2, selectedEnd: 4, startSeconds: 0, endSeconds: 8.75, endsMidShot: false,
    });
    // A pick inside the middle shot.
    assert.deepEqual(snapToShots(9.5, 12, [8.75, 12.4], 15), {
      selectedStart: 9.5, selectedEnd: 12, startSeconds: 8.75, endSeconds: 12.4, endsMidShot: false,
    });
    // An 8.75s shot is redone whole (the clip is slowed slightly to fill it).
    assert.equal(snapToShots(2, 4, [8.75], 15).endSeconds, 8.75);
    // One 30s shot: start at the shot, cap the length, flag the mid-shot join.
    const long = snapToShots(3, 6, [], 30);
    assert.equal(long.startSeconds, 0);
    assert.equal(long.endSeconds, 8);
    assert.equal(long.endsMidShot, true);
    // Deep inside a long shot: start at the pick instead.
    assert.equal(snapToShots(20, 23, [], 30).startSeconds, 20);
    // A tap (zero-length pick) still gets the 1s minimum.
    assert.equal(snapToShots(5, 5, [], 30).selectedEnd, 6);
    // A scene shorter than 2s stays one scene (the bug: it used to pull in the next scene).
    assert.deepEqual(snapToShots(1.71, 3.42, [1.71, 3.42], 5), {
      selectedStart: 1.71, selectedEnd: 3.42, startSeconds: 1.71, endSeconds: 3.42, endsMidShot: false,
    });
    // A 1s minimum never crosses a cut either.
    const nearCut = snapToShots(3.3, 3.3, [1.71, 3.42], 5);
    assert.equal(nearCut.endSeconds, 3.42);
  });

  await test("planner output parses; 'not fixable' becomes a friendly reason", () => {
    const ok = parseFixInstructions(
      '```json\n{"fixable":true,"frameEditInstruction":"Move the jar to the desk.","motionPrompt":"Static camera. She picks up the jar and smiles.","userSummary":"Jar moves to the desk."}\n```'
    );
    assert.ok(ok.ok);
    if (ok.ok) assert.match(ok.instructions.motionPrompt, /picks up the jar/);
    assert.deepEqual(parseFixInstructions('{"fixable":false,"notFixableReason":"Make a new version."}'), {
      ok: false,
      reason: "Make a new version.",
    });
    assert.equal(parseFixInstructions("not json").ok, false);
    assert.equal(parseFixInstructions('{"fixable":true,"frameEditInstruction":"x"}').ok, false);
  });

  await test("the generated clip is found in an Interactions response (inline or uri)", () => {
    const inline = findOutputVideo({
      steps: [
        { type: "user_input", content: [{ type: "text", text: "hi" }] },
        { type: "model_output", content: [{ type: "text" }, { type: "video", mime_type: "video/mp4", data: "AAA" }] },
      ],
    });
    assert.deepEqual(inline, { data: "AAA", uri: undefined });
    const byUri = findOutputVideo({ steps: [{ type: "model_output", content: [{ type: "video", uri: "files/abc" }] }] });
    assert.equal(byUri?.uri, "files/abc");
    assert.equal(findOutputVideo({ steps: [] }), null);
  });

  await test("a slightly short clip is slowed to fill the shot, at most 1.25x", () => {
    const base = { durationSeconds: 15, width: 720, height: 1280, fps: 24, startSeconds: 0, endSeconds: 8.75 };
    assert.match(buildSpliceFilter({ ...base, editedSeconds: 8 }), /setpts=1\.0938\*PTS/);
    assert.match(buildSpliceFilter({ ...base, editedSeconds: 4 }), /setpts=1\.2500\*PTS/);
    assert.doesNotMatch(buildSpliceFilter({ ...base, editedSeconds: 9 }), /setpts=1\.\d+\*PTS/);
  });

  await test("splice filter skips empty edges", () => {
    const base = { durationSeconds: 15, width: 720, height: 1280, fps: 24 };
    const middle = buildSpliceFilter({ ...base, startSeconds: 4, endSeconds: 8 });
    assert.match(middle, /\[pre\]\[fix\]\[post\]concat=n=3/);
    const atStart = buildSpliceFilter({ ...base, startSeconds: 0, endSeconds: 5 });
    assert.match(atStart, /\[fix\]\[post\]concat=n=2/);
    const atEnd = buildSpliceFilter({ ...base, startSeconds: 10, endSeconds: 15 });
    assert.match(atEnd, /\[pre\]\[fix\]concat=n=2/);
  });

  const dir = await mkdtemp(join(tmpdir(), "fix-test-"));
  try {
    // Blue 6s video with a tone; the "edit" is a red clip the editing model returns slightly short.
    const masterPath = join(dir, "master.mp4");
    const redPath = join(dir, "red.mp4");
    await execFileAsync(getFfmpegExecutable(), [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=0x2255cc:size=360x640:rate=24:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=6",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", masterPath,
    ]);
    await execFileAsync(getFfmpegExecutable(), [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=0xcc2222:size=352x640:rate=30:duration=1.9",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", redPath,
    ]);
    const master = await readFile(masterPath);
    const red = await readFile(redPath);

    await test("cut segment is picture-only and the right length", async () => {
      const clip = await cutSegment(master, 2, 4);
      const probe = await probeMediaBuffer(clip, "mp4");
      assert.ok(Math.abs((probe.durationSeconds ?? 0) - 2) < 0.15, `cut ${probe.durationSeconds}`);
      assert.equal(probe.hasAudio, false);
    });

    await test("splice replaces only the window and keeps length, size and sound", async () => {
      const out = await spliceSegment({ master, edited: red, startSeconds: 2, endSeconds: 4 });
      const probe = await probeMediaBuffer(out, "mp4");
      assert.ok(Math.abs((probe.durationSeconds ?? 0) - 6) < 0.15, `duration ${probe.durationSeconds}`);
      assert.equal(probe.width, 360);
      assert.equal(probe.height, 640);
      assert.ok(probe.hasAudio, "original soundtrack kept");

      const outPath = join(dir, "out.mp4");
      await writeFile(outPath, out);
      const redAt = async (t: number) => {
        const { stdout } = await execFileAsync(
          getFfmpegExecutable(),
          ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", outPath, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
          { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }
        );
        const stats = await sharp(stdout as unknown as Buffer).stats();
        return stats.channels[0].mean > stats.channels[2].mean;
      };
      assert.equal(await redAt(1), false, "before the window is untouched");
      assert.equal(await redAt(3), true, "inside the window is the edit");
      assert.equal(await redAt(3.95), true, "a short clip is held on its last frame to fill the shot");
      assert.equal(await redAt(5), false, "after the window is untouched");
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
