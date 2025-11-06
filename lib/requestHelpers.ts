// lib/requestHelpers.ts
import type { NextApiRequest } from "next";
import { supabaseAdmin } from "./supabaseClient";

/** Extract token from Authorization or cookies */
export function getTokenFromReq(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && String(authHeader).startsWith("Bearer ")) {
    return String(authHeader).slice(7);
  }

  const cookieHeader = req.headers.cookie ?? "";
  if (!cookieHeader) return null;

  const parseCookie = (name: string): string | null => {
    const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
    if (!match) return null;
    return decodeURIComponent(match.split("=")[1] || "");
  };

  // Typical Supabase cookie keys
  return parseCookie("sb-access-token") || parseCookie("sb:token") || parseCookie("sb") || null;
}

/** Resolve Supabase auth user.id from token; returns null if not resolvable */
export async function getUserIdFromRequest(req: NextApiRequest): Promise<string | null> {
  try {
    const token = getTokenFromReq(req);
    if (!token) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
      // console.warn("getUser error", error);
      return null;
    }
    return data?.user?.id ?? null;
  } catch (err) {
    return null;
  }
}
