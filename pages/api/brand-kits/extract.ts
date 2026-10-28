import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { normalizeAuditUrl } from "@/lib/audit/url-safety";
import { extractBrandKitFromWebsite } from "@/lib/brand-kit/extract";
import { safeBrandFetch } from "@/lib/brand-kit/fetch";

/**
 * POST /api/brand-kits/extract { url }
 * Reads a public website and proposes logo, colours and fonts. Nothing is saved;
 * the editor shows the proposal for the user to confirm.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please sign in." });

  const check = normalizeAuditUrl(req.body?.url);
  if (!check.ok) return res.status(400).json({ error: check.message.replace(/audited/g, "imported") });

  try {
    const extraction = await extractBrandKitFromWebsite(check.url, safeBrandFetch);
    return res.status(200).json({ extraction });
  } catch (err) {
    console.warn("[brand-kits/extract] failed", { url: check.url, err: (err as Error)?.message });
    return res.status(422).json({
      error: "We couldn't read that website. You can still fill in the kit by hand.",
    });
  }
}
