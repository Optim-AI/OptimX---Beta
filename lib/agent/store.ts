/**
 * Marketing Agent storage: settings (instructions), sessions and messages.
 * Server-only. Every query is scoped to the signed-in user.
 */
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/database/client";
import { agentMessages, agentSessions, agentSettings } from "@/database/schema";

/** Postgres returns "2026-11-23 03:30:00+00", which Safari can't parse; send real ISO strings. */
export function iso(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

export const MAX_INSTRUCTIONS = 4000;
export const MAX_TAGLINE = 140;
/** Free chat, capped per user per day (messages the owner sends). */
export const DAILY_MESSAGE_CAP = 60;

export type AgentSettings = { instructions: string; tagline: string | null };
export type AgentSession = { id: string; title: string; source: string; unread: boolean; createdAt: string; updatedAt: string };
export type AgentMessage = { id: string; role: "user" | "assistant"; content: string; used: string[]; createdAt: string };

export async function getSettings(userId: string): Promise<AgentSettings> {
  const [row] = await db.select().from(agentSettings).where(eq(agentSettings.userId, userId));
  return { instructions: row?.instructions ?? "", tagline: row?.tagline ?? null };
}

export async function saveSettings(userId: string, patch: Partial<AgentSettings>): Promise<AgentSettings> {
  const values: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof patch.instructions === "string") values.instructions = patch.instructions.slice(0, MAX_INSTRUCTIONS);
  if (patch.tagline !== undefined) values.tagline = patch.tagline ? patch.tagline.slice(0, MAX_TAGLINE) : null;
  await db
    .insert(agentSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: agentSettings.userId, set: values });
  return getSettings(userId);
}

const toSession = (r: typeof agentSessions.$inferSelect): AgentSession => ({
  id: r.id, title: r.title, source: r.source, unread: r.unread, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt),
});

export async function listSessions(userId: string, limit = 50): Promise<AgentSession[]> {
  const rows = await db.select().from(agentSessions).where(eq(agentSessions.userId, userId))
    .orderBy(desc(agentSessions.updatedAt)).limit(limit);
  return rows.map(toSession);
}

export async function getSession(userId: string, id: string): Promise<AgentSession | null> {
  const [row] = await db.select().from(agentSessions).where(and(eq(agentSessions.id, id), eq(agentSessions.userId, userId)));
  return row ? toSession(row) : null;
}

export async function createSession(userId: string, title: string, opts: { source?: "chat" | "schedule"; taskId?: string | null; brandKitId?: string | null } = {}): Promise<AgentSession> {
  const [row] = await db.insert(agentSessions).values({
    userId, title: title.slice(0, 120) || "New chat", source: opts.source ?? "chat", taskId: opts.taskId ?? null,
    brandKitId: opts.brandKitId ?? null, unread: opts.source === "schedule",
  }).returning();
  return toSession(row);
}

export async function updateSession(userId: string, id: string, patch: { title?: string; unread?: boolean; touch?: boolean }): Promise<boolean> {
  const set: Record<string, unknown> = {};
  if (typeof patch.title === "string" && patch.title.trim()) set.title = patch.title.trim().slice(0, 120);
  if (typeof patch.unread === "boolean") set.unread = patch.unread;
  if (patch.touch) set.updatedAt = new Date().toISOString();
  if (!Object.keys(set).length) return true;
  const rows = await db.update(agentSessions).set(set).where(and(eq(agentSessions.id, id), eq(agentSessions.userId, userId))).returning({ id: agentSessions.id });
  return rows.length > 0;
}

export async function deleteSession(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(agentSessions).where(and(eq(agentSessions.id, id), eq(agentSessions.userId, userId))).returning({ id: agentSessions.id });
  return rows.length > 0;
}

export async function listMessages(sessionId: string, limit = 200): Promise<AgentMessage[]> {
  const rows = await db.select().from(agentMessages).where(eq(agentMessages.sessionId, sessionId))
    .orderBy(asc(agentMessages.createdAt)).limit(limit);
  return rows.map((r) => ({
    id: r.id, role: r.role === "assistant" ? "assistant" : "user", content: r.content,
    used: Array.isArray(r.used) ? (r.used as string[]) : [], createdAt: iso(r.createdAt),
  }));
}

export async function addMessage(userId: string, sessionId: string, msg: { role: "user" | "assistant"; content: string; used?: string[]; model?: string | null }): Promise<string> {
  const [row] = await db.insert(agentMessages).values({
    userId, sessionId, role: msg.role, content: msg.content, used: msg.used ?? [], model: msg.model ?? null,
  }).returning({ id: agentMessages.id });
  return row.id;
}

/** Messages the owner sent in the last 24 hours (for the free daily cap). */
export async function messagesSentToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [row] = await db.select({ n: count() }).from(agentMessages)
    .where(and(eq(agentMessages.userId, userId), eq(agentMessages.role, "user"), gte(agentMessages.createdAt, since)));
  return Number(row?.n ?? 0);
}

/** Free live web lookups per user per day (each answer that used Google search). */
export const DAILY_WEB_LOOKUPS = 20;

export async function webLookupsToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [row] = await db.select({ n: count() }).from(agentMessages)
    .where(and(eq(agentMessages.userId, userId), eq(agentMessages.role, "assistant"), gte(agentMessages.createdAt, since), sql`${agentMessages.used} @> '["Web search"]'::jsonb`));
  return Number(row?.n ?? 0);
}

/** Questions that need fresh or factual numbers from the web (market size, prices, trends, news…). */
export function wantsWebFacts(message: string): boolean {
  return /\b(how (big|many|much)|market size|statistic|stats|data on|percentage|percent|%|growth rate|trend|trending|latest|news|this year|20\d\d|price of|prices of|how much do|average (price|cost)|cost of|competitor|who sells|top brands|benchmark|cpc|cpm|ctr|roas|survey|report on|population|demand for|search volume|charge for|charging|sell for|market share)/i.test(message);
}
