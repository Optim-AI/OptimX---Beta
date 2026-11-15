/** Sign-in check and request limit for App Router (app/api) routes. */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { clientIp, rateLimit, TOO_MANY_REQUESTS } from "./rate-limit";

/**
 * Returns the signed-in user's id, or a response to send back (401 when not signed in,
 * 429 when over the limit). These routes call paid AI models, so they are never open.
 */
export async function requireUserForAi(req: Request, name: string, perMinute = 20): Promise<{ userId: string } | { response: NextResponse }> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { response: NextResponse.json({ error: "Please sign in to use this." }, { status: 401 }) };
  let userId: string | null = null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    userId = error ? null : data?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return { response: NextResponse.json({ error: "Please sign in to use this." }, { status: 401 }) };
  const r = rateLimit(`${name}:${userId}:${clientIp(req.headers)}`, perMinute, 60_000);
  if (!r.ok) {
    return { response: NextResponse.json({ error: TOO_MANY_REQUESTS, code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } }) };
  }
  return { userId };
}
