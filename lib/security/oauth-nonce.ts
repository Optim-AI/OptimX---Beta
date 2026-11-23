/**
 * Browser-bound OAuth `state` for flows that have no signed-in user in the redirect
 * (Google Ads). A random nonce goes into both the provider's `state` and an httpOnly
 * cookie; the callback accepts the code only when they match, so an attacker can't
 * finish a connection in someone else's browser (login CSRF).
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { parse, serialize } from "cookie";

export function issueOAuthNonce(cookieName: string, cookiePath: string, secure: boolean): { state: string; setCookie: string } {
  const state = randomBytes(24).toString("base64url");
  return {
    state,
    setCookie: serialize(cookieName, state, { httpOnly: true, secure, sameSite: "lax", path: cookiePath, maxAge: 600 }),
  };
}

export function checkOAuthNonce(cookieHeader: string | undefined, cookieName: string, state: unknown): boolean {
  const expected = parse(cookieHeader ?? "")[cookieName];
  const got = Array.isArray(state) ? state[0] : state;
  if (!expected || typeof got !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearOAuthNonce(cookieName: string, cookiePath: string): string {
  return serialize(cookieName, "", { path: cookiePath, maxAge: 0 });
}
