// GET  /api/agent/actions?id=…            → one action (Brand Studio reads its brief)
// POST /api/agent/actions {id, op:"run"}   → run it after the owner confirmed
//        hand-offs return {redirect}; research/calendar return the new chat message
// POST /api/agent/actions {id, op:"dismiss"}
// GET  /api/agent/actions?products=1       → products with photos, for posters
// POST /api/agent/actions {op:"upload", mime, size} → one-time upload for a product photo
// POST /api/agent/actions {id, op:"run", posters:{selected:[i], size, product:{ref}|{uploadPath,name}|null, products?:{[i]: {ref}|{uploadPath,name}|null}}}
//   products = per post (null = brand poster); overrides product
// POST /api/agent/actions {id, op:"poster-update", index, imageUrl, generationId} → keep an edited poster
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { randomUUID } from "crypto";
import { ActionError, dismissAction, getAction, runAction } from "@/lib/agent/actions";
import { CONTEXT_BUCKET, MAX_FILE_BYTES } from "@/lib/agent/context-items";
import { POSTER_SIZES, PosterJobError, productChoices, resolveProduct, startPosterJob, updatePosterItem, type PlannedPost, type PosterSize } from "@/lib/agent/posters";
import { addMessage, updateSession } from "@/lib/agent/store";

export const config = { maxDuration: 300 }; // poster jobs keep running in the background (lib/jobs/background)

const idOf = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  try {
    if (req.method === "GET") {
      if (req.query.products) return res.status(200).json({ ok: true, products: await productChoices(userId) });
      const action = await getAction(userId, idOf(req.query.id));
      return action ? res.status(200).json({ ok: true, action }) : res.status(404).json({ ok: false, error: "Not found" });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    if (req.body?.op === "upload") {
      const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[String(req.body?.mime)];
      const size = Number(req.body?.size);
      if (!ext) return res.status(400).json({ ok: false, error: "Use a PNG, JPG or WEBP photo." });
      if (!(size > 0 && size <= MAX_FILE_BYTES)) return res.status(400).json({ ok: false, error: "Use a photo under 10 MB." });
      const path = `${userId}/posters/${randomUUID()}.${ext}`;
      const { supabaseAdmin } = await import("@/auth/supabase/admin");
      const { data, error } = await supabaseAdmin.storage.from(CONTEXT_BUCKET).createSignedUploadUrl(path);
      if (error || !data) return res.status(500).json({ ok: false, error: "Couldn't start the upload. Please try again." });
      return res.status(200).json({ ok: true, path, token: data.token });
    }
    const id = idOf(req.body?.id);
    if (!id) return res.status(400).json({ ok: false, error: "Missing action" });
    if (req.body?.op === "dismiss") return res.status(200).json({ ok: await dismissAction(userId, id) });
    if (req.body?.op === "poster-update") {
      const index = Number(req.body?.index);
      const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
      const generationId = typeof req.body?.generationId === "string" && req.body.generationId ? req.body.generationId.slice(0, 120) : null;
      if (!Number.isInteger(index) || index < 0 || !imageUrl) return res.status(400).json({ ok: false, error: "Missing poster" });
      const result = await updatePosterItem(userId, id, index, imageUrl, generationId);
      return res.status(200).json({ ok: true, result });
    }
    if (req.body?.op !== "run") return res.status(400).json({ ok: false, error: "Unknown request" });

    const current = await getAction(userId, id);
    if (current?.type === "posters") {
      const opts = (req.body?.posters ?? {}) as Record<string, unknown>;
      const size: PosterSize = (Object.keys(POSTER_SIZES) as PosterSize[]).includes(opts.size as PosterSize) ? (opts.size as PosterSize) : "feed";
      const product = opts.product ? await resolveProduct(userId, opts.product) : null;
      if (opts.product && !product) return res.status(400).json({ ok: false, error: "We couldn't use that product photo. Pick another one." });
      const posts = (current.params.posts ?? []) as PlannedPost[];
      const selected = Array.isArray(opts.selected) ? (opts.selected as unknown[]).map(Number) : posts.map((_, i) => i);
      // Per-post products: each choice is resolved against the owner's own products/uploads.
      let productsByPost: Record<number, Awaited<ReturnType<typeof resolveProduct>>> | undefined;
      if (opts.products && typeof opts.products === "object") {
        productsByPost = {};
        const cache = new Map<string, Awaited<ReturnType<typeof resolveProduct>>>();
        for (const [k, choice] of Object.entries(opts.products as Record<string, unknown>).slice(0, 12)) {
          const i = Number(k);
          if (!Number.isInteger(i) || i < 0 || i >= posts.length) continue;
          if (!choice) { productsByPost[i] = null; continue; }
          const key = JSON.stringify(choice);
          if (!cache.has(key)) cache.set(key, await resolveProduct(userId, choice));
          const resolved = cache.get(key) ?? null;
          if (!resolved) return res.status(400).json({ ok: false, error: `We couldn't use the product photo for post ${i + 1}. Pick another one.` });
          productsByPost[i] = resolved;
        }
      }
      await startPosterJob({ userId, actionId: id, posts, selected, size, product, productsByPost });
      return res.status(200).json({ ok: true, action: await getAction(userId, id) });
    }

    const out = await runAction(userId, id);
    let message: { id: string; role: "assistant"; content: string; used: string[]; createdAt: string } | null = null;
    const sessionId = out.action.sessionId; // from the owner's own action row, never from the request
    if (out.message && sessionId) {
      const messageId = await addMessage(userId, sessionId, { role: "assistant", content: out.message, used: [] });
      await updateSession(userId, sessionId, { touch: true });
      message = { id: messageId, role: "assistant", content: out.message, used: [], createdAt: new Date().toISOString() };
    }
    return res.status(200).json({ ok: true, action: out.action, redirect: out.redirect ?? null, message, text: message ? null : out.message ?? null });
  } catch (e) {
    if (e instanceof ActionError || e instanceof PosterJobError) return res.status(e.status).json({ ok: false, error: e.message });
    console.error("[agent/actions] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
