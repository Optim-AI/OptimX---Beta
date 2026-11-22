/**
 * What the Marketing Agent remembers: short facts about the business and the
 * owner's preferences. Picked from the owner's own messages after each reply;
 * the owner can view, edit and delete every one.
 */
import { and, desc, eq, count } from "drizzle-orm";
import { db } from "@/database/client";
import { agentMemories } from "@/database/schema";
import { iso } from "./store";

export const MAX_MEMORIES = 100;
export const MAX_FACT = 300;

export type Memory = { id: string; fact: string; sourceSessionId: string | null; createdAt: string; updatedAt: string };

const toMemory = (r: typeof agentMemories.$inferSelect): Memory => ({
  id: r.id, fact: r.fact, sourceSessionId: r.sourceSessionId, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt),
});

export async function listMemories(userId: string, limit = MAX_MEMORIES): Promise<Memory[]> {
  const rows = await db.select().from(agentMemories).where(eq(agentMemories.userId, userId)).orderBy(desc(agentMemories.createdAt)).limit(limit);
  return rows.map(toMemory);
}

export async function memoryCount(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(agentMemories).where(eq(agentMemories.userId, userId));
  return Number(row?.n ?? 0);
}

export async function addMemory(userId: string, fact: string, sourceSessionId: string | null = null): Promise<Memory | null> {
  const f = fact.replace(/\s+/g, " ").trim().slice(0, MAX_FACT);
  if (!f) return null;
  if ((await memoryCount(userId)) >= MAX_MEMORIES) return null;
  const [row] = await db.insert(agentMemories).values({ userId, fact: f, sourceSessionId }).returning();
  return toMemory(row);
}

export async function updateMemory(userId: string, id: string, fact: string): Promise<Memory | null> {
  const f = fact.replace(/\s+/g, " ").trim().slice(0, MAX_FACT);
  if (!f) return null;
  const [row] = await db.update(agentMemories).set({ fact: f, updatedAt: new Date().toISOString() })
    .where(and(eq(agentMemories.id, id), eq(agentMemories.userId, userId))).returning();
  return row ? toMemory(row) : null;
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(agentMemories).where(and(eq(agentMemories.id, id), eq(agentMemories.userId, userId))).returning({ id: agentMemories.id });
  return rows.length > 0;
}
