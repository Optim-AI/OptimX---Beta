/**
 * Posters made inside the Marketing Agent chat.
 *
 * One planned post → one poster, through the same Brand Studio poster engine as the
 * studios (brief → marketing strategist → creative concept → render with QC; Brand Kit
 * rules apply). Each finished poster is charged 1 image credit by the engine itself,
 * only after it came out right; failed posters are free.
 *
 * Jobs run in the background (lib/jobs/background) and write progress per post into the
 * action row, so the chat can poll and show tiles as they finish.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/database/client";
import { agentActions } from "@/database/schema";
import { CreditsDAO } from "@/database";
import { getUserBrand } from "@/lib/brand-kit/server";
import {
  createPosterGenerationSessionService,
  generatePostersForSession,
  runCreativeConceptsForSession,
  runMarketingStrategyForSession,
  selectConceptForSession,
  type CreativeBrief,
} from "@/lib/creative-studio/poster-generation";
import { POSTER_AD_GOALS, type PosterAdGoal } from "@/lib/creative-studio/poster-generation/types";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";
import { getUserProduct, listUserProducts, type ProductRef } from "@/lib/test-packs/products";
import { runInBackground } from "@/lib/jobs/background";
import { CONTEXT_BUCKET } from "./context-items";
import { artBriefInstruction, formatArtBrief, writeArtBrief, type ArtBrief } from "@/lib/content-studio/art-brief";
import { withOnboardingArtDirection } from "@/lib/onboarding/demo-poster";

export const POSTER_SIZES = { feed: "4:5", square: "1:1", story: "9:16" } as const;
export type PosterSize = keyof typeof POSTER_SIZES;
/** Six posters, three at a time, fit inside the server's 5-minute background limit. */
export const MAX_POSTS = 6;

export type PlannedPost = {
  day: string;
  platform: string;
  idea: string;
  headline: string;
  caption: string;
  visual: string;
  goal: PosterAdGoal;
  /** "product" = about one product (the owner picks which); "brand" = the brand itself (festivals, story, range). */
  scope: "brand" | "product";
  /** The product the agent suggests for a product post (one of the owner's product names). */
  product: string;
};

export type PosterItem = {
  index: number;
  status: "queued" | "running" | "done" | "failed";
  imageUrl?: string | null;
  error?: string | null;
  /** Engine session + generation, so the owner can edit the poster in the chat */
  engineSessionId?: string | null;
  generationId?: string | null;
  /** How many times the owner edited it */
  edits?: number;
  /** The product on this poster (null = brand poster) */
  productName?: string | null;
};

export type PosterJobResult = {
  items: PosterItem[];
  size: PosterSize;
  productName: string | null;
  startedAt: string;
  finishedAt?: string;
  charged?: number;
};

