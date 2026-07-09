/** Parse a video data URL without regex on the payload (large base64 strings overflow the stack). */
export function parseVideoDataUrl(dataUrl: string): Buffer | null {
  if (!dataUrl.startsWith("data:")) return null;

  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;

  const meta = dataUrl.slice(5, commaIdx);
  if (!meta.includes("video") || !meta.includes("base64")) return null;

  const base64 = dataUrl.slice(commaIdx + 1);
  if (!base64) return null;

  return Buffer.from(base64, "base64");
}
