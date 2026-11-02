/**
 * End card tests — bundled Noto Sans + ffmpeg on synthetic media (no network).
 *
 * Run: npx tsx lib/creative-studio/commercial-production/finishing/end-card.test.ts
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import opentype from "opentype.js";
import sharp from "sharp";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { FALLBACK_FONT_PATH, type LoadedFont } from "@/lib/creative-studio/poster-templates/fonts";
import { probeMediaBuffer } from "../audio/mux-voiceover";
import { makeValidBrief } from "../commercial-director/fixtures";
import { endCardContentFromBrief } from "./attach-end-card";
import { applyEndCard, fontCanDraw, renderEndCardPng, scriptFontFamily, type EndCardFonts } from "./end-card";

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

function localFonts(): EndCardFonts {
  const buf = readFileSync(join(process.cwd(), FALLBACK_FONT_PATH));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const font: LoadedFont = { family: "Noto Sans", weight: 400, data, font: opentype.parse(data), fallback: true };
  return { bold: font, medium: font };
}

async function main() {
  console.log("\nEnd card tests\n");
  const fonts = localFonts();

  await test("Latin text is drawable; Tamil script with a Latin font is not", () => {
    assert.ok(fontCanDraw(fonts.bold.font, "Buy 2, get 1 free! +91 98400 12345"));
    assert.ok(!fontCanDraw(fonts.bold.font, "இப்போவே order பண்ணுங்க"));
  });

  await test("renders a transparent card; undrawable lines are skipped, not boxed", async () => {
    const { png, drawn, skipped } = await renderEndCardPng({
      width: 720,
      height: 1280,
      fonts,
      content: {
        brandName: "Oorgaa",
        offer: "Buy 2, get 1 free",
        cta: "இப்போவே order பண்ணுங்க",
        contact: "WhatsApp 98400 12345",
      },
    });
    assert.deepEqual(drawn, ["brandName", "offer", "contact"]);
    assert.deepEqual(skipped, ["cta"]);
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 720);
    assert.equal(meta.height, 1280);
    assert.ok(meta.hasAlpha);
    // Top of the frame stays fully transparent (the video shows through).
    const { data } = await sharp(png).extract({ left: 0, top: 0, width: 720, height: 200 }).raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) assert.equal(data[i], 0);
  });

  // Pango + a Tamil font: use the macOS system font when present (no network).
  const tamilFont = "/System/Library/Fonts/Supplemental/Tamil Sangam MN.ttc";
  if (existsSync(tamilFont)) {
    await test("Tamil lines are shaped with a script font instead of skipped", async () => {
      const asked: string[] = [];
      const { png, drawn, skipped } = await renderEndCardPng({
        width: 720,
        height: 1280,
        fonts: {
          ...fonts,
          scriptFontFile: async (family) => {
            asked.push(family);
            return family === "Noto Sans Tamil" ? { path: tamilFont, family: "Tamil Sangam MN" } : null;
          },
        },
        content: {
          brandName: "Oorgaa",
          offer: "2 வாங்கினால் 1 இலவசம்",
          cta: "இப்போவே order பண்ணுங்க",
          contact: "हमें कॉल करें",
        },
      });
      assert.deepEqual(drawn, ["brandName", "offer", "cta"]);
      assert.deepEqual(skipped, ["contact"]);
      assert.deepEqual(asked, ["Noto Sans Tamil", "Noto Sans Tamil", "Noto Sans Devanagari"]);
      // Offer pixels land in the lower part of the frame.
      const { data } = await sharp(png).extract({ left: 0, top: 900, width: 720, height: 380 }).raw().toBuffer({ resolveWithObject: true });
      let white = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 240 && data[i + 3] > 240) white += 1;
      assert.ok(white > 500, `expected rendered Tamil text, got ${white} white pixels`);
    });
  } else {
    console.log("  - Tamil shaping test skipped (no system Tamil font)");
  }

  await test("scriptFontFamily picks the Noto family for each Indian script", () => {
    assert.equal(scriptFontFamily("பொங்கல்"), "Noto Sans Tamil");
    assert.equal(scriptFontFamily("दिवाली ऑफर"), "Noto Sans Devanagari");
    assert.equal(scriptFontFamily("ಹಬ್ಬ"), "Noto Sans Kannada");
    assert.equal(scriptFontFamily("ഓണം"), "Noto Sans Malayalam");
    assert.equal(scriptFontFamily("Order now"), null);
  });

  await test("brief → end card content: off unless enabled; CTA falls back to voiceover CTA", () => {
    assert.equal(endCardContentFromBrief(makeValidBrief()), null);
    const content = endCardContentFromBrief(
      makeValidBrief({
        endCard: { enabled: true, offer: "20% off", contact: "pulse.in" },
        voiceover: { cta: "Shop now", ctaEnabled: true },
      })
    );
    assert.equal(content?.cta, "Shop now");
    assert.equal(content?.offer, "20% off");
    assert.equal(content?.brandName, "Northline Athletics");
  });

  const dir = await mkdtemp(join(tmpdir(), "end-card-test-"));
  try {
    const out = join(dir, "video.mp4");
    await execFileAsync(getFfmpegExecutable(), [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=0x3366aa:size=360x640:rate=24:duration=5",
      "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=5",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out,
    ]);
    const video = await readFile(out);

    await test("overlay keeps duration and audio; card only appears at the end", async () => {
      const result = await applyEndCard({
        videoBuffer: video,
        fonts,
        seconds: 2,
        content: { brandName: "Oorgaa", offer: "Buy 2, get 1 free", cta: "Order now" },
      });
      const probe = await probeMediaBuffer(result.video, "mp4");
      assert.ok(Math.abs((probe.durationSeconds ?? 0) - 5) < 0.15, `duration ${probe.durationSeconds}`);
      assert.ok(probe.hasAudio);
      assert.equal(probe.width, 360);

      const frameAt = async (t: number) => {
        const path = join(dir, "result.mp4");
        await import("node:fs/promises").then((fs) => fs.writeFile(path, result.video));
        const { stdout } = await execFileAsync(
          getFfmpegExecutable(),
          ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
          { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }
        );
        return sharp(stdout as unknown as Buffer).extract({ left: 0, top: 520, width: 360, height: 60 }).stats();
      };
      const before = await frameAt(1);
      const after = await frameAt(4.8);
      // The bottom band darkens once the card's gradient panel is on screen.
      assert.ok(after.channels[2].mean < before.channels[2].mean - 20, "bottom band darker with end card");
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