const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
/** Plain text for poster copy and captions: no markdown marks (**bold**, _italic_, # headings, `code`). */
const plain = (v: unknown, n: number) => str(typeof v === "string" ? v.replace(/(\*\*|__|[*_`#])/g, "") : v, n);

export function cleanPost(raw: any): PlannedPost | null {
  const idea = plain(raw?.idea, 300);
  const headline = plain(raw?.headline, 120);
  if (!idea && !headline) return null;
  const goal = (POSTER_AD_GOALS as readonly string[]).includes(raw?.goal) ? (raw.goal as PosterAdGoal) : "awareness";
  return {
    day: str(raw?.day, 40),
    platform: str(raw?.platform, 60) || "Instagram",
    idea: idea || headline,
    headline,
    caption: plain(raw?.caption, 600),
    visual: plain(raw?.visual, 300),
    goal,
    scope: raw?.scope === "product" || (raw?.scope !== "brand" && plain(raw?.product, 80)) ? "product" : "brand",
    product: plain(raw?.product, 80),
  };
}

/** Products the owner can put on posters (from Ad Studio website scans). */
export async function productChoices(userId: string) {
  const list = await listUserProducts(userId).catch((): ProductRef[] => []);
  // Scans list the same item more than once ("Bundle – Pack of 6" and "Bundle – Pack of 6 - brand - …"): show one.
  const seen = new Set<string>();
  return list
    .filter((p) => p.product.product_images?.some((u) => /^https?:\/\//.test(u)))
    .filter((p) => {
      const key = (p.product.product_name || "").split(/\s+-\s+/)[0].replace(/\s+/g, " ").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30)
    .map((p) => ({ id: p.id, name: p.product.product_name, image: p.product.product_images.find((u) => /^https?:\/\//.test(u)) ?? null }));
}

/** A photo the owner uploaded in the chat (private bucket) → a product the engine can use. */
async function uploadedProduct(userId: string, path: string, name: string): Promise<Product | null> {
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return null;
  const { supabaseAdmin } = await import("@/auth/supabase/admin");
  const { data } = await supabaseAdmin.storage.from(CONTEXT_BUCKET).createSignedUrl(path, 7 * 24 * 3600);
  if (!data?.signedUrl) return null;
  return {
    product_name: name || "Our product", price: null, description: "", key_benefits: [], product_images: [data.signedUrl],
    target_audience: "", emotional_angles: [], use_cases: [], short_benefit: "",
  };
}

export async function resolveProduct(userId: string, choice: unknown): Promise<Product | null> {
  const c = (choice ?? {}) as Record<string, unknown>;
  if (typeof c.ref === "string" && c.ref) return getUserProduct(userId, c.ref);
  if (typeof c.uploadPath === "string" && c.uploadPath) return uploadedProduct(userId, c.uploadPath, str(c.name, 80));
  return null;
}

/** Same art-director brief as Ad Studio: one idea, a style, brand colours, the planned headline kept. */
export function artBriefFor(brand: BrandSnapshot, post: PlannedPost, product: Product | null, size: PosterSize): Promise<ArtBrief | null> {
  return writeArtBrief({
    brand,
    product,
    angle: { title: post.headline || post.idea, message: post.idea, angle: post.goal },
    ownerRequest: [post.visual && `Visual idea from the plan: ${post.visual}`, post.day && `Posting on ${post.day}${post.platform ? ` (${post.platform})` : ""}.`]
      .filter(Boolean)
      .join(" ") || null,
    aspectRatio: POSTER_SIZES[size],
    exactHeadline: post.headline || null,
  });
}

export function buildBrief(brand: BrandSnapshot, post: PlannedPost, product: Product | null, size: PosterSize, art: ArtBrief | null = null): CreativeBrief {
  const logoUrl = brand.logo || brand.logoUrl || null;
  const images = (product?.product_images || []).filter((u) => /^https?:\/\//.test(u)).slice(0, 3).map((url) => ({ url }));
  const userInstruction = [
    `Create a ${post.platform || "social media"} poster for ${brand.name}${post.day ? ` (to post on ${post.day})` : ""}.`,
    `Post idea: ${post.idea}`,
    // With an art brief the picture and the exact copy are decided there.
    !art && post.headline && `Headline idea (tighten it, keep its meaning): "${post.headline}"`,
    !art && post.visual && `Visual idea: ${post.visual}`,
    ...(art ? artBriefInstruction(art) : []),
    product ? "Feature the real product from the product reference; packaging must match it exactly." : "There is no product photo: build the poster around the brand, the idea and the visual, not a made-up product pack.",
    "Do not invent prices, discounts, stats or ratings that are not in this brief. No placeholder or labelled copy (never write 'CTA:' or 'Headline:').",
    "No badges, seals, stamps or stickers unless this brief gives their exact text.",
  ].filter(Boolean).join("\n");

  return {
    id: `brief_agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: brand,
      name: brand.name,
      logo: logoUrl ? { url: logoUrl } : null,
      primaryColors: brand.primaryColors || [],
      fonts: brand.primaryFont || brand.fontStyles || null,
      tone: Array.isArray(brand.brand_tone) && brand.brand_tone.length ? brand.brand_tone.join(", ") : brand.tone || null,
      voice: brand.brandVoice || null,
      industry: brand.industry || null,
      audience: brand.audience || product?.target_audience || null,
      tagline: brand.tagline || null,
      coreValueProp: product?.short_benefit || brand.coreValueProp || null,
      aestheticTags: brand.brand_aesthetic || [],
      values: brand.brand_values || [],
      guidelinesApplied: true,
    },
    product: product
      ? {
          source: "catalog",
          name: product.product_name,
          description: product.description || null,
          shortBenefit: product.short_benefit || null,
          category: product.category || brand.productCategory || null,
          benefits: product.key_benefits || [],
          factualClaims: [],
          features: [],
          emotionalAngles: product.emotional_angles || [],
          useCases: product.use_cases || [],
          images,
          brandName: brand.name,
          targetAudience: product.target_audience || null,
          catalogProduct: product,
        }
      : null,
    userInstruction,
    visualDirection: art?.direction ?? null,
    aspectRatio: POSTER_SIZES[size],
    variantCount: 1,
    platformHint: post.platform || "Instagram / Meta feed",
    adGoal: post.goal,
    audienceHint: null,
    constraints: [
      "Do not invent factual claims not present in the brief.",
      "Every line of copy must be finished copy, never a label like 'CTA:'.",
      ...(product ? ["Use the provided product reference image as the exact product."] : []),
    ],
    productReferences: images.map((image, i) => ({ id: `agent_product_${i}`, role: "product_packshot" as const, image })),
    designReferences: [],
    supportingReferences: [],
    brandOnPackaging: art?.brandOnPack ?? false,
  } as CreativeBrief;
}

/** One poster through the shared engine. The engine charges 1 credit only on success. */
async function renderOne(userId: string, brand: BrandSnapshot, post: PlannedPost, product: Product | null, size: PosterSize): Promise<{ ok: true; imageUrl: string; engineSessionId: string; generationId: string | null } | { ok: false; error: string }> {
  try {
    const sessionService = createPosterGenerationSessionService();
    const session = await sessionService.createSession({ userId });
    const art = await artBriefFor(brand, post, product, size);
    await sessionService.updateBrief(session.id, userId, buildBrief(brand, post, product, size, art));
    await runMarketingStrategyForSession({ sessionId: session.id, userId, sessionService });
    if (art) {
      // Added after the strategist (as in Ad Studio), for the concept and image stages.
      const planned = await sessionService.getSession(session.id, userId);
      if (planned.brief) await sessionService.updateBrief(session.id, userId, withOnboardingArtDirection(planned.brief, formatArtBrief(art)));
    }
    const { concepts } = await runCreativeConceptsForSession({ sessionId: session.id, userId, conceptCount: 1, sessionService });
    if (!concepts.length) return { ok: false, error: "Couldn't plan this poster." };
    await selectConceptForSession({ sessionId: session.id, userId, conceptIds: concepts[0].id, sessionService });
    const result = await generatePostersForSession({ sessionId: session.id, userId, variantCount: 1, sessionService });
    const asset = result.outcomes.find((o) => o.success && o.asset)?.asset;
    if (asset?.imageUrl && /^https?:\/\//.test(asset.imageUrl)) {
      return { ok: true, imageUrl: asset.imageUrl, engineSessionId: session.id, generationId: asset.generationId ?? null };
    }
    if (result.outcomes.some((o) => o.asset?.errorCode === "INSUFFICIENT_CREDITS")) return { ok: false, error: "You ran out of image credits." };
    return { ok: false, error: "This poster didn't come out right. You weren't charged for it." };
  } catch (err) {
    const pub = (err as { toPublicJSON?: () => { message?: string; code?: string } })?.toPublicJSON?.();
    if (pub?.code === "INSUFFICIENT_CREDITS") return { ok: false, error: "You ran out of image credits." };
    console.error("[agent/posters] render failed", { message: (err as Error)?.message?.slice(0, 200) });
    return { ok: false, error: "This poster didn't come out right. You weren't charged for it." };
  }
}

async function writeResult(actionId: string, result: PosterJobResult, status?: string) {
  await db.update(agentActions)
    .set({ result, updatedAt: new Date().toISOString(), ...(status ? { status } : {}) })
    .where(eq(agentActions.id, actionId));
}

export class PosterJobError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Start making posters for the chosen posts. Checks the balance first, claims the
 * action once (no double runs), then renders in the background.
 */
export async function startPosterJob(input: {
  userId: string; actionId: string; posts: PlannedPost[]; selected: number[]; size: PosterSize; product: Product | null;
  /** Per post (by index): the product on that poster, or null for a brand poster. Overrides `product`. */
  productsByPost?: Record<number, Product | null>;
}): Promise<PosterJobResult> {
  const productFor = (index: number) =>
    input.productsByPost && index in input.productsByPost ? input.productsByPost[index] : input.product;
  const { userId, actionId } = input;
  const picks = [...new Set(input.selected)].filter((i) => Number.isInteger(i) && i >= 0 && i < input.posts.length).slice(0, MAX_POSTS);
  if (!picks.length) throw new PosterJobError("Pick at least one post.");

  const balance = (await CreditsDAO.getFullBalance(userId))?.imageCredits.total ?? 0;
  if (balance < picks.length) {
    throw new PosterJobError(balance > 0
      ? `This needs ${picks.length} image credits and you have ${balance}. Untick some posts, or buy more credits.`
      : "You have no image credits left. Buy credits to make posters.", 402);
  }

  const { snapshot } = await getUserBrand(userId);
  if (!snapshot?.name) throw new PosterJobError("Set up your Brand Kit first so posters use your name, logo and colours.");
  const brand = snapshot as unknown as BrandSnapshot;

  const result: PosterJobResult = {
    items: picks.map((index) => ({ index, status: "queued", productName: productFor(index)?.product_name ?? null })),
    size: input.size,
    productName: input.product?.product_name ?? null,
    startedAt: new Date().toISOString(),
  };
  const claimed = await db.update(agentActions)
    .set({ status: "running", result, error: null, updatedAt: new Date().toISOString() })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.userId, userId), eq(agentActions.status, "proposed")))
    .returning({ id: agentActions.id });
  if (!claimed.length) throw new PosterJobError("These posters are already being made.", 409);

  runInBackground("agent-posters", async () => {
    let next = 0;
    const work = async () => {
      while (next < result.items.length) {
        const item = result.items[next++];
        item.status = "running";
        await writeResult(actionId, result);
        const out = await renderOne(userId, brand, input.posts[item.index], productFor(item.index), input.size);
        if (out.ok) { item.status = "done"; item.imageUrl = out.imageUrl; item.engineSessionId = out.engineSessionId; item.generationId = out.generationId; }
        else { item.status = "failed"; item.error = out.error; }
        await writeResult(actionId, result);
      }
    };
    await Promise.all([work(), work(), work()]); // three at a time
    result.finishedAt = new Date().toISOString();
    result.charged = result.items.filter((i) => i.status === "done").length;
    await writeResult(actionId, result, result.charged > 0 ? "done" : "failed");
  });
  return result;
}

