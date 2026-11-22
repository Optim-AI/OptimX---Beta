// GET    /api/agent/tasks                       → scheduled tasks
// POST   /api/agent/tasks {title, prompt, cadence, emailMe}
// POST   /api/agent/tasks {id, op:"run"}        → run now (makes a new chat; no credits)
// PATCH  /api/agent/tasks?id=… {title?, prompt?, cadence?, enabled?, emailMe?}
// DELETE /api/agent/tasks?id=…
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { MAX_TASKS, TaskError, createTask, deleteTask, listTasks, runTask, updateTask } from "@/lib/agent/tasks";

export const config = { maxDuration: 120 };

const idOf = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");
const RUN_NOW_GAP_MS = 5 * 60_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, tasks: await listTasks(userId), max: MAX_TASKS });
    if (req.method === "POST") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (body.op === "run") {
        const id = idOf(body.id);
        const task = (await listTasks(userId)).find((t) => t.id === id);
        if (!task) return res.status(404).json({ ok: false, error: "That task no longer exists." });
        if (task.lastRunAt && Date.now() - new Date(task.lastRunAt).getTime() < RUN_NOW_GAP_MS) {
          return res.status(429).json({ ok: false, error: "This task just ran. Open it from Recent chats, or try again in a few minutes." });
        }
        const { sessionId } = await runTask(userId, id, { sendEmail: false });
        return res.status(200).json({ ok: true, sessionId });
      }
      return res.status(200).json({ ok: true, task: await createTask(userId, body) });
    }
    const id = idOf(req.query.id);
    if (!id) return res.status(400).json({ ok: false, error: "Missing task" });
    if (req.method === "PATCH") return res.status(200).json({ ok: true, task: await updateTask(userId, id, (req.body ?? {}) as Record<string, unknown>) });
    if (req.method === "DELETE") {
      const ok = await deleteTask(userId, id);
      return res.status(ok ? 200 : 404).json({ ok });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    if (e instanceof TaskError) return res.status(e.status).json({ ok: false, error: e.message });
    console.error("[agent/tasks] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
