/**
 * The owner's own context for the Marketing Agent: uploaded files, notes and links.
 * Each item is read once when added (Gemini reads PDFs and images directly), and
 * the agent gets a short summary of every item plus the full text of the ones
 * that matter for the current question.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, count } from "drizzle-orm";
import { db } from "@/database/client";
import { agentContextItems } from "@/database/schema";
import { normalizeAuditUrl, safeFetchText } from "@/lib/audit/url-safety";
import { agentJson } from "./gemini-json";
import { iso } from "./store";

export const CONTEXT_BUCKET = "agent-context";
export const MAX_ITEMS = 30;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_NOTE = 8000;
const MAX_TEXT = 12000;
export const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
};

export type ContextItem = {
  id: string;
  kind: "file" | "note" | "link";
  title: string;
  mime: string | null;
  url: string | null;
  summary: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  chars: number;
};

export class ContextError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function admin() {
  return (await import("@/auth/supabase/admin")).supabaseAdmin;
}

const clean = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\u0000/g, "").trim().slice(0, n) : "");

function toItem(r: typeof agentContextItems.$inferSelect): ContextItem {
  return {
    id: r.id, kind: r.kind as ContextItem["kind"], title: r.title, mime: r.mime, url: r.url, summary: r.summary,
    status: r.status, error: r.error, createdAt: iso(r.createdAt), chars: r.extractedText?.length ?? 0,
  };
}

export async function listContextItems(userId: string): Promise<ContextItem[]> {
  const rows = await db.select().from(agentContextItems).where(eq(agentContextItems.userId, userId)).orderBy(desc(agentContextItems.createdAt)).limit(MAX_ITEMS + 10);
  return rows.map(toItem);
}

/** Rows with text, for grounding chat answers. */
export async function contextForChat(userId: string) {
  return db.select({ id: agentContextItems.id, kind: agentContextItems.kind, title: agentContextItems.title, summary: agentContextItems.summary, text: agentContextItems.extractedText })
    .from(agentContextItems)
    .where(and(eq(agentContextItems.userId, userId), eq(agentContextItems.status, "ready")))
    .orderBy(desc(agentContextItems.createdAt)).limit(MAX_ITEMS);
}

async function assertRoom(userId: string) {
  const [row] = await db.select({ n: count() }).from(agentContextItems).where(eq(agentContextItems.userId, userId));
  if (Number(row?.n ?? 0) >= MAX_ITEMS) throw new ContextError(`You can keep up to ${MAX_ITEMS} items. Delete one to add another.`);
}

async function insert(userId: string, v: Partial<typeof agentContextItems.$inferInsert> & { kind: string; title: string }) {
  const [row] = await db.insert(agentContextItems).values({ userId, ...v }).returning();
  return toItem(row);
}

type Reading = { title?: string; summary?: string; content?: string };

const READ_PROMPT = (what: string) => `You are reading ${what} that a small-business owner added so their marketing assistant knows more about their business.
Return JSON: {"title": short name for it (max 60 chars), "summary": 1-2 plain sentences on what it is and why it matters for marketing, "content": the useful information in it as plain text: every product, price, offer, date, claim, customer quote, rule and fact, keeping numbers exact (max 8000 chars)}.
If it is an image, describe what it shows and copy any text in it. Do not invent anything that is not there.`;

