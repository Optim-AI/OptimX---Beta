/**
 * Scheduled tasks for the Marketing Agent ("every Monday, plan this week's posts").
 * The cron (pages/api/cron/agent-tasks.ts) runs due tasks; each run becomes a chat
 * in Recents marked "Scheduled", and can be emailed. Scheduled runs never spend
 * credits: any action they suggest waits for the owner to press its button.
 * Times are India time (IST, no daylight saving).
 */
import { cleanPost, productChoices, resolveProduct, startPosterJob, type PlannedPost } from "./posters";
import { and, asc, count, eq, lte } from "drizzle-orm";
import { db } from "@/database/client";
import { agentTasks } from "@/database/schema";
import { sendOutboundEmail } from "@/lib/email/send";
import { SITE_ORIGIN } from "@/lib/seo/site";
import { afterTurn } from "./after-turn";
import { buildAgentContext } from "./context";
import { streamReply } from "./stream";
import { addMessage, createSession, iso, updateSession } from "./store";

export const MAX_TASKS = 5;
const IST_MS = 330 * 60_000;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type Cadence = { freq: "weekly"; weekday: number; hour: number } | { freq: "monthly"; monthday: number; hour: number };

export type AgentTask = {
  id: string; title: string; prompt: string; cadence: Cadence; enabled: boolean; emailMe: boolean;
  nextRunAt: string | null; lastRunAt: string | null; lastSessionId: string | null; lastError: string | null;
};

export class TaskError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

export function cleanCadence(raw: any): Cadence | null {
  const hour = int(raw?.hour, 0, 23);
  if (hour === null) return null;
  if (raw?.freq === "weekly") {
    const weekday = int(raw?.weekday, 0, 6);
    return weekday === null ? null : { freq: "weekly", weekday, hour };
  }
  if (raw?.freq === "monthly") {
    const monthday = int(raw?.monthday, 1, 28);
    return monthday === null ? null : { freq: "monthly", monthday, hour };
  }
  return null;
}

/** Next run strictly after `from`, in UTC. */
export function nextRunAfter(c: Cadence, from: Date = new Date()): Date {
  const ist = new Date(from.getTime() + IST_MS); // read UTC fields as IST wall time
  const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, c.hour, 0, 0) - IST_MS);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate();
  if (c.freq === "weekly") {
    let add = (c.weekday - ist.getUTCDay() + 7) % 7;
    let cand = at(y, m, d + add);
    if (cand.getTime() <= from.getTime()) { add += 7; cand = at(y, m, d + add); }
    return cand;
  }
  let cand = at(y, m, c.monthday);
  if (cand.getTime() <= from.getTime()) cand = at(y, m + 1, c.monthday);
  return cand;
}

export function describeCadence(c: Cadence): string {
  const h = c.hour % 12 === 0 ? 12 : c.hour % 12;
  const time = `${h} ${c.hour < 12 ? "AM" : "PM"}`;
  if (c.freq === "weekly") return `Every ${WEEKDAYS[c.weekday]} at ${time}`;
  const sfx = c.monthday === 1 || c.monthday === 21 ? "st" : c.monthday === 2 || c.monthday === 22 ? "nd" : c.monthday === 3 || c.monthday === 23 ? "rd" : "th";
  return `Every month on the ${c.monthday}${sfx} at ${time}`;
}

const toTask = (r: typeof agentTasks.$inferSelect): AgentTask => ({
  id: r.id, title: r.title, prompt: r.prompt, cadence: r.cadence as Cadence, enabled: r.enabled, emailMe: r.emailMe,
  nextRunAt: r.nextRunAt ? iso(r.nextRunAt) : null, lastRunAt: r.lastRunAt ? iso(r.lastRunAt) : null, lastSessionId: r.lastSessionId, lastError: r.lastError,
});

export async function listTasks(userId: string): Promise<AgentTask[]> {
  const rows = await db.select().from(agentTasks).where(eq(agentTasks.userId, userId)).orderBy(asc(agentTasks.createdAt));
  return rows.map(toTask);
}

async function getTaskRow(userId: string, id: string) {
  const [row] = await db.select().from(agentTasks).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId)));
  return row ?? null;
}

