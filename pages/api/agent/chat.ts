// POST /api/agent/chat  { sessionId?, message } → server-sent events
//   {type:"session", session}   when a new chat was created
//   {type:"delta", text}        reply text as it is written
//   {type:"done", messageId, used}
//   {type:"error", message}
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { buildAgentContext } from "@/lib/agent/context";
import { listMemories } from "@/lib/agent/memory";
import { afterTurn } from "@/lib/agent/after-turn";
import { streamReply, titleFrom, type ChatTurn } from "@/lib/agent/stream";
import {
  DAILY_MESSAGE_CAP, DAILY_WEB_LOOKUPS, addMessage, createSession, getSession, listMessages, messagesSentToday, updateSession, wantsWebFacts, webLookupsToday,
} from "@/lib/agent/store";

export const config = { maxDuration: 120 };

const MAX_MESSAGE = 6000;
const HISTORY_TURNS = 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!message) return res.status(400).json({ ok: false, error: "Type a message first." });

  if ((await messagesSentToday(userId)) >= DAILY_MESSAGE_CAP) {
    return res.status(429).json({ ok: false, error: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. It resets over the next 24 hours.` });
  }

  let session = typeof body.sessionId === "string" && body.sessionId ? await getSession(userId, body.sessionId) : null;
  if (body.sessionId && !session) return res.status(404).json({ ok: false, error: "That chat no longer exists." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const abort = new AbortController();
  res.on("close", () => abort.abort());
  const timeout = setTimeout(() => abort.abort(), 110_000);

  let reply = "";
  try {
    if (!session) {
      session = await createSession(userId, titleFrom(message));
      send({ type: "session", session });
    }
    const history = (await listMessages(session.id)).slice(-HISTORY_TURNS);
    await addMessage(userId, session.id, { role: "user", content: message });

    const ctx = await buildAgentContext(userId, message);
    const turns: ChatTurn[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }];

    // Live Google search only when the question needs fresh facts, within the free daily cap.
    const search = wantsWebFacts(message) && (await webLookupsToday(userId).catch(() => DAILY_WEB_LOOKUPS)) < DAILY_WEB_LOOKUPS;
    const system = search
      ? `${ctx.system}\n\n## Web search\nYou can search Google for this answer. Use it for current facts, prices and numbers; say which figures come from the web, and never present a guess as a fact.`
      : ctx.system;
    const gen = streamReply(system, turns, abort.signal, { search });
    let model = "";
    let sources: { title: string; url: string }[] = [];
    for (;;) {
      const next = await gen.next();
      if (next.done) { model = next.value.model; sources = next.value.sources; break; }
      reply += next.value;
      send({ type: "delta", text: next.value });
    }
    if (sources.length) {
      const list = sources.slice(0, 5).map((s) => `[${s.title.replace(/[[\]]/g, "")}](${s.url})`).join(" · ");
      const footer = `\n\n_Sources:_ ${list}`;
      reply += footer;
      send({ type: "delta", text: footer });
      ctx.used.push("Web search");
    }
    if (!reply.trim()) throw new Error("empty reply");
    const messageId = await addMessage(userId, session.id, { role: "assistant", content: reply, used: ctx.used, model });
    await updateSession(userId, session.id, { touch: true });
    send({ type: "done", messageId, used: ctx.used });
    // Remember lasting facts the owner told us (shown with Undo) and offer next-step buttons.
    try {
      const { learned, actions, next } = await afterTurn({ userId, sessionId: session.id, messageId, ownerMessage: message, reply, memories: await listMemories(userId) });
      if (learned.length) send({ type: "memory", items: learned.map((m) => ({ id: m.id, fact: m.fact })) });
      if (actions.length) send({ type: "actions", items: actions });
      else if (next) send({ type: "next", text: next });
    } catch (e) {
      console.warn("[agent/chat] after-turn skipped", { message: (e as Error)?.message?.slice(0, 120) });
    }
  } catch (e) {
    const err = e as Error;
    console.error("[agent/chat] failed", { userId, message: err?.message?.slice(0, 200) });
    if (session && reply.trim()) {
      await addMessage(userId, session.id, { role: "assistant", content: `${reply}\n\n_(This reply was cut short.)_` }).catch(() => {});
      await updateSession(userId, session.id, { touch: true }).catch(() => {});
    }
    if (!abort.signal.aborted || reply) {
      send({ type: "error", message: "Sorry, I couldn't finish that reply. Please try again." });
    }
  } finally {
    clearTimeout(timeout);
    res.end();
  }
}
