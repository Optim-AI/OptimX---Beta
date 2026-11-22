// GET    /api/agent/sessions            → recent chats
// GET    /api/agent/sessions?id=…       → one chat with its messages (marks it read)
// PATCH  /api/agent/sessions?id=…  {title}
// DELETE /api/agent/sessions?id=…
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { actionsForSession } from "@/lib/agent/actions";
import { deleteSession, getSession, listMessages, listSessions, updateSession } from "@/lib/agent/store";

const idOf = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  const id = idOf(req.query.id);

  try {
    if (req.method === "GET") {
      if (!id) return res.status(200).json({ ok: true, sessions: await listSessions(userId) });
      const session = await getSession(userId, id);
      if (!session) return res.status(404).json({ ok: false, error: "That chat no longer exists." });
      if (session.unread) await updateSession(userId, id, { unread: false });
      const [messages, actions] = await Promise.all([listMessages(id), actionsForSession(userId, id)]);
      return res.status(200).json({ ok: true, session: { ...session, unread: false }, messages, actions });
    }
    if (!id) return res.status(400).json({ ok: false, error: "Missing chat id" });
    if (req.method === "PATCH") {
      const title = typeof req.body?.title === "string" ? req.body.title : "";
      if (!title.trim()) return res.status(400).json({ ok: false, error: "Give the chat a name." });
      const ok = await updateSession(userId, id, { title });
      return res.status(ok ? 200 : 404).json({ ok });
    }
    if (req.method === "DELETE") {
      const ok = await deleteSession(userId, id);
      return res.status(ok ? 200 : 404).json({ ok });
    }
    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[agent/sessions] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
