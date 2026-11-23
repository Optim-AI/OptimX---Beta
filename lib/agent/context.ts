/**
 * Builds what the Marketing Agent knows about the brand for one chat turn:
 * Brand Kit, Brand Research, Product & region reports and the owner's instructions.
 * Returns the system prompt plus labels for "what this answer drew on".
 */
import { productChoices } from "./posters";
import { getUserBrand } from "@/lib/brand-kit/server";
import { researchDigest } from "@/lib/research/brand-research";
import { getBrandResearch, listFocusedResearch } from "@/lib/research/store";
import type { FocusedResearch } from "@/lib/research/focused-research";
import type { BrandKit } from "@/lib/brand-kit/types";
import { buildDashboard } from "@/lib/meta-intel/summary";
import { getSettings } from "./store";
import { contextForChat } from "./context-items";
import { listMemories } from "./memory";

export type AgentContext = {
  system: string;
  used: string[];
  brandName: string;
  hasBrand: boolean;
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const list = (xs: unknown, n = 8) => (Array.isArray(xs) ? xs.filter((x) => typeof x === "string" && x.trim()).slice(0, n).join("; ") : "");

function kitBlock(kit: BrandKit): string {
  const i = kit.identity;
  const lines = [
    `Brand: ${kit.name}`,
    kit.websiteUrl && `Website: ${kit.websiteUrl}`,
    i.description && `About: ${i.description}`,
    i.offering && `Sells: ${i.offering}`,
    i.industry && `Industry: ${i.industry}`,
    i.productCategory && `Category: ${i.productCategory}`,
    i.audience && `Audience: ${i.audience}`,
    i.valueProposition && `Why buy: ${i.valueProposition}`,
    i.tone && `Tone: ${i.tone}`,
    i.pricePositioning && `Price level: ${i.pricePositioning}`,
    i.tagline && `Tagline: ${i.tagline}`,
    list(i.values) && `Values: ${list(i.values)}`,
    list(kit.guidelines?.dos) && `Brand rules, do: ${list(kit.guidelines.dos)}`,
    list(kit.guidelines?.donts) && `Brand rules, don't: ${list(kit.guidelines.donts)}`,
    list(kit.guidelines?.mustInclude) && `Every poster must include: ${list(kit.guidelines.mustInclude)}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function focusedBlock(r: FocusedResearch): string {
  const lines = [`• ${r.title} (${r.generatedAt.slice(0, 10)}): ${clip(r.summary || "", 500)}`];
  if (r.price_landscape?.where_yours_sits) lines.push(`  Price: ${clip(r.price_landscape.where_yours_sits, 200)}`);
  if (r.competitors?.length) lines.push(`  Competitors: ${r.competitors.slice(0, 5).map((c: any) => c.name).filter(Boolean).join(", ")}`);
  for (const o of (r.opportunities || []).slice(0, 3)) lines.push(`  Opportunity: ${clip(`${o.title}: ${o.play}`, 220)}`);
  for (const g of (r.regions || []).slice(0, 4)) {
    lines.push(`  ${g.name}: ${clip(g.summary || "", 220)}${g.ad_angles?.length ? ` Angles: ${g.ad_angles.slice(0, 3).join("; ")}` : ""}`);
  }
  return lines.join("\n");
}

export function todayInIndia(): string {
  return new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const ROLE = `You are the owner's marketing strategist inside SkalX, an AI marketing app for Indian D2C brands and local shops.
The owner is usually a busy, non-technical small-business owner. Write in plain, warm, direct language. No jargon; if a term is needed, explain it in a few words.
How to answer:
- Ground every recommendation in the brand facts below. When you use a fact from research, say where it came from in a few words ("from your Product & region report").
- When you use something from the owner's files, notes, memory or Meta ad numbers, say so briefly ("from your price list").
- Never invent numbers, sales figures, competitor prices or ad results. If you don't have the data, say so and suggest how to get it.
- Never invent the owner's own prices, discounts or offers. Use only prices and offers the owner gave you (in this chat, their files, notes or memory). If a post would need an offer they haven't given, write it without a price and suggest they add one.
- Be concrete: give the actual post idea, caption hook, offer or next step, not generic advice. Prefer short sections and bullet points.
- Think about India: festivals, regional languages, WhatsApp, Instagram, Meta ads, local buying habits, prices in ₹.
- Keep answers short unless asked for a plan. End with one clear next step when it helps.
- Follow the owner's standing instructions below quietly; don't announce that you are following them. Only mention them if a request conflicts with them.
- Everything happens in this chat. When posters, ad creatives or social graphics would help, say so in one line ("I can make these posters for you right here"): SkalX then shows the owner a card to pick posts, size and product, with the credit cost, and the posters appear in this chat. The same goes for market research and posting calendars. Never send the owner to another page or studio to do these, and never say you have already made, started or scheduled something.
- When you plan posts, write each one with its day, platform, idea, a short headline, the caption and what the image should show, so posters can be made from it.
- What the owner can use in SkalX beyond this chat (mention only if they ask): Brand Kit, Brand Studio, Ad Studio, Photoshoot Studio, Brand Research.`;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const money = (n: number | null | undefined, cur: string | null) =>
  n === null || n === undefined ? "n/a" : `${cur === "INR" || !cur ? "₹" : `${cur} `}${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : `${n.toFixed(2)}%`);

async function metaBlock(userId: string): Promise<string> {
  const d = await withTimeout(buildDashboard(userId, 30 as any), 5000);
  if (!d || d.state !== "ready" || !d.kpis || !(d.kpis.spend > 0)) return "";
  const k = d.kpis;
  const delta = (key: keyof typeof d.deltas) => (d.deltas?.[key] == null ? "" : ` (${d.deltas[key]! > 0 ? "+" : ""}${Math.round(d.deltas[key]! * 100)}% vs previous 30 days)`);
  const lines = [
    `Period: ${d.period.since} to ${d.period.until}${d.lastSyncAt ? `, last synced ${d.lastSyncAt.slice(0, 10)}` : ""}`,
    `Spend ${money(k.spend, d.currency)}${delta("spend")}; purchases ${k.purchases ?? "n/a"}${delta("purchases")}; revenue ${money(k.revenue, d.currency)}; ROAS ${k.roas ?? "n/a"}${delta("roas")}; cost per purchase ${money(k.cpa, d.currency)}${delta("cpa")}; CTR ${pct(k.ctr)}`,
  ];
  const describe = (a: (typeof d.ads)[number]) =>
    `"${clip(a.name || a.headline || "Untitled ad", 60)}": spend ${money(a.spend, d.currency)}, ROAS ${a.roas ?? "n/a"}, cost per purchase ${money(a.cpa, d.currency)}${a.score?.reasons?.length ? `. ${clip(a.score.reasons.join(" "), 160)}` : ""}`;
  const winners = d.ads.filter((a) => a.score?.status === "winner").slice(0, 3);
  const losing = d.ads.filter((a) => a.score?.status === "losing").slice(0, 3);
  if (winners.length) lines.push(`Working best: ${winners.map(describe).join(" | ")}`);
  if (losing.length) lines.push(`Losing money: ${losing.map(describe).join(" | ")}`);
  const top = d.organic?.[0] as any;
  if (top?.caption || top?.message) lines.push(`Top organic post: "${clip(String(top.caption || top.message), 100)}"`);
  return lines.join("\n");
}

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9\u0900-\u0DFF]{4,}/g) || []));

