/**
 * Resolve the owning Supabase user for Meta/Instagram OAuth callbacks.
 *
 * Identity MUST come from flow-bound OAuth state (`state.t` = access token
 * embedded at /oauth/start) or, secondarily, an Authorization Bearer token.
 * Never use SUPABASE_INTEGRATION_USER_ID or any global/default user.
 */

import { decodeState } from "@/auth/helpers";

export type OAuthCallbackUserSuccess = {
  ok: true;
  userId: string;
  /** Nonce from state.r when present (CSRF entropy from start) */
  stateNonce: string | null;
  /** Provider hint from state.p when present */
  stateProvider: string | null;
  source: "oauth_state" | "authorization_header";
};

export type OAuthCallbackUserFailure = {
  ok: false;
  status: number;
  code:
    | "missing_state"
    | "invalid_state"
    | "missing_supabase_token"
    | "invalid_supabase_token"
    | "provider_mismatch"
    | "missing_supabase_user_id";
  error: string;
};

export type ResolveOAuthCallbackUserDeps = {
  getUserByAccessToken: (
    accessToken: string
  ) => Promise<{ userId: string | null; errorMessage?: string | null }>;
};

function firstQueryValue(
  value: string | string[] | undefined | null
): string | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function bearerFromAuthorization(
  authorization: string | string[] | undefined
): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("Bearer ")) return null;
  const token = raw.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Pure identity resolution for OAuth callbacks (injectable auth lookup).
 */
export async function resolveOAuthCallbackUser(
  opts: {
    state: string | string[] | undefined | null;
    authorizationHeader?: string | string[] | undefined;
    /** When set, reject if state.p is present and does not match */
    expectedStateProvider?: string | null;
  },
  deps: ResolveOAuthCallbackUserDeps
): Promise<OAuthCallbackUserSuccess | OAuthCallbackUserFailure> {
  const stateRaw = firstQueryValue(opts.state ?? null);
  if (!stateRaw) {
    return {
      ok: false,
      status: 400,
      code: "missing_state",
      error:
        "Missing OAuth state. Restart the connection from Integrations so your SkalX session is bound to the flow.",
    };
  }

  const stateObj = decodeState(stateRaw);
  if (!stateObj || typeof stateObj !== "object") {
    return {
      ok: false,
      status: 400,
      code: "invalid_state",
      error:
        "Invalid or corrupted OAuth state. Restart the connection from Integrations.",
    };
  }

  const stateProvider =
    typeof (stateObj as any).p === "string" ? String((stateObj as any).p) : null;
  const stateNonce =
    typeof (stateObj as any).r === "string" ? String((stateObj as any).r) : null;

  if (
    opts.expectedStateProvider &&
    stateProvider &&
    stateProvider !== opts.expectedStateProvider
  ) {
    return {
      ok: false,
      status: 400,
      code: "provider_mismatch",
      error:
        "OAuth state provider mismatch. Restart the connection from the correct Integrations entry point.",
    };
  }

  const tokenFromState =
    typeof (stateObj as any).t === "string" && (stateObj as any).t.trim()
      ? String((stateObj as any).t).trim()
      : null;
  const tokenFromHeader = bearerFromAuthorization(opts.authorizationHeader);

  // Prefer flow-bound state token; Bearer is secondary (non-browser / tests).
  const accessToken = tokenFromState || tokenFromHeader;
  const source: "oauth_state" | "authorization_header" = tokenFromState
    ? "oauth_state"
    : "authorization_header";

  if (!accessToken) {
    return {
      ok: false,
      status: 400,
      code: "missing_supabase_token",
      error:
        "No SkalX session was bound to this OAuth flow. Pass your access token as `sb` when starting OAuth.",
    };
  }

  const lookedUp = await deps.getUserByAccessToken(accessToken);
  if (!lookedUp.userId) {
    return {
      ok: false,
      status: 401,
      code: "invalid_supabase_token",
      error:
        "SkalX session for this OAuth flow is invalid or expired. Sign in again and reconnect.",
    };
  }

  return {
    ok: true,
    userId: lookedUp.userId,
    stateNonce,
    stateProvider,
    source,
  };
}

/**
 * Default deps: validate access token via Supabase Auth admin API.
 * Never reads SUPABASE_INTEGRATION_USER_ID.
 */
export async function resolveOAuthCallbackUserFromRequest(opts: {
  state: string | string[] | undefined | null;
  authorizationHeader?: string | string[] | undefined;
  expectedStateProvider?: string | null;
}): Promise<OAuthCallbackUserSuccess | OAuthCallbackUserFailure> {
  const { supabaseAdmin } = await import("@/auth/supabase/admin");
  return resolveOAuthCallbackUser(opts, {
    getUserByAccessToken: async (accessToken) => {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
        if (error || !data?.user?.id) {
          return {
            userId: null,
            errorMessage: error ? String((error as any).message || error) : null,
          };
        }
        return { userId: data.user.id };
      } catch {
        return { userId: null };
      }
    },
  });
}

/** Explicit guard used in tests — env fallback must never be consulted. */
export function assertNoIntegrationUserIdFallback(): void {
  // Intentionally a no-op documentation hook: callers must not read
  // process.env.SUPABASE_INTEGRATION_USER_ID for identity. Tests assert
  // resolveOAuthCallbackUser ignores that env even when set.
}