export async function addNote(userId: string, titleRaw: unknown, textRaw: unknown): Promise<ContextItem> {
  const text = clean(textRaw, MAX_NOTE);
  if (!text) throw new ContextError("Write something in the note first.");
  await assertRoom(userId);
  const title = clean(titleRaw, 80) || text.split("\n")[0].slice(0, 60);
  return insert(userId, { kind: "note", title, extractedText: text, summary: text.length > 240 ? `${text.slice(0, 240)}…` : text, status: "ready" });
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function addLink(userId: string, rawUrl: unknown): Promise<ContextItem> {
  const check = normalizeAuditUrl(rawUrl);
  if (!check.ok) throw new ContextError("That link doesn't look right. Check it and try again.");
  await assertRoom(userId);
  let pageText = "";
  try {
    const page = await safeFetchText(check.url, {
      timeoutMs: 15_000, maxBytes: 1_500_000,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    });
    pageText = htmlToText(page.body).slice(0, 40_000);
  } catch {
    throw new ContextError("We couldn't open that page. Check the link, or paste the text as a note instead.");
  }
  if (pageText.length < 80) throw new ContextError("That page has almost no text we can read. Paste the important parts as a note instead.");
  const r = await agentJson<Reading>(`${READ_PROMPT("a web page")}\n\nPage URL: ${check.url}\nPage text:\n${pageText}`, { label: "agent-context-link" });
  return insert(userId, {
    kind: "link", url: check.url, title: clean(r.title, 80) || new URL(check.url).hostname,
    summary: clean(r.summary, 400) || null, extractedText: clean(r.content, MAX_TEXT) || pageText.slice(0, MAX_TEXT), status: "ready",
  });
}

/** Step 1 of a file upload: a one-time URL the browser uploads straight to private storage. */
export async function createUpload(userId: string, nameRaw: unknown, mimeRaw: unknown, sizeRaw: unknown) {
  const mime = typeof mimeRaw === "string" ? mimeRaw.toLowerCase() : "";
  const ext = FILE_TYPES[mime];
  if (!ext) throw new ContextError("You can add PDFs, images (PNG, JPG, WEBP) and text files.");
  const size = Number(sizeRaw);
  if (!Number.isFinite(size) || size <= 0) throw new ContextError("That file looks empty.");
  if (size > MAX_FILE_BYTES) throw new ContextError("That file is bigger than 10 MB. Try a smaller one.");
  await assertRoom(userId);
  const path = `${userId}/${randomUUID()}.${ext}`;
  const sb = await admin();
  const { data, error } = await sb.storage.from(CONTEXT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new ContextError("Couldn't start the upload. Please try again.", 500);
  return { path, token: data.token, name: clean(nameRaw, 120) };
}

/** Step 2: read the uploaded file and save it as a context item. */
export async function processUpload(userId: string, pathRaw: unknown, nameRaw: unknown): Promise<ContextItem> {
  const path = typeof pathRaw === "string" ? pathRaw : "";
  if (!path.startsWith(`${userId}/`) || path.includes("..")) throw new ContextError("Upload not found.", 404);
  const ext = path.split(".").pop() || "";
  const mime = Object.entries(FILE_TYPES).find(([, e]) => e === ext)?.[0];
  if (!mime) throw new ContextError("Unsupported file type.");
  const name = clean(nameRaw, 120) || `File.${ext}`;
  const sb = await admin();
  const { data, error } = await sb.storage.from(CONTEXT_BUCKET).download(path);
  if (error || !data) throw new ContextError("Upload not found. Please try again.", 404);
  const buf = Buffer.from(await data.arrayBuffer());
  const removeFile = () => sb.storage.from(CONTEXT_BUCKET).remove([path]).catch(() => {});
  if (buf.length > MAX_FILE_BYTES) { await removeFile(); throw new ContextError("That file is bigger than 10 MB. Try a smaller one."); }

  try {
    let r: Reading;
    if (mime.startsWith("text/")) {
      const text = buf.toString("utf8").slice(0, 60_000);
      r = await agentJson<Reading>(`${READ_PROMPT(`a text file named "${name}"`)}\n\nFile text:\n${text}`, { label: "agent-context-text" });
    } else {
      r = await agentJson<Reading>(READ_PROMPT(`the attached ${mime === "application/pdf" ? "PDF" : "image"} named "${name}"`), {
        file: { mime, base64: buf.toString("base64") }, timeoutMs: 90_000, label: "agent-context-file",
      });
    }
    const content = clean(r.content, MAX_TEXT);
    if (!content) throw new Error("nothing readable");
    return insert(userId, {
      kind: "file", title: name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || clean(r.title, 80), storagePath: path, mime,
      summary: clean(r.summary, 400) || null, extractedText: content, status: "ready",
    });
  } catch (e) {
    await removeFile();
    if (e instanceof ContextError) throw e;
    throw new ContextError("We couldn't read that file. If it's a scanned document, try a clearer copy or paste the key points as a note.");
  }
}

export async function deleteContextItem(userId: string, id: string): Promise<boolean> {
  const [row] = await db.delete(agentContextItems).where(and(eq(agentContextItems.id, id), eq(agentContextItems.userId, userId))).returning();
  if (row?.storagePath) await (await admin()).storage.from(CONTEXT_BUCKET).remove([row.storagePath]).catch(() => {});
  return !!row;
}

/** Signed link to view an uploaded file (5 minutes). */
export async function fileLink(userId: string, id: string): Promise<string | null> {
  const [row] = await db.select().from(agentContextItems).where(and(eq(agentContextItems.id, id), eq(agentContextItems.userId, userId)));
  if (!row?.storagePath) return null;
  const { data } = await (await admin()).storage.from(CONTEXT_BUCKET).createSignedUrl(row.storagePath, 300);
  return data?.signedUrl ?? null;
}
