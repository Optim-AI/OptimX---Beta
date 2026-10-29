/**
 * Built-in background removal: ISNet general-use (Dichotomous Image Segmentation,
 * Apache-2.0) run on our own server with ONNX Runtime — no API key, no per-image
 * cost. Photoroom / remove.bg take over when their key is set.
 *
 * Why ISNet: BiRefNet cuts slightly cleaner but peaks at ~6 GB RAM (no serverless
 * function has that); ISNet at "basic" graph optimisation peaks at ~1.1 GB and runs
 * in well under a second. U²-Net is lighter but leaves halos and keeps shadows.
 *
 * The 179 MB model is downloaded once per server instance into the temp folder and
 * checked against its SHA-256 (or read from CUTOUT_MODEL_PATH; CUTOUT_MODEL_URL
 * points the download at a mirror). One inference at a time per instance keeps
 * memory bounded when several shots ask for a cut-out together.
 */

import { createHash } from "crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import sharp from "sharp";
import type { CutoutInput, CutoutProvider } from "./providers";

export const BUILTIN_CUTOUT_ID = "builtin-isnet";

const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx";
const MODEL_SHA256 = "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a";
const MODEL_BYTES = 178_648_008;
const SIZE = 1024;
/** Working resolution of the returned cut-out (matches the other providers). */
const MAX_SIDE = 1600;

type Ort = typeof import("onnxruntime-node");
type Session = import("onnxruntime-node").InferenceSession;

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function downloadModel(dest: string): Promise<void> {
  const url = process.env.CUTOUT_MODEL_URL?.trim() || MODEL_URL;
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok || !res.body) throw new Error(`Model download failed (${res.status})`);
  const part = `${dest}.${process.pid}.${Date.now()}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(part));
    const sum = await sha256File(part);
    if (sum !== MODEL_SHA256) throw new Error("Downloaded cut-out model failed its checksum");
    renameSync(part, dest);
  } finally {
    if (existsSync(part)) unlinkSync(part);
  }
}

async function modelPath(): Promise<string> {
  const fixed = process.env.CUTOUT_MODEL_PATH?.trim();
  if (fixed) return fixed;
  const dir = join(tmpdir(), "optimx-models");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "isnet-general-use.onnx");
  if (existsSync(path) && statSync(path).size === MODEL_BYTES && (await sha256File(path)) === MODEL_SHA256) return path;
  if (existsSync(path)) unlinkSync(path);
  console.info("[cutout] downloading the built-in background-removal model");
  await downloadModel(path);
  return path;
}

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<Session> | null = null;

function loadOrt(): Promise<Ort> {
  // Kept out of the bundle and out of file tracing for every other route; the
  // Photo Studio routes include the Linux binary explicitly (next.config.ts).
  const id = "onnxruntime-node";
  ortPromise ??= (import(/* webpackIgnore: true */ id) as Promise<Ort & { default?: Ort }>).then((m) => (m.InferenceSession ? m : m.default!));
  return ortPromise;
}

function loadSession(): Promise<Session> {
  sessionPromise ??= (async () => {
    const [ort, path] = await Promise.all([loadOrt(), modelPath()]);
    // "basic" optimisation + no memory arena: ~1.1 GB peak instead of ~2.3 GB, same speed.
    return ort.InferenceSession.create(path, {
      executionMode: "sequential",
      graphOptimizationLevel: "basic",
      enableCpuMemArena: false,
      enableMemPattern: false,
    });
  })().catch((e) => {
    sessionPromise = null;
    throw e;
  });
  return sessionPromise;
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** ISNet input: pixels scaled by the image max, centred at 0.5 (as the model was trained), NCHW. */
export function isnetInput(rgb: Buffer, size = SIZE): Float32Array {
  let max = 1;
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) out[c * plane + i] = rgb[i * 3 + c] / max - 0.5;
  }
  return out;
}

/** Model output → 8-bit mask, min-max normalised. */
export function isnetMask(pred: Float32Array, size = SIZE): Buffer {
  const n = size * size;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (pred[i] < lo) lo = pred[i];
    if (pred[i] > hi) hi = pred[i];
  }
  const range = hi - lo || 1;
  const mask = Buffer.alloc(n);
  for (let i = 0; i < n; i++) mask[i] = Math.round(((pred[i] - lo) / range) * 255);
  return mask;
}

export class BuiltInCutoutProvider implements CutoutProvider {
  readonly id = BUILTIN_CUTOUT_ID;

  async remove(input: CutoutInput): Promise<Buffer> {
    const { data: rgb, info } = await sharp(input.buffer)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H } = info;
    const small = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();

    const pred = await oneAtATime(async () => {
      const [ort, session] = await Promise.all([loadOrt(), loadSession()]);
      const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", isnetInput(small), [1, 3, SIZE, SIZE]) });
      return out[session.outputNames[0]].data as Float32Array;
    });

    const alpha = await sharp(isnetMask(pred), { raw: { width: SIZE, height: SIZE, channels: 1 } })
      .resize(W, H, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer();
    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = alpha[i];
    }
    return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  }
}

/** Load the model ahead of the first cut-out (e.g. while the product is being read). */
export function warmBuiltInCutout(): void {
  loadSession().catch((e) => console.warn("[cutout] built-in model unavailable", (e as Error)?.message));
}
