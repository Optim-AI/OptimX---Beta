// GET    /api/agent/context                          → your items + what's used automatically
// GET    /api/agent/context?id=…&open=1              → { url } signed link to view an uploaded file
// POST   /api/agent/context {kind:"note", title, text}
// POST   /api/agent/context {kind:"link", url}
// POST   /api/agent/context {kind:"file", step:"start", name, mime, size} → {path, token}
// POST   /api/agent/context {kind:"file", step:"finish", path, name}
// DELETE /api/agent/context?id=…
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getUserBrand } from "@/lib/brand-kit/server";
import { getBrandResearch, listFocusedResearch } from "@/lib/research/store";
import { buildDashboard } from "@/lib/meta-intel/summary";
import {
  ContextError, MAX_ITEMS, addLink, addNote, createUpload, deleteContextItem, fileLink, listContextItems, processUpload,
} from "@/lib/agent/context-items";

export const config = { maxDuration: 120 };

const idOf = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

async function automatic(userId: string) {
  const [{ kit, snapshot }, focused, meta] = await Promise.all([
    getUserBrand(userId).catch(() => ({ kit: null, snapshot: null })),
    listFocusedResearch(userId).catch(() => []),
    Promise.race([buildDashboard(userId, 30 as any).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]),
  ]);
  const website = kit?.websiteUrl || (snapshot as any)?.website_url || null;
  const research = await getBrandResearch(userId, website).catch(() => null);
  return {
    brandKit: !!kit,
    brandResearch: !!research,
    focusedReports: focused.length,
    meta: meta ? (meta.state === "ready" ? "ready" : meta.state === "not_connected" ? "not_connected" : "pending") : "unknown",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  const id = idOf(req.query.id);
  try {
    if (req.method === "GET") {
      if (id && req.query.open) {
        const url = await fileLink(userId, id);
        return url ? res.status(200).json({ ok: true, url }) : res.status(404).json({ ok: false, error: "File not found" });
      }
      const [items, auto] = await Promise.all([listContextItems(userId), automatic(userId)]);
      return res.status(200).json({ ok: true, items, automatic: auto, max: MAX_ITEMS });
    }
    if (req.method === "POST") {
      const b = (req.body ?? {}) as Record<string, unknown>;
      if (b.kind === "note") return res.status(200).json({ ok: true, item: await addNote(userId, b.title, b.text) });
      if (b.kind === "link") return res.status(200).json({ ok: true, item: await addLink(userId, b.url) });
      if (b.kind === "file" && b.step === "start") return res.status(200).json({ ok: true, ...(await createUpload(userId, b.name, b.mime, b.size)) });
      if (b.kind === "file" && b.step === "finish") return res.status(200).json({ ok: true, item: await processUpload(userId, b.path, b.name) });
      return res.status(400).json({ ok: false, error: "Unknown request" });
    }
    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ ok: false, error: "Missing id" });
      const ok = await deleteContextItem(userId, id);
      return res.status(ok ? 200 : 404).json({ ok });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    if (e instanceof ContextError) return res.status(e.status).json({ ok: false, error: e.message });
    console.error("[agent/context] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
