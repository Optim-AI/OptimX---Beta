// GET    /api/agent/memory           → facts the agent remembers
// POST   /api/agent/memory {fact}    → add one
// PATCH  /api/agent/memory?id= {fact}
// DELETE /api/agent/memory?id=
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { MAX_MEMORIES, addMemory, deleteMemory, listMemories, updateMemory } from "@/lib/agent/memory";

const idOf = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  const id = idOf(req.query.id);
  const fact = typeof req.body?.fact === "string" ? req.body.fact.trim() : "";
  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, memories: await listMemories(userId), max: MAX_MEMORIES });
    if (req.method === "POST") {
      if (!fact) return res.status(400).json({ ok: false, error: "Write the fact first." });
      const memory = await addMemory(userId, fact);
      if (!memory) return res.status(400).json({ ok: false, error: `Your agent can remember up to ${MAX_MEMORIES} facts. Delete some to add more.` });
      return res.status(200).json({ ok: true, memory });
    }
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });
    if (req.method === "PATCH") {
      if (!fact) return res.status(400).json({ ok: false, error: "Write the fact first." });
      const memory = await updateMemory(userId, id, fact);
      return res.status(memory ? 200 : 404).json({ ok: !!memory, memory });
    }
    if (req.method === "DELETE") {
      const ok = await deleteMemory(userId, id);
      return res.status(ok ? 200 : 404).json({ ok });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[agent/memory] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