const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function createTask(userId: string, body: Record<string, unknown>): Promise<AgentTask> {
  const title = text(body.title, 80);
  const prompt = text(body.prompt, 2000);
  const cadence = cleanCadence(body.cadence);
  if (!title || !prompt) throw new TaskError("Give the task a name and say what your agent should do.");
  if (!cadence) throw new TaskError("Pick when it should run.");
  const [row] = await db.select({ n: count() }).from(agentTasks).where(eq(agentTasks.userId, userId));
  if (Number(row?.n ?? 0) >= MAX_TASKS) throw new TaskError(`You can have up to ${MAX_TASKS} scheduled tasks. Delete one to add another.`);
  const [created] = await db.insert(agentTasks).values({
    userId, title, prompt, cadence, emailMe: body.emailMe === true, enabled: true, nextRunAt: nextRunAfter(cadence).toISOString(),
  }).returning();
  return toTask(created);
}

export async function updateTask(userId: string, id: string, body: Record<string, unknown>): Promise<AgentTask> {
  const row = await getTaskRow(userId, id);
  if (!row) throw new TaskError("That task no longer exists.", 404);
  const set: Partial<typeof agentTasks.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) { const t = text(body.title, 80); if (!t) throw new TaskError("Give the task a name."); set.title = t; }
  if (body.prompt !== undefined) { const p = text(body.prompt, 2000); if (!p) throw new TaskError("Say what your agent should do."); set.prompt = p; }
  if (typeof body.emailMe === "boolean") set.emailMe = body.emailMe;
  let cadence = row.cadence as Cadence;
  if (body.cadence !== undefined) {
    const c = cleanCadence(body.cadence);
    if (!c) throw new TaskError("Pick when it should run.");
    set.cadence = cadence = c;
  }
  if (typeof body.enabled === "boolean") set.enabled = body.enabled;
  if (set.cadence || set.enabled === true) set.nextRunAt = nextRunAfter(cadence).toISOString();
  const [updated] = await db.update(agentTasks).set(set).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId))).returning();
  return toTask(updated);
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(agentTasks).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId))).returning({ id: agentTasks.id });
  return rows.length > 0;
}