/** A job cut off by the server time limit: mark unfinished posts failed so the owner can retry. */
export function settleStale(result: PosterJobResult | null, updatedAt: string): PosterJobResult | null {
  if (!result || result.finishedAt) return result;
  if (Date.now() - new Date(updatedAt).getTime() < 8 * 60_000) return result;
  return {
    ...result,
    finishedAt: new Date().toISOString(),
    items: result.items.map((i) => (i.status === "done" || i.status === "failed" ? i : { ...i, status: "failed", error: "This one took too long. You weren't charged for it." })),
  };
}

/** Only images in our own public poster storage can replace a poster in the chat. */
export function isOwnPosterUrl(url: string): boolean {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "");
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.protocol === base.protocol && u.host === base.host && u.pathname.startsWith("/storage/v1/object/public/campaign-assets/");
  } catch {
    return false;
  }
}

/** After an edit in the chat: swap in the new image (and its engine generation, if any). */
export async function updatePosterItem(userId: string, actionId: string, index: number, imageUrl: string, generationId: string | null): Promise<PosterJobResult> {
  if (!isOwnPosterUrl(imageUrl)) throw new PosterJobError("That image can't be used here.");
  const [row] = await db.select().from(agentActions).where(and(eq(agentActions.id, actionId), eq(agentActions.userId, userId)));
  if (!row || row.type !== "posters") throw new PosterJobError("Those posters no longer exist.", 404);
  const result = row.result as PosterJobResult | null;
  const item = result?.items?.find((i) => i.index === index);
  if (!result || !item || item.status !== "done") throw new PosterJobError("That poster isn't ready to edit.", 409);
  item.imageUrl = imageUrl;
  item.generationId = generationId;
  item.edits = (item.edits ?? 0) + 1;
  await db.update(agentActions).set({ result, updatedAt: new Date().toISOString() }).where(eq(agentActions.id, actionId));
  return result;
}
