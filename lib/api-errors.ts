/**
 * Turning failed API calls into messages people can act on. Servers and gateways
 * sometimes answer with an HTML page (timeouts, crashes), and the browser reports
 * dropped connections as "Failed to fetch" — neither should reach the user raw.
 */

/** Parse a JSON body without throwing (HTML error pages become {}). */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

/** The message for a non-OK response: the server's own error when it gave one. */
export function responseError(res: Response, body: unknown, fallback: string): string {
  const serverMessage = typeof (body as { error?: unknown })?.error === "string" ? ((body as { error: string }).error).trim() : "";
  switch (res.status) {
    case 401:
      return "Your session has ended. Sign in again to continue.";
    case 402:
      return serverMessage || "You're out of credits for this.";
    case 413:
      return "That file is too large to upload.";
    case 429:
      return "Too many requests at once. Wait a moment, then try again.";
    case 502:
    case 503:
      return "The service is busy right now. Try again in a minute.";
    case 504:
      return "This took longer than expected and timed out. Try again.";
    default:
      return serverMessage || fallback;
  }
}

/** The message for a thrown error (network drop, parse error, our own Error). */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!msg) return fallback;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "We can't reach SkalX right now. Check your connection and try again.";
  }
  if (/unexpected token|is not valid json|json\.parse/i.test(msg)) return fallback;
  return msg;
}