export async function buildAgentContext(userId: string, question = ""): Promise<AgentContext> {
  const used: string[] = [];
  const [{ kit, snapshot }, settings, focused, memories, items, meta, products] = await Promise.all([
    getUserBrand(userId).catch(() => ({ kit: null, snapshot: null })),
    getSettings(userId).catch(() => ({ instructions: "", tagline: null })),
    listFocusedResearch(userId).catch(() => [] as FocusedResearch[]),
    listMemories(userId, 60).catch(() => []),
    contextForChat(userId).catch(() => []),
    metaBlock(userId).catch(() => ""),
    productChoices(userId).catch(() => [] as { name: string }[]),
  ]);
  const brandName = kit?.name || (snapshot as any)?.brand_name || (snapshot as any)?.name || "";
  const website = kit?.websiteUrl || (snapshot as any)?.website_url || null;
  const research = await getBrandResearch(userId, website).catch(() => null);

  const parts: string[] = [ROLE, `Today is ${todayInIndia()}.`];

  if (kit) {
    parts.push(`## Brand Kit\n${kitBlock(kit)}`);
    used.push("Brand Kit");
  } else if (brandName) {
    parts.push(`## Brand\nBrand: ${brandName}${website ? `\nWebsite: ${website}` : ""}`);
  } else {
    parts.push(`## Brand\nThe owner hasn't set up a Brand Kit yet. Help anyway, ask what they sell when it matters, and suggest setting up the Brand Kit (Create → Brand Kit) so answers fit their brand.`);
  }

  if (products.length) {
    parts.push(`## Products with photos (use these exact names; a product post features one of them)\n${products.slice(0, 30).map((p) => `- ${p.name}`).join("\n")}`);
    used.push(products.length === 1 ? "1 product" : `${products.length} products`);
  }

  const digest = research ? researchDigest(research, 3500) : "";
  if (digest) {
    parts.push(`## Brand Research (whole brand)\n${digest}`);
    used.push("Brand Research");
  }

  if (focused.length) {
    parts.push(`## Product & region reports (newest first)\n${focused.slice(0, 3).map(focusedBlock).join("\n")}`);
    used.push(focused.length === 1 ? "1 Product & region report" : `${Math.min(focused.length, 3)} Product & region reports`);
  }

  if (meta) {
    parts.push(`## Meta ads, last 30 days (real numbers from the owner's connected ad account)\n${meta}`);
    used.push("Meta ads, last 30 days");
  }

  if (items.length) {
    // Full text for notes and for the 3 items that best match the question; a summary for the rest.
    const q = words(question);
    const scored = items.map((it, idx) => {
      const w = words(`${it.title} ${it.summary ?? ""} ${(it.text ?? "").slice(0, 4000)}`);
      let hit = 0;
      q.forEach((x) => { if (w.has(x)) hit++; });
      return { it, score: hit * 10 - idx };
    }).sort((a, b) => b.score - a.score);
    const full = new Set(scored.slice(0, 3).filter((x) => x.score > 0 || items.length <= 3).map((x) => x.it.id));
    let budget = 18000;
    const blocks = items.map((it) => {
      const label = it.kind === "note" ? "Note" : it.kind === "link" ? "Web page" : "File";
      const text = it.text ?? "";
      if ((full.has(it.id) || (it.kind === "note" && text.length < 1500)) && budget > 0) {
        const body = clip(text, Math.min(6000, budget));
        budget -= body.length;
        return `### ${label}: ${it.title}\n${body}`;
      }
      return `### ${label}: ${it.title}\n${it.summary ?? clip(text, 240)}`;
    });
    parts.push(`## Files, notes and links the owner added\n${blocks.join("\n\n")}`);
    used.push(items.length === 1 ? "1 of your files" : `${items.length} of your files and notes`);
  }

  if (memories.length) {
    parts.push(`## What you remember from earlier chats\n${memories.map((m) => `- ${m.fact}`).join("\n")}`);
    used.push("Memory");
  }

  const instructions = settings.instructions.trim();
  if (instructions) {
    parts.push(`## Owner's standing instructions (always follow)\n${instructions}`);
    used.push("Your instructions");
  }

  return { system: parts.join("\n\n"), used, brandName, hasBrand: !!(kit || brandName) };
}
