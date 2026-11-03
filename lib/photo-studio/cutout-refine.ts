/**
 * Clean a background-removed product before compositing:
 *  - keep the product's pieces (every sizeable connected part, so earbuds next to their
 *    case survive) and drop small islands (logos/text printed on the backdrop that
 *    background removal treats as foreground)
 *  - drop faint haze (the original photo's floor shadow)
 *  - make enclosed see-through patches solid (light labels on light backdrops)
 */

import sharp from "sharp";

const HAZE = 110;
/** A part smaller than this share of the main piece is a stray island, not product. */
const MIN_PART = 0.04;

export async function refineCutout(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const alpha = (i: number) => data[i * 4 + 3];
  const solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) solid[i] = alpha(i) >= HAZE ? 1 : 0;

  // 4-connected solid components; the product is every part near the largest one's size.
  const label = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  const sizes: number[] = [];
  let current = 0;
  for (let start = 0; start < N; start++) {
    if (!solid[start] || label[start] !== -1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = current;
    while (head < tail) {
      const p = queue[head++];
      const x = p % W;
      const y = (p - x) / W;
      const n = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of n) {
        if (q >= 0 && solid[q] && label[q] === -1) {
          label[q] = current;
          queue[tail++] = q;
        }
      }
    }
    sizes.push(tail);
    current++;
  }
  if (!sizes.length) return png;
  const biggest = Math.max(...sizes);
  const keep = new Uint8Array(sizes.length);
  sizes.forEach((n, i) => (keep[i] = n >= biggest * MIN_PART ? 1 : 0));
  const inObject = (p: number) => label[p] >= 0 && keep[label[p]] === 1;

  // Background = everything not in the object that is reachable from the border.
  const outside = new Uint8Array(N);
  let head = 0;
  let tail = 0;
  const pushIfOutside = (p: number) => {
    if (!outside[p] && !inObject(p)) {
      outside[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < W; x++) {
    pushIfOutside(x);
    pushIfOutside((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    pushIfOutside(y * W);
    pushIfOutside(y * W + W - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) pushIfOutside(p - 1);
    if (x < W - 1) pushIfOutside(p + 1);
    if (y > 0) pushIfOutside(p - W);
    if (y < H - 1) pushIfOutside(p + W);
  }

  for (let i = 0; i < N; i++) {
    if (inObject(i)) {
      // Interior pixels are fully solid; only the silhouette edge keeps soft alpha.
      const x = i % W;
      const interior =
        x > 0 && x < W - 1 && i >= W && i < N - W &&
        inObject(i - 1) && inObject(i + 1) && inObject(i - W) && inObject(i + W);
      if (interior) data[i * 4 + 3] = 255;
      continue;
    }
    // Enclosed by the object → part of it (see-through label patch); otherwise background.
    data[i * 4 + 3] = outside[i] ? 0 : 255;
  }
  trimFloorShadow(data, W, H);
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();
}

/**
 * The original photo's floor shadow survives background removal as a pale ellipse
 * under the product, wider than the product itself. In the bottom quarter, clear
 * anything outside the body's horizontal span on rows that flare well past it.
 */
function trimFloorShadow(data: Buffer, W: number, H: number) {
  const span = (y: number): [number, number] | null => {
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] >= HAZE) {
        if (l < 0) l = x;
        r = x;
      }
    }
    return l < 0 ? null : [l, r];
  };
  let top = 0;
  while (top < H && !span(top)) top++;
  let bottom = H - 1;
  while (bottom > top && !span(bottom)) bottom--;
  const h = bottom - top + 1;
  if (h < 20) return;
  const baseStart = top + Math.floor(h * 0.75);
  let bodyL = W;
  let bodyR = -1;
  for (let y = top; y < baseStart; y++) {
    const s = span(y);
    if (s) {
      bodyL = Math.min(bodyL, s[0]);
      bodyR = Math.max(bodyR, s[1]);
    }
  }
  const bodyW = bodyR - bodyL + 1;
  if (bodyW <= 0) return;
  const margin = Math.round(bodyW * 0.02);
  for (let y = baseStart; y <= bottom; y++) {
    const s = span(y);
    if (!s || s[1] - s[0] + 1 <= bodyW * 1.12) continue;
    // Sample the shadow's colour from the flared wings, then clear the wings and any
    // shadow-coloured pixels under the product's base.
    let n = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if ((x < bodyL - margin || x > bodyR + margin) && data[i + 3] >= HAZE) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
        data[i + 3] = 0;
      }
    }
    if (!n) continue;
    r /= n;
    g /= n;
    b /= n;
    for (let x = Math.max(0, bodyL - margin); x <= Math.min(W - 1, bodyR + margin); x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
      if (d < 60) data[i + 3] = 0;
    }
  }
}
