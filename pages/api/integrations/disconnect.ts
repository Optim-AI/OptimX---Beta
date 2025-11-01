// pages/api/integrations/disconnect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { setStatus } from "../../../lib/integrationStore";
import * as cookie from "cookie";

async function revokeGoogleToken(token: string) {
  // RFC7009 revoke endpoint
  const params = new URLSearchParams({ token });
  const resp = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return { status: resp.status, text: await resp.text() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: "platform required" });

    // If Google, attempt to revoke tokens found in cookies
    const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    const googleRefresh = cookies["ga_refresh_token"];
    const googleAccess = cookies["ga_access_token"];

    const revokeResults: Record<string, any> = {};

    if (platform === "google-ads" && (googleRefresh || googleAccess)) {
      try {
        if (googleRefresh) revokeResults.refresh = await revokeGoogleToken(googleRefresh);
        else if (googleAccess) revokeResults.access = await revokeGoogleToken(googleAccess);
      } catch (err) {
        revokeResults.error = String(err);
      }
    }

    // Clear cookies in response (expire)
    const clearCookies: string[] = [];
    const expireOpts = { path: "/", httpOnly: true, maxAge: 0, sameSite: "lax" as const };
    clearCookies.push(cookie.serialize("ga_access_token", "", expireOpts));
    clearCookies.push(cookie.serialize("ga_refresh_token", "", expireOpts));
    clearCookies.push(cookie.serialize("ga_token_time", "", expireOpts));
    // set header to clear them
    res.setHeader("Set-Cookie", clearCookies);

    // update server-side status
    await setStatus(platform, false);

    return res.status(200).json({ ok: true, revokeResults });
  } catch (err) {
    console.error("disconnect error", err);
    return res.status(500).json({ error: "disconnect failed", details: String(err) });
  }
}
