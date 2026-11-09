/** Watermarked, low-resolution preview of a draft poster (the full image stays private until kept). */
import sharp from 'sharp';

export const PREVIEW_MAX_SIDE = 640;

export async function makePreview(full: Buffer): Promise<Buffer> {
  const img = sharp(full).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? PREVIEW_MAX_SIDE;
  const h = meta.height ?? PREVIEW_MAX_SIDE;
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(w, h));
  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));
  const fontSize = Math.round(Math.min(pw, ph) / 9);
  const mark = Buffer.from(
    `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-30 ${pw / 2} ${ph / 2})" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">
        <text x="${pw / 2}" y="${ph / 2 - fontSize}" font-size="${fontSize}" fill="#ffffff" fill-opacity="0.28" stroke="#000000" stroke-opacity="0.12" stroke-width="1">SkalX preview</text>
        <text x="${pw / 2}" y="${ph / 2 + fontSize * 1.2}" font-size="${Math.round(fontSize * 0.45)}" fill="#ffffff" fill-opacity="0.3">Keep it to get the full poster</text>
      </g>
    </svg>`,
  );
  return img.resize(pw, ph, { fit: 'inside' }).composite([{ input: mark }]).jpeg({ quality: 72 }).toBuffer();
}
