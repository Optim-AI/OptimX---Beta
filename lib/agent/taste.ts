/**
 * What the owner likes on posters, learned from what they do (not what they say):
 * the headline they pick over the agent's first choice, the changes they ask for
 * when editing a poster, and the preview posters they keep.
 *
 * Stored as normal memories starting with "Poster taste:", so the owner sees them in
 * Memory and can edit or delete them. Only the newest few are kept, and they steer the
 * next post plans and the art brief of the next posters.
 */
import { addMemory, deleteMemory, listMemories, type Memory } from "./memory";

export const TASTE_PREFIX = "Poster taste:";
export const MAX_TASTE = 8;

const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

export const isTaste = (m: Pick<Memory, "fact">) => m.fact.startsWith(TASTE_PREFIX);

export function tasteFromHeadlinePick(options: string[], picked: string): string | null {
  const first = options[0];
  if (!first || !picked || picked === first || !options.includes(picked)) return null;
  return `picked the headline "${clip(picked, 80)}" over "${clip(first, 80)}".`;
}

export function tasteFromEdit(instruction: string): string | null {
  const t = clip(instruction || "", 160);
  return t.length >= 4 ? `asked to change a poster: "${t}".` : null;
}

export function tasteFromKeep(headline: string | null | undefined): string {
  return headline ? `kept the preview poster "${clip(headline, 80)}".` : "kept a preview poster.";
}

/** Save one taste note; keeps only the newest MAX_TASTE and skips exact repeats. Never throws. */
export async function rememberTaste(userId: string, note: string | null, sessionId: string | null = null): Promise<void> {
  if (!note) return;
  try {
    const fact = `${TASTE_PREFIX} the owner ${note}`;
    const all = await listMemories(userId);
    const taste = all.filter(isTaste); // newest first
    if (taste.some((m) => m.fact === fact)) return;
    for (const old of taste.slice(MAX_TASTE - 1)) await deleteMemory(userId, old.id);
    await addMemory(userId, fact, sessionId);
  } catch (err) {
    console.warn("[agent/taste] not saved", { message: (err as Error)?.message?.slice(0, 120) });
  }
}

/** The owner's recent poster taste, for the art brief of the next posters. */
export async function tasteNotes(userId: string): Promise<string[]> {
  const all = await listMemories(userId).catch(() => [] as Memory[]);
  return all.filter(isTaste).slice(0, MAX_TASTE).map((m) => m.fact.slice(TASTE_PREFIX.length).trim());
}
