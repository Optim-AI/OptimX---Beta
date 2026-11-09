/** Small structured logger for Meta code. Never pass tokens; known token-ish keys are redacted anyway. */

const SECRET_KEYS = /token|secret|proof|signed_request|^code$|^confirmation$/i;

function redact(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : v;
  }
  return out;
}

export const metaLog = {
  info(event: string, meta?: Record<string, unknown>) {
    console.log(`[meta] ${event}`, redact(meta) ?? '');
  },
  warn(event: string, meta?: Record<string, unknown>) {
    console.warn(`[meta] ${event}`, redact(meta) ?? '');
  },
  error(event: string, meta?: Record<string, unknown>) {
    console.error(`[meta] ${event}`, redact(meta) ?? '');
  },
};
