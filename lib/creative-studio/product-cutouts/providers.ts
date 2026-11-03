/**
 * Product cut-out providers: user's product photo → PNG with transparent background.
 *
 * Hosted APIs are the production providers (CUTOUT_PROVIDER, or whichever key
 * is set). `builtin-isnet` is the free on-server model (Photo Studio's default
 * when no key is set). `local-uniform` is a development-only fallback for studio
 * packshots on a light, plain background.
 */

import axios from "axios";
import sharp from "sharp";
import { BuiltInCutoutProvider } from "./builtin";

export type CutoutInput = { buffer: Buffer; mimeType: string };

export interface CutoutProvider {
  readonly id: string;
  /** PNG with alpha, background removed. Throws on provider failure. */
  remove(input: CutoutInput): Promise<Buffer>;
}

function form(input: CutoutInput, fields: Record<string, string>): FormData {
  const fd = new FormData();
  const ext = input.mimeType.split("/")[1] || "png";
  fd.append("image_file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), `product.${ext}`);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

/** Photoroom Remove Background API (Basic plan). */
export class PhotoroomCutoutProvider implements CutoutProvider {
  readonly id = "photoroom";
  constructor(private readonly apiKey: string) {}
  async remove(input: CutoutInput): Promise<Buffer> {
    // No crop: quality checks need the full frame; the service trims afterwards.
    const res = await axios.post("https://sdk.photoroom.com/v1/segment", form(input, { format: "png", crop: "false" }), {
      headers: { "x-api-key": this.apiKey, Accept: "image/png" },
      responseType: "arraybuffer",
      timeout: 60_000,
    });
    return Buffer.from(res.data);
  }
}

/** remove.bg API. */
export class RemoveBgCutoutProvider implements CutoutProvider {
  readonly id = "removebg";
  constructor(private readonly apiKey: string) {}
  async remove(input: CutoutInput): Promise<Buffer> {
    const res = await axios.post("https://api.remove.bg/v1.0/removebg", form(input, { size: "auto", format: "png" }), {
      headers: { "X-Api-Key": this.apiKey },
      responseType: "arraybuffer",
      timeout: 60_000,
    });
    return Buffer.from(res.data);
  }
}

/**
 * Removes a plain, uniform background by flood-filling from the image border
 * (studio packshots on seamless white/grey). Soft edge ramp to avoid jaggies.
 */
export class LocalUniformCutoutProvider implements CutoutProvider {
  readonly id = "local-uniform";
  constructor(private readonly tolerance = 26, private readonly feather = 22) {}

  async remove(input: CutoutInput): Promise<Buffer> {
    const { data, info } = await sharp(input.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]] as const;

    // Background colour = median of border pixels
    const border: number[][] = [];
    for (let x = 0; x < w; x += 2) border.push([...px(x)], [...px((h - 1) * w + x)]);
    for (let y = 0; y < h; y += 2) border.push([...px(y * w)], [...px(y * w + w - 1)]);
    const median = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
    const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const bgLum = lum(median[0], median[1], median[2]);
    // Dark backgrounds can't be separated from dark products by colour alone — leave those to a hosted API.
    if (bgLum < 0.55) {
      throw new Error("The local cut-out only handles light, plain backgrounds");
    }
    const dist = (i: number) => {
      const [r, g, b] = px(i);
      return Math.sqrt((r - median[0]) ** 2 + (g - median[1]) ** 2 + (b - median[2]) ** 2);
    };

    // Flood fill background from every border pixel within tolerance + feather band
    const limit = this.tolerance + this.feather;
    const seen = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;
    const push = (i: number) => {
      if (!seen[i] && dist(i) <= limit) {
        seen[i] = 1;
        queue[tail++] = i;
      }
    };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }

    const out = Buffer.from(data);
    for (let i = 0; i < w * h; i++) {
      if (!seen[i]) continue;
      const d = dist(i);
      out[i * 4 + 3] = d <= this.tolerance ? 0 : Math.round(((d - this.tolerance) / this.feather) * 255);
    }
    return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  }
}

/**
 * Provider from env: explicit CUTOUT_PROVIDER, else whichever API key is set.
 * Returns null when no hosted provider is configured — callers then let the
 * image model place the product (current behaviour). The local fallback damages
 * white labels/soles on light backgrounds, so it is opt-in for development only
 * (CUTOUT_PROVIDER=local).
 *
 * `builtin: true` (Photo Studio) falls back to the built-in ISNet model instead of
 * null, so exact shots work without a paid key. CUTOUT_PROVIDER=none turns all
 * cut-outs off; CUTOUT_PROVIDER=builtin forces the built-in model everywhere.
 */
export function getCutoutProvider(env: NodeJS.ProcessEnv = process.env, opts: { builtin?: boolean } = {}): CutoutProvider | null {
  const choice = (env.CUTOUT_PROVIDER || "").trim().toLowerCase();
  const photoroom = env.PHOTOROOM_API_KEY?.trim();
  const removebg = env.REMOVE_BG_API_KEY?.trim();
  if (choice === "none") return null;
  if (choice === "local") return new LocalUniformCutoutProvider();
  if (choice === "builtin") return new BuiltInCutoutProvider();
  if ((choice === "photoroom" || !choice) && photoroom) return new PhotoroomCutoutProvider(photoroom);
  if ((choice === "removebg" || !choice) && removebg) return new RemoveBgCutoutProvider(removebg);
  if (choice) console.warn(`[cutout] CUTOUT_PROVIDER=${choice} but its API key is not set; ${opts.builtin ? "using the built-in model" : "cut-outs are off"}`);
  return opts.builtin ? new BuiltInCutoutProvider() : null;
}
