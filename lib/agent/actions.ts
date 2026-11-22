/**
 * Actions the Marketing Agent can offer after a reply. Nothing runs by itself:
 * each is saved as "proposed" and shown as a card with its credit cost; it only
 * runs when the owner presses the button.
 *
 *   brand_posters   → opens Brand Studio with the brief filled in (credits are charged there, 1 per poster)
 *   ad_pack         → opens Ad Studio's poster flow with product, goal and idea filled in (8 free drafts, 1 credit per kept poster)
 *   research        → runs Product & region research here (free), saves the report, summarises it in the chat
 *   calendar        → drafts a content calendar here (free)
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/database/client";
import { agentActions } from "@/database/schema";
import { AD_GOAL_KEYS, type AdGoal } from "@/lib/ad-studio/options";
import { POSTER_AD_GOALS } from "@/lib/creative-studio/poster-generation/types";

const POSTER_AD_GOAL_LIST = POSTER_AD_GOALS.join("|");
import { getUserBrand } from "@/lib/brand-kit/server";
import { researchDigest } from "@/lib/research/brand-research";
import { researchFocused, type FocusedResearch } from "@/lib/research/focused-research";
import { CITIES, STATES, resolveRegions } from "@/lib/research/regions";
import { getBrandResearch, saveFocusedResearch } from "@/lib/research/store";
import { buildAgentContext } from "./context";
import { MAX_POSTS, cleanPost, settleStale, type PosterJobResult } from "./posters";
import { agentJson } from "./gemini-json";

/** "brand_posters" and "ad_pack" were studio hand-offs; kept only so older chats still render. */
export const ACTION_TYPES = ["posters", "research", "calendar", "brand_posters", "ad_pack"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type ActionParams = {
  brand_posters: { brief: string; count: number };
  ad_pack: { product: string; goal: AdGoal; offer: string; idea: string };
  research: { product: string; regions: string[] };
  calendar: { weeks: number; focus: string };
};

export type AgentAction = {
  id: string;
  sessionId: string | null;
  messageId: string | null;
  type: ActionType;
  title: string;
  params: Record<string, unknown>;
  costCredits: number;
  costNote: string;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  updatedAt: string;
};

export class ActionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

const REGION_NAMES = [...STATES, ...CITIES].map((r) => ({ id: r.id, name: r.name.toLowerCase() }));
function regionIds(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const ids: string[] = [];
  for (const n of names) {
    const key = String(n).toLowerCase().trim();
    const hit = REGION_NAMES.find((r) => r.name === key || r.id === key);
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids.slice(0, 6);
}

/** Validate and normalise what the model proposed. Returns null when unusable. */
export function cleanProposal(raw: any): { type: ActionType; title: string; params: Record<string, unknown> } | null {
  const type = raw?.type as ActionType;
  if (!ACTION_TYPES.includes(type)) return null;
  const p = raw?.params ?? {};
  const title = str(raw?.title, 80);
  if (type === "posters") {
    const posts = (Array.isArray(p.posts) ? p.posts : []).map(cleanPost).filter(Boolean).slice(0, MAX_POSTS);
    if (!posts.length) return null;
    return { type, title: title || (posts.length > 1 ? `Make posters for these ${posts.length} posts` : "Make this poster"), params: { posts } };
  }
  // Older proposal shapes become in-chat posters too: nothing leaves the chat.
  if (type === "brand_posters" || type === "ad_pack") {
    const idea = str(p.brief ?? p.idea, 300) || str(p.product, 120);
    if (!idea) return null;
    const post = cleanPost({ idea, headline: str(p.offer, 120), goal: p.goal === "festive" ? "festive" : p.offer ? "offer" : "feature" });
    return post ? { type: "posters", title: title || "Make this poster", params: { posts: [post] } } : null;
  }
  if (type === "research") {
    const product = str(p.product, 120);
    const regions = regionIds(p.regions);
    if (!product && !regions.length) return null;
    const regionNames = regions.map((id) => [...STATES, ...CITIES].find((r) => r.id === id)?.name ?? id);
    return { type, title: title || "Run Product & region research", params: { product, regions, regionNames } };
  }
  return { type, title: title || "Draft a content calendar", params: { weeks: clampInt(p.weeks, 1, 4, 2), focus: str(p.focus, 300) } };
}

export function costOf(type: ActionType, params: Record<string, unknown>): { credits: number; note: string } {
  if (type === "posters") {
    const n = Array.isArray(params.posts) ? params.posts.length : 1;
    return { credits: n, note: "1 image credit for each poster that comes out right. Posters that fail are free." };
  }
  if (type === "brand_posters") {
    const n = Number(params.count) || 1;
    return { credits: n, note: `About ${n} image credit${n > 1 ? "s" : ""} (1 per poster). Charged in Brand Studio only when you press Generate.` };
  }
  if (type === "ad_pack") return { credits: 0, note: "8 draft posters free. 1 image credit for each poster you keep. You need at least 1 credit to start." };
  if (type === "research") return { credits: 0, note: "Free. Takes about 1–2 minutes." };
  return { credits: 0, note: "Free." };
}

const toAction = (r: typeof agentActions.$inferSelect): AgentAction => {
  const type = r.type as ActionType;
  const params = (r.params ?? {}) as Record<string, unknown>;
  const a: AgentAction = {
    id: r.id, sessionId: r.sessionId, messageId: r.messageId, type, title: String(params.title ?? ""), params, costCredits: r.costCredits,
    costNote: costOf(type, params).note, status: r.status, result: (r.result as Record<string, unknown>) ?? null, error: r.error,
    updatedAt: r.updatedAt,
  };
  if (type === "posters" && r.status === "running") {
    const settled = settleStale(r.result as PosterJobResult | null, r.updatedAt);
    if (settled?.finishedAt) {
      a.result = settled as unknown as Record<string, unknown>;
      a.status = settled.items.some((i) => i.status === "done") ? "done" : "failed";
    }
  }
  return a;
};

export async function saveProposals(userId: string, sessionId: string, messageId: string, proposals: ReturnType<typeof cleanProposal>[]): Promise<AgentAction[]> {
  const rows = proposals.filter(Boolean).slice(0, 2).map((p) => ({
    userId, sessionId, messageId, type: p!.type, params: { ...p!.params, title: p!.title },
    costCredits: costOf(p!.type, p!.params).credits, status: "proposed",
  }));
  if (!rows.length) return [];
  const inserted = await db.insert(agentActions).values(rows).returning();
  return inserted.map(toAction);
}

export async function actionsForSession(userId: string, sessionId: string): Promise<AgentAction[]> {
  const rows = await db.select().from(agentActions)
    .where(and(eq(agentActions.userId, userId), eq(agentActions.sessionId, sessionId))).orderBy(asc(agentActions.createdAt));
  return rows.map(toAction);
}

export async function getAction(userId: string, id: string): Promise<AgentAction | null> {
  const [row] = await db.select().from(agentActions).where(and(eq(agentActions.id, id), eq(agentActions.userId, userId)));
  return row ? toAction(row) : null;
}

async function setStatus(id: string, status: string, extra: { result?: unknown; error?: string | null } = {}) {
  await db.update(agentActions).set({ status, updatedAt: new Date().toISOString(), ...(extra.result !== undefined ? { result: extra.result } : {}), ...(extra.error !== undefined ? { error: extra.error } : {}) })
    .where(eq(agentActions.id, id));
}

/** Claim a proposed action exactly once (stops double clicks running it twice). */
async function claim(userId: string, id: string, to: string): Promise<boolean> {
  const rows = await db.update(agentActions).set({ status: to, updatedAt: new Date().toISOString() })
    .where(and(eq(agentActions.id, id), eq(agentActions.userId, userId), inArray(agentActions.status, ["proposed", "failed"])))
    .returning({ id: agentActions.id });
  return rows.length > 0;
}

export async function dismissAction(userId: string, id: string): Promise<boolean> {
  const rows = await db.update(agentActions).set({ status: "dismissed", updatedAt: new Date().toISOString() })
    .where(and(eq(agentActions.id, id), eq(agentActions.userId, userId), eq(agentActions.status, "proposed"))).returning({ id: agentActions.id });
  return rows.length > 0;
}

export type RunOutcome = { action: AgentAction; redirect?: string; message?: string };

function adStudioUrl(p: Record<string, unknown>) {
  const q = new URLSearchParams();
  if (p.product) q.set("product", String(p.product));
  if (p.goal) q.set("goal", String(p.goal));
  if (p.offer) q.set("offer", String(p.offer));
  if (p.idea) q.set("idea", String(p.idea));
  return `/content-studio/posters/new?${q.toString()}`;
}


async function runResearch(userId: string, p: Record<string, unknown>): Promise<FocusedResearch> {
  const { kit, snapshot } = await getUserBrand(userId);
  const brandName = kit?.name || (snapshot as any)?.brand_name || (snapshot as any)?.name || "";
  if (!brandName) throw new ActionError("Set up your Brand Kit first so research knows which brand this is for.");
  const website = kit?.websiteUrl || (snapshot as any)?.website_url || null;
  const brandResearch = await getBrandResearch(userId, website).catch(() => null);
  const productName = str(p.product, 120);
  const report = await researchFocused({
    brand: {
      name: brandName,
      description: kit?.identity.description || kit?.identity.offering || "",
      category: kit?.identity.productCategory || kit?.identity.industry || "",
      website,
      digest: brandResearch ? researchDigest(brandResearch, 1500) : "",
    },
    product: productName ? { name: productName, url: null, details: null, price: null } : null,
    regions: resolveRegions(p.regions),
  });
  await saveFocusedResearch(userId, report);
  return report;
}

type CalendarRow = { date?: string; day?: string; platform?: string; format?: string; idea?: string; hook?: string };

async function runCalendar(userId: string, p: Record<string, unknown>): Promise<string> {
  const weeks = clampInt(p.weeks, 1, 4, 2);
  const ctx = await buildAgentContext(userId, String(p.focus ?? ""));
  const start = new Date(Date.now() + 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const out = await agentJson<{ intro?: string; rows?: CalendarRow[]; tip?: string }>(
    `${ctx.system}

Task: draft a ${weeks}-week social media content calendar starting ${start} (dates in YYYY-MM-DD, India). ${p.focus ? `Focus: ${p.focus}.` : ""}
Plan 3–4 posts a week across the channels this brand would really use (Instagram feed, Reels, Stories, WhatsApp Status, Facebook). Use real festivals or occasions in these dates when they fit. Every idea must be specific to this brand and follow the owner's instructions.
Return JSON {"intro": one sentence, "rows": [{"date","day" (Mon/Tue…),"platform","format","idea" (one line),"hook" (caption opening line)}], "tip": one practical tip}.`,
    { timeoutMs: 90_000, label: "agent-calendar" }
  );
  const rows = (Array.isArray(out?.rows) ? out.rows : []).slice(0, 20);
  if (!rows.length) throw new Error("empty calendar");
  const cell = (v: unknown) => str(v, 160).replace(/\|/g, "/");
  const when = (r: CalendarRow) => {
    const d = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? new Date(`${r.date}T12:00:00+05:30`) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })
      : `${cell(r.day)} ${cell(r.date)}`.trim();
  };
  const table = [
    "| Date | Platform | Post idea | Caption hook |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${when(r)} | ${cell(r.platform)}${r.format ? ` (${cell(r.format)})` : ""} | ${cell(r.idea)} | ${cell(r.hook)} |`),
  ].join("\n");
  return [`**Your ${weeks}-week content calendar**`, "", str(out.intro, 300), "", table, out.tip ? `\n**Tip:** ${str(out.tip, 300)}` : ""].join("\n").trim();
}

/** Run a confirmed action. Hand-offs return a link; in-chat actions return a new message. */
export async function runAction(userId: string, id: string): Promise<RunOutcome> {
  const action = await getAction(userId, id);
  if (!action) throw new ActionError("That action no longer exists.", 404);
  if (action.status === "done" && action.result?.redirect) return { action, redirect: String(action.result.redirect) };
  if (action.status === "dismissed") throw new ActionError("You dismissed this one. Ask your agent again if you'd like it.");
  if (action.status === "running" || action.status === "confirmed") throw new ActionError("This is already running.", 409);

  if (action.type === "posters") throw new ActionError("Choose the posts and size first.", 400);
  if (action.type === "brand_posters" || action.type === "ad_pack") {
    if (!(await claim(userId, id, "done"))) throw new ActionError("This is already running.", 409);
    const redirect = action.type === "ad_pack" ? adStudioUrl(action.params) : `/brand-studio?agentAction=${id}`;
    await setStatus(id, "done", { result: { redirect }, error: null });
    return { action: { ...action, status: "done", result: { redirect } }, redirect };
  }

  if (!(await claim(userId, id, "running"))) throw new ActionError("This is already running.", 409);
  try {
    if (action.type === "research") {
      // The report itself is shown as a card under this message (no extra chat message).
      const report = await runResearch(userId, action.params);
      const result = { report } as unknown as Record<string, unknown>;
      await setStatus(id, "done", { result, error: null });
      return { action: { ...action, status: "done", result } };
    }
    const message = await runCalendar(userId, action.params);
    await setStatus(id, "done", { result: { ok: true }, error: null });
    return { action: { ...action, status: "done", result: { ok: true } }, message };
  } catch (e) {
    const msg = e instanceof ActionError ? e.message : action.type === "research" ? "The research didn't finish. Please try again." : "Couldn't draft the calendar. Please try again.";
    await setStatus(id, "failed", { error: msg });
    throw new ActionError(msg, e instanceof ActionError ? e.status : 500);
  }
}

/** Text for the post-turn model call that decides which actions to offer. */
export const ACTION_GUIDE = `Actions you may offer (0 to 2; usually none). Nothing leaves the chat: posters, research and calendars are all made right here.
- {"type":"posters","title":"…","params":{"posts":[{"day":"Tuesday","platform":"Instagram feed","idea": one line,"headline": short poster headline (no price or discount unless the owner gave it),"caption": the post caption,"visual": what the image shows,"goal": one of ${POSTER_AD_GOAL_LIST}}]}}
  Offer this when the reply is a post plan (one entry per planned post, copied from the reply, max ${MAX_POSTS}) or the owner wants a poster, ad creative or social graphic (one entry).
- {"type":"research","title":"…","params":{"product": product name or "","regions": Indian state or city names, e.g. ["Bengaluru","Tamil Nadu"]}}  (always offer it when the owner asks for research, a report, or a competitor/market/regional study; otherwise only when they need facts we don't have yet)
- {"type":"calendar","title":"…","params":{"weeks":1-4,"focus": theme or occasion}}  (when they want a longer posting plan than this reply gives)`;
