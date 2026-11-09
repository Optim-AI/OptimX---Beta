/**
 * POST /api/ugc/creator
 *
 * Authenticated. UGC Studio creator helpers (no credits billed):
 * - { mode: "describe", kind, description } → draws a creator (one image call)
 * - { mode: "check", image, consent }       → checks an uploaded photo (one vision call):
 *   must be a person, animal or character; not a famous person; not a child;
 *   and the owner must confirm they have permission for a real person.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import type { UgcCreatorKind } from "@/lib/creative-studio/commercial-production/campaign/ugc";
import { checkCreatorPhoto, generateCreatorPortrait } from "@/lib/creative-studio/commercial-production/ugc/creator";

export const config = {
  api: { bodyParser: { sizeLimit: "6mb" } },
  maxDuration: 90,
};

const KINDS: UgcCreatorKind[] = ["person", "animal", "mascot"];
const MAX_DESCRIPTION = 300;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const body = req.body || {};
  try {
    if (body.mode === "describe") {
      const kind: UgcCreatorKind = KINDS.includes(body.kind) ? body.kind : "person";
      const description = typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION) : "";
      if (description.length < 3) {
        return res.status(400).json({ ok: false, error: "Tell us a little about who you want, e.g. \"Tamil woman, 35, cotton saree\"." });
      }
      const jpeg = await generateCreatorPortrait({ kind, description });
      console.log("[api/ugc/creator] drawn", { userId, kind, chars: description.length });
      return res.status(200).json({ ok: true, image: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
    }

    if (body.mode === "check") {
      const image = typeof body.image === "string" ? body.image : "";
      const match = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ ok: false, error: "Please upload a JPG or PNG photo." });
      const check = await checkCreatorPhoto({ mimeType: match[1], data: match[2] });
      if (check.ok && check.kind === "person" && body.consent !== true) {
        return res.status(200).json({
          ok: false,
          kind: check.kind,
          error: "Please confirm you have this person's permission to use their photo in ads.",
          code: "CONSENT_REQUIRED",
        });
      }
      console.log("[api/ugc/creator] checked", { userId, ok: check.ok, kind: check.kind });
      return res.status(200).json({ ok: check.ok, kind: check.kind, description: check.description, error: check.reason });
    }

    return res.status(400).json({ ok: false, error: "Unknown mode" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/ugc/creator] failed", { userId, message });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
