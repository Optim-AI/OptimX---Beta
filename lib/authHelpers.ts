// lib/authHelpers.ts
export function encodeState(obj: any): string {
  try {
    const json = JSON.stringify(obj);
    return Buffer.from(json, "utf8").toString("base64");
  } catch (err) {
    console.error("encodeState error:", err);
    return "";
  }
}

export function decodeState(state?: string | string[] | null): any | null {
  try {
    if (!state) return null;
    const s = Array.isArray(state) ? state[0] : state;
    const json = Buffer.from(decodeURIComponent(s), "base64").toString("utf8");
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}
