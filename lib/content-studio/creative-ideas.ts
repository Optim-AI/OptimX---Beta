/**
 * Creative director for a set of posters.
 *
 * Before any poster is drawn, one call thinks up the whole set the way a strong designer
 * would: for each post it explores several ideas, keeps the most surprising one that still
 * reads in two seconds, and decides how the message is told (the creative device), what the
 * picture is, how the words look and behave, what the colour says and how the eye moves.
 * Every poster in the set must use a different device, composition and type treatment,
 * so a set never looks like one template filled in four times.
 *
 * The concept then goes into each poster's art brief. If the call fails, posters fall back
 * to the per-poster art brief (still good, just less varied).
 */
import { agentJson } from "@/lib/agent/gemini-json";
import { cleanBrandColors } from "@/lib/brand-kit/design-hygiene";
import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";

export type CreativeConcept = {
  /** How the message is told: metaphor, contrast, exaggeration, wordplay, story moment… */
  device: string;
  /** The human truth or tension the poster plays on */
  thought: string;
  /** The picture: what the viewer sees */
  visual: string;
  /** How the words look and behave (typeface character, placement, interaction with the image) */
  type: string;
  /** What the colour does and means */
  colour: string;
  /** Layout and how the eye moves */
  composition: string;
  /** Why it will stop the scroll */
  why: string;
};

export type IdeaPost = {
  headline: string;
  idea: string;
  product?: string | null;
  goal?: string | null;
  occasion?: string | null;
  visual?: string | null;
};

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Keep a usable concept; drop empty or obviously templated ones. */
export function cleanConcept(raw: unknown): CreativeConcept | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c: CreativeConcept = {
    device: clip(r.device, 80),
    thought: clip(r.thought, 240),
    visual: clip(r.visual, 500),
    type: clip(r.type, 260),
    colour: clip(r.colour ?? r.color, 220),
    composition: clip(r.composition, 260),
    why: clip(r.why, 200),
  };
  if (!c.visual || !c.type || !c.device) return null;
  return c;
}

/** The same device or type treatment twice in one set means the set will look templated. */
export function tooSimilar(a: CreativeConcept, b: CreativeConcept): boolean {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 3).join(" ");
  return key(a.device) === key(b.device) && key(a.type) === key(b.type);
}

export async function ideateSet(input: {
  brand: BrandSnapshot;
  posts: IdeaPost[];
  aspectRatio?: string;
  /** What the owner liked or changed before ("Poster taste") */
  taste?: string[];
}): Promise<Array<CreativeConcept | null>> {
  const { brand, posts } = input;
  if (!posts.length) return [];
  const colours = cleanBrandColors((brand.primaryColors || []).filter(Boolean));
  const list = posts
    .map((p, i) => `${i + 1}. Headline (fixed, word for word): "${clip(p.headline, 90)}" — post: ${clip(p.idea, 220)}${p.product ? ` — product: ${clip(p.product, 80)}` : " — brand post (no single product)"}${p.goal ? ` — goal: ${p.goal}` : ""}${p.occasion ? ` — occasion: ${clip(p.occasion, 60)}` : ""}${p.visual ? ` — planner's visual hint (optional): ${clip(p.visual, 160)}` : ""}`)
    .join("\n");

  const prompt = `You are an award-winning creative director and graphic designer. Design the creative thinking for a set of ${posts.length} social media poster${posts.length > 1 ? "s" : ""} (${input.aspectRatio || "4:5"}) for ${brand.name}${brand.industry ? `, ${clip(brand.industry, 60)}` : ""}${brand.tone ? ` (tone: ${clip(brand.tone, 80)})` : ""}.
Brand colours: ${colours.join(", ") || "none on file — choose colours that suit the product"}. Indian audience, seen on a phone while scrolling.

Posts:
${list}
${input.taste?.length ? `\nWhat this owner liked or changed on earlier posters: ${input.taste.slice(0, 6).join(" ")}` : ""}

How to think (like a human designer, not a template):
- For each post, privately sketch three very different ideas, then keep the most surprising one that a stranger still understands in two seconds.
- Start from a human truth or tension (the thought), then choose HOW to tell it — the creative device: a visual metaphor, a bold contrast or before/after in one frame, exaggeration or unexpected scale, a pun or wordplay between the words and the picture, a frozen story moment, humour, nostalgia or emotion, a cultural or festival ritual, type that becomes the image, negative space that hides a second meaning, an unusual point of view.
- The words are part of the design: decide the typeface character (serif, script, condensed, hand-lettered, stencil, geometric, editorial…), where they sit and how they interact with the picture (wrapping around the product, behind it, cut by it, written on something in the scene, huge and cropped, small and quiet…).
- Colour tells part of the story (warm nostalgia, a single shock colour, monochrome with one accent, sunrise gradient…) and uses the brand colours with intent, not as a fill.
- Plan the composition and the path of the eye.
- Every poster in this set must use a DIFFERENT device, a different composition and a different type treatment. No two may look like the same template.
- Avoid the default ad: product in the middle of a plain background with a big bold headline on top and a button below. Avoid clichés (random splashes, floating ingredients everywhere, lens flares) unless they ARE the idea.
- Keep the headline exactly as given. Never add prices, discounts, ratings or claims that were not given. The real product (when there is one) stays exactly as in its photo.

Reply as JSON only: {"concepts":[{"device":"","thought":"","visual":"what the viewer sees","type":"typeface character, placement and how the words interact with the image","colour":"","composition":"","why":"why it stops the scroll"}]} — one concept per post, in the same order.`;

  try {
    const out = await agentJson<{ concepts?: unknown[] }>(prompt, { timeoutMs: 60_000, label: "poster-creative-ideas", temperature: 0.9 });
    const concepts = (Array.isArray(out?.concepts) ? out.concepts : []).slice(0, posts.length).map(cleanConcept);
    // A concept that repeats an earlier one is dropped (that poster falls back to its own art brief).
    return posts.map((_, i) => {
      const c = concepts[i] ?? null;
      if (!c) return null;
      return concepts.slice(0, i).some((p) => p && tooSimilar(p, c)) ? null : c;
    });
  } catch (err) {
    console.warn("[creative-ideas] skipped", { message: (err as Error)?.message?.slice(0, 140) });
    return posts.map(() => null);
  }
}

/** Lines for the art brief: the concept to execute. */
export function conceptLines(c: CreativeConcept): string[] {
  return [
    `Creative idea (${c.device}): ${c.thought}`,
    `The picture: ${c.visual}`,
    `Words as design: ${c.type}`,
    `Colour story: ${c.colour}`,
    `Composition: ${c.composition}`,
  ].filter((l) => !/: $/.test(l));
}