async function ownerEmail(userId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/auth/supabase/admin");
    return (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email ?? null;
  } catch {
    return null;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function emailResult(userId: string, title: string, reply: string, sessionId: string) {
  const to = await ownerEmail(userId);
  if (!to || !process.env.RESEND_API_KEY?.trim()) return;
  const link = `${SITE_ORIGIN}/marketing-agent/${sessionId}`;
  const preview = reply.replace(/[*#|_`]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 900);
  await sendOutboundEmail({
    to,
    subject: `${title}: your marketing agent's update`,
    text: `${preview}${reply.length > 900 ? "…" : ""}\n\nRead the full answer: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:600px">
<p style="color:#555;margin:0 0 12px">Your scheduled task <b>${escapeHtml(title)}</b> has run.</p>
<div style="white-space:pre-wrap">${escapeHtml(preview)}${reply.length > 900 ? "…" : ""}</div>
<p style="margin:20px 0"><a href="${link}" style="background:#1a73e8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open in SkalX</a></p>
<p style="color:#888;font-size:12px">You can turn these emails off in Marketing Agent → Scheduled.</p></div>`,
  }).catch((e) => console.warn("[agent/tasks] email failed", { message: (e as Error)?.message?.slice(0, 120) }));
}

/** Run one task now: new "Scheduled" chat with the agent's answer. Never spends credits. */
export async function runTask(userId: string, taskId: string, opts: { sendEmail?: boolean } = {}): Promise<{ sessionId: string }> {
  const row = await getTaskRow(userId, taskId);
  if (!row) throw new TaskError("That task no longer exists.", 404);
  const day = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const session = await createSession(userId, `${row.title} · ${day}`, { source: "schedule", taskId: row.id });
  try {
    const prompt = `(Scheduled task "${row.title}", ${describeCadence(row.cadence as Cadence).replace(/^Every/, "every")}.) ${row.prompt}`;
    await addMessage(userId, session.id, { role: "user", content: row.prompt });
    const ctx = await buildAgentContext(userId, row.prompt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 100_000);
    let reply = "";
    let model = "";
    try {
      const gen = streamReply(ctx.system, [{ role: "user", content: prompt }], ctrl.signal);
      for (;;) {
        const next = await gen.next();
        if (next.done) { model = next.value.model; break; }
        reply += next.value;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!reply.trim()) throw new Error("empty reply");
    const messageId = await addMessage(userId, session.id, { role: "assistant", content: reply, used: ctx.used, model });
    const turn = await afterTurn({ userId, sessionId: session.id, messageId, ownerMessage: row.prompt, reply, memories: [], learn: false }).catch(() => null);
    // Weekly check-in: when the reply is a post plan, make up to 3 free preview posters right away.
    // The owner keeps the ones they like for 1 credit each (the rest cost nothing).
    const plan = turn?.actions.find((a) => a.type === "posters");
    if (plan) await startPreviewPosters(userId, plan).catch((err) => console.warn("[agent/tasks] previews skipped", { message: (err as Error)?.message?.slice(0, 120) }));
    await updateSession(userId, session.id, { touch: true, unread: true });
    await db.update(agentTasks).set({ lastRunAt: new Date().toISOString(), lastSessionId: session.id, lastError: null }).where(eq(agentTasks.id, row.id));
    if (opts.sendEmail ?? row.emailMe) await emailResult(userId, row.title, reply, session.id);
    return { sessionId: session.id };
  } catch (e) {
    await addMessage(userId, session.id, { role: "assistant", content: "Sorry, this scheduled task couldn't finish this time. It will try again at the next scheduled time, or you can press Run now." }).catch(() => {});
    await db.update(agentTasks).set({ lastRunAt: new Date().toISOString(), lastSessionId: session.id, lastError: "Couldn't finish" }).where(eq(agentTasks.id, row.id));
    throw e;
  }
}

/** Cron: claim due tasks one by one (moving next_run_at first, so a task never runs twice) and run them. */
export async function runDueTasks(budgetMs = 240_000): Promise<{ due: number; ran: number; failed: number }> {
  const started = Date.now();
  const now = new Date();
  const due = await db.select().from(agentTasks)
    .where(and(eq(agentTasks.enabled, true), lte(agentTasks.nextRunAt, now.toISOString())))
    .orderBy(asc(agentTasks.nextRunAt)).limit(10);
  let ran = 0, failed = 0;
  for (const t of due) {
    if (Date.now() - started > budgetMs) break;
    const next = nextRunAfter(t.cadence as Cadence, now).toISOString();
    const claimed = await db.update(agentTasks).set({ nextRunAt: next })
      .where(and(eq(agentTasks.id, t.id), eq(agentTasks.nextRunAt, t.nextRunAt!))).returning({ id: agentTasks.id });
    if (!claimed.length) continue;
    try {
      await runTask(t.userId, t.id);
      ran++;
    } catch (e) {
      failed++;
      console.error("[agent/tasks] run failed", { taskId: t.id, message: (e as Error)?.message?.slice(0, 160) });
    }
  }
  return { due: due.length, ran, failed };
}

/** Previews for a planned set of posts: each product post gets its named product (if found). */
async function startPreviewPosters(userId: string, plan: { id: string; params: Record<string, unknown> }) {
  const posts = ((plan.params.posts ?? []) as unknown[]).map(cleanPost).filter((p): p is PlannedPost => !!p);
  if (!posts.length) return;
  const choices = await productChoices(userId).catch(() => [] as Awaited<ReturnType<typeof productChoices>>);
  const productsByPost: Record<number, Awaited<ReturnType<typeof resolveProduct>>> = {};
  for (const [i, p] of posts.entries()) {
    const want = p.product.toLowerCase();
    const match = p.scope === "product" && want ? choices.find((c) => c.name.toLowerCase() === want) : undefined;
    productsByPost[i] = match ? await resolveProduct(userId, { ref: match.id }) : null;
  }
  await startPosterJob({
    userId, actionId: plan.id, posts, selected: posts.map((_, i) => i), size: "feed", product: null, productsByPost, preview: true,
  });
}
