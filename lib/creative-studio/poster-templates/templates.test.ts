/**
 * Poster templates + product cut-outs (offline: bundled font, injected deps).
 * Run: npx tsx lib/creative-studio/poster-templates/templates.test.ts
 */

import sharp from "sharp";
import { contrastRatio, pickReadable } from "./color";
import { loadFont, type FontFetcher } from "./fonts";
import { buildPalette } from "./palette";
import { CANVAS_SIZES, renderPoster } from "./render";
import { compileSceneBrief, describeRegion, sceneAspect } from "./scene-brief";
import { OFFER_HERO, PRODUCT_HERO_SCENE, SPLIT_PANEL, conceptTemplateFit, selectTemplate } from "./templates";
import { gradeCutout, harmonizeProduct, structuralSimilarity } from "./harmonize";
import { fitText, linePathData, measureLine } from "./text-fit";
import { getProductCutout, type CutoutCache, type CutoutCacheRow } from "@/lib/creative-studio/product-cutouts";
import type { GenerationSpecification, ImageGenerationProvider, ImageGenerationRequest } from "../poster-generation/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const offline: FontFetcher = async () => ({ ok: false, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });

async function productPng(w = 400, h = 600): Promise<Buffer> {
  // An opaque "bottle" on a transparent background.
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${w * 0.25}" y="${h * 0.1}" width="${w * 0.5}" height="${h * 0.8}" rx="30" fill="#2244aa"/></svg>`) }])
    .png()
    .toBuffer();
}

async function run() {
  const font = await loadFont("Some Brand Font", 700, offline);
  assert(font.fallback && font.family === "Noto Sans", "offline font falls back to bundled Noto Sans");

  // ── text fit ───────────────────────────────────────────────
  const small = fitText({ font: font.font, text: "Morning oats, done right", boxWidth: 600, boxHeight: 200, minSize: 20, maxSize: 200, maxLines: 2, lineHeight: 1.1 });
  const big = fitText({ font: font.font, text: "Morning oats, done right", boxWidth: 1200, boxHeight: 400, minSize: 20, maxSize: 200, maxLines: 2, lineHeight: 1.1 });
  assert(small.fits && big.fits, "headline fits");
  assert(big.fontSize > small.fontSize, "bigger box → bigger type");
  assert(small.lines.length <= 2, "respects maxLines");
  assert(small.lines.join(" ") === "Morning oats, done right", "wrapping never changes the words");
  for (const l of small.lines) assert(measureLine(font.font, l, small.fontSize) <= 600, "every line fits the width");
  const tooLong = fitText({ font: font.font, text: "A very long headline that cannot possibly fit into such a tiny box", boxWidth: 100, boxHeight: 30, minSize: 20, maxSize: 40, maxLines: 1, lineHeight: 1 });
  assert(!tooLong.fits && tooLong.fontSize === 20, "reports when text can't fit");
  const path = linePathData(font.font, "Flat 30% off — this weekend!", 13.37, 100, 97.3);
  assert(path.length > 100 && !/NaN|undefined|Infinity/.test(path), "path data is finite");

  // ── colour ─────────────────────────────────────────────────
  assert(Math.abs(contrastRatio(1, 0) - 21) < 0.01, "white on black is 21:1");
  assert(pickReadable(0.9, ["#ffffff", "#111111"], 4.5).color === "#111111", "dark text on a light background");
  assert(pickReadable(0.02, ["#111111", "#ffffff"], 4.5).color === "#ffffff", "light text on a dark background");
  const pal = buildPalette([{ hex: "#2f5d3a", role: "primary" }, { hex: "#2f5d3b", role: "accent" }]);
  assert(pal.accent !== "#2f5d3b", "accent that matches primary is replaced");
  assert(buildPalette(null).primary.startsWith("#"), "palette without a kit");

  // ── selection ──────────────────────────────────────────────
  assert(selectTemplate({ kind: "offer", aspect: "4:5", variantIndex: 0, hasCutout: true })?.id === "offer-hero", "offer → offer hero first");
  const ids = [0, 1, 2].map((i) => selectTemplate({ kind: "launch", aspect: "1:1", variantIndex: i, hasCutout: true })?.id);
  assert(new Set(ids).size === 3, "variants rotate through templates");
  assert(selectTemplate({ kind: "offer", aspect: "4:5", variantIndex: 0, hasCutout: false }) === null, "no cut-out → full-AI path");
  assert(selectTemplate({ kind: "before_after", aspect: "4:5", variantIndex: 0, hasCutout: true }) === null, "before/after has no template yet");
  assert(selectTemplate({ kind: "general", aspect: "1.91:1", variantIndex: 0, hasCutout: true }) === null, "unsupported aspect → full-AI path");

  // ── concept-aware choice ───────────────────────────────────
  const productHero = { territory: "product_hero", humanPresence: "none", productTreatment: "hero on a plinth", composition: "centred", visualStory: "the pack in morning light" };
  assert(conceptTemplateFit(productHero).suitable, "product-only concept suits templates");
  assert(!conceptTemplateFit({ ...productHero, humanPresence: "a woman laughing" }).suitable, "people → full-AI");
  assert(conceptTemplateFit({ ...productHero, humanPresence: "None — product only" }).suitable, "'None —' means no people");
  assert(!conceptTemplateFit({ ...productHero, productTreatment: "honey being poured over toast" }).suitable, "product in use → full-AI");
  assert(!conceptTemplateFit({ ...productHero, composition: "a triptych of preparation steps" }).suitable, "sequence → full-AI");
  assert(!conceptTemplateFit({ ...productHero, territory: "demonstration" }).suitable, "demonstration → full-AI");
  assert(selectTemplate({ kind: "launch", aspect: "4:5", variantIndex: 0, hasCutout: true, concept: productHero })?.id === "split-panel", "product hero prefers split panel");
  assert(selectTemplate({ kind: "launch", aspect: "4:5", variantIndex: 0, hasCutout: true, concept: { ...productHero, territory: "lifestyle" } })?.id === "product-hero-scene", "lifestyle prefers a scene");
  assert(selectTemplate({ kind: "launch", aspect: "4:5", variantIndex: 1, hasCutout: true, concept: { ...productHero, territory: "lifestyle" }, used: ["product-hero-scene"] })?.id !== "product-hero-scene", "used templates are skipped");
  assert(selectTemplate({ kind: "offer", aspect: "4:5", variantIndex: 0, hasCutout: true, concept: productHero })?.id === "offer-hero", "offer leads with the offer hero");
  assert(selectTemplate({ kind: "offer", aspect: "4:5", variantIndex: 1, hasCutout: true, concept: productHero, used: ["offer-hero"] })?.id === "split-panel", "then concept preference");

  // ── every layout stays on the canvas ───────────────────────
  for (const t of [OFFER_HERO, PRODUCT_HERO_SCENE, SPLIT_PANEL]) {
    for (const [aspect, l] of Object.entries(t.layouts)) {
      const boxes = [l!.headline.box, l!.supporting?.box, l!.cta?.box, l!.badge?.box, l!.logo, l!.product?.box].filter(Boolean);
      for (const b of boxes) assert(b!.x >= 0 && b!.y >= 0 && b!.x + b!.w <= 1.001 && b!.y + b!.h <= 1.001, `${t.id} ${aspect} box on canvas`);
      if (aspect === "9:16") {
        for (const b of [l!.headline.box, l!.cta?.box].filter(Boolean)) {
          assert(b!.y >= 0.14 && b!.y + b!.h <= 0.8, `${t.id} 9:16 text clear of Story UI`);
        }
      }
    }
  }

  // ── scene brief ────────────────────────────────────────────
  const spec = {
    aspectRatio: "4:5",
    renderCopy: { headline: "SECRET HEADLINE", badges: [] },
    artDirection: {
      productName: "Oats",
      brandColors: ["#2f5d3a"],
      theme: { lighting: "soft morning light", mood: "calm", avoid: ["clutter"] },
      concept: { environment: "a sunlit kitchen counter", supportingElements: "", lighting: "", mood: "", photographyStyle: "editorial" },
    },
  } as unknown as GenerationSpecification;
  const brief = compileSceneBrief(spec, PRODUCT_HERO_SCENE, PRODUCT_HERO_SCENE.layouts["4:5"]!);
  assert(brief.includes("NO text"), "scene brief forbids text");
  assert(brief.includes("No graphics, icons, stars"), "scene brief forbids painted graphics");
  assert(brief.includes("empty stage"), "scene brief reserves the product stage");
  assert(brief.includes("sunlit kitchen counter"), "scene brief carries the concept setting");
  assert(!brief.includes("SECRET HEADLINE"), "copy never goes to the image model");
  assert(describeRegion({ x: 0, y: 0, w: 1, h: 0.36 }) === "the top 36% of the frame", "region wording");
  assert(sceneAspect(spec, SPLIT_PANEL.layouts["4:5"]!) === "4:3", "split scene uses its own shape");

  // ── render ─────────────────────────────────────────────────
  const cutout = await productPng();
  const heading = font;
  const solid = await renderPoster({
    template: OFFER_HERO,
    aspect: "4:5",
    palette: buildPalette([{ hex: "#2f5d3a", role: "primary" }, { hex: "#f4b942", role: "accent" }]),
    fonts: { heading, body: heading },
    copy: { headline: "Flat 30% off this weekend", supporting: "On every pack.", cta: "Grab the deal", badge: "This badge text is far too long to fit inside a starburst" },
    cutout,
  });
  const meta = await sharp(solid.png).metadata();
  assert(meta.width === CANVAS_SIZES["4:5"].width && meta.height === CANVAS_SIZES["4:5"].height, "2K canvas");
  const headlineLayer = solid.manifest.layers.find((l) => l.kind === "text" && l.slot === "headline");
  assert(headlineLayer && headlineLayer.kind === "text" && headlineLayer.lines.join(" ") === "Flat 30% off this weekend", "headline rendered exactly");
  assert(solid.manifest.layers.some((l) => l.kind === "product"), "product composited");
  assert(solid.manifest.layers.some((l) => l.kind === "cta"), "cta drawn");
  assert(!solid.manifest.layers.some((l) => l.kind === "badge"), "overflowing badge left out");
  assert(solid.manifest.warnings.some((w) => w.includes("badge")), "badge omission is reported");
  let threw = false;
  await renderPoster({ template: PRODUCT_HERO_SCENE, aspect: "4:5", palette: pal, fonts: { heading, body: heading }, copy: { headline: "x" }, cutout }).catch(() => (threw = true));
  assert(threw, "scene template without a scene fails loudly");

  // Busy scene behind text → scrim, and text stays readable.
  const noisy = await sharp(Buffer.from(Array.from({ length: 300 * 300 * 3 }, () => Math.floor(Math.random() * 256))), { raw: { width: 300, height: 300, channels: 3 } }).png().toBuffer();
  const busy = await renderPoster({ template: PRODUCT_HERO_SCENE, aspect: "1:1", palette: pal, fonts: { heading, body: heading }, copy: { headline: "Readable on anything" }, scene: noisy, cutout });
  assert(busy.manifest.layers.some((l) => l.kind === "scrim"), "busy background gets a scrim");

  // ── product line shares the supporting slot ────────────────
  const both = await renderPoster({ template: OFFER_HERO, aspect: "4:5", palette: pal, fonts: { heading, body: heading }, copy: { headline: "Pure honey", productLine: "Wild Hive Forest Honey 500g", supporting: "Raw and unprocessed." }, cutout });
  const texts = both.manifest.layers.filter((l) => l.kind === "text").map((l) => (l.kind === "text" ? `${l.slot}:${l.lines.join(" ")}` : ""));
  assert(texts.includes("productLine:Wild Hive Forest Honey 500g") && texts.includes("supporting:Raw and unprocessed."), `product line and supporting both rendered (${texts.join(" | ")})`);

  // ── harmonize ──────────────────────────────────────────────
  const sceneImg = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#d9c7a8" } }).png().toBuffer();
  const prod = await sharp(cutout).resize(400, 600).png().toBuffer();
  const placed = { png: prod, left: 600, top: 900, width: 400, height: 600 };
  const composite = await sharp(sceneImg).composite([{ input: prod, left: 600, top: 900 }]).png().toBuffer();
  assert((await structuralSimilarity(composite, composite)) > 0.99, "identical images are similar");
  const warmer = await sharp(composite).modulate({ brightness: 1.1 }).tint("#ffcc88").png().toBuffer();
  const unrelated = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#204060" } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000"><circle cx="300" cy="300" r="250" fill="#fff"/><rect x="900" y="1200" width="500" height="300" fill="#f00"/></svg>`) }])
    .png().toBuffer();
  const mockProvider = (out: Buffer): ImageGenerationProvider & { calls: ImageGenerationRequest[] } => {
    const calls: ImageGenerationRequest[] = [];
    return {
      id: "mock", calls,
      checkAvailability: async () => ({ available: true }),
      getCapabilities: () => ({}) as never,
      estimateCost: () => 1,
      generate: async (req) => { calls.push(req); return { ok: true, imageBuffer: out, provider: "mock", model: "m", estimatedCostCredits: 1 }; },
      edit: async () => ({ ok: false, provider: "mock", model: "m", estimatedCostCredits: 0 }),
    } as unknown as ImageGenerationProvider & { calls: ImageGenerationRequest[] };
  };
  const hspec = { aspectRatio: "4:5", sessionId: "s", generationId: "g", variantId: "v" } as GenerationSpecification;
  const good = mockProvider(warmer);
  const hg = await harmonizeProduct({ base: composite, product: placed, canvas: { width: 1600, height: 2000 }, spec: hspec, provider: good, userId: "u" });
  assert(hg.ok, `relit composite is accepted (${!hg.ok && hg.reason})`);
  assert(good.calls[0].referenceImages[0].label.startsWith("BASE POSTER") && good.calls[0].referenceImages[1].kind === "product", "harmonize sends composite + product");
  const kept = await harmonizeProduct({ base: composite, product: placed, canvas: { width: 1600, height: 2000 }, spec: hspec, provider: mockProvider(warmer), userId: "u", preserve: [{ left: 0, top: 1600, width: 1600, height: 400 }] });
  assert(kept.ok, "harmonize with a preserved panel");
  const panelBefore = await sharp(composite).extract({ left: 0, top: 1700, width: 1600, height: 300 }).png().toBuffer();
  const panelAfter = await sharp(kept.buffer).extract({ left: 0, top: 1700, width: 1600, height: 300 }).png().toBuffer();
  const px = async (b: Buffer) => (await sharp(b).stats()).channels.map((c) => Math.round(c.mean)).join(",");
  assert((await px(panelBefore)) === (await px(panelAfter)), "preserved panel is restored exactly");
  const hb = await harmonizeProduct({ base: composite, product: placed, canvas: { width: 1600, height: 2000 }, spec: hspec, provider: mockProvider(unrelated), userId: "u" });
  assert(!hb.ok, "a redrawn image is rejected");
  const lit = await sharp(prod).modulate({ brightness: 1.3 }).png().toBuffer();
  const graded = await gradeCutout(prod, lit);
  const meanOf = async (b: Buffer) => (await sharp(await sharp(b).flatten({ background: "#000" }).toBuffer()).stats()).channels[0].mean;
  assert((await meanOf(graded)) > (await meanOf(prod)), "grading moves the cut-out toward the lit product");
  const gm = await sharp(graded).metadata();
  assert(gm.hasAlpha && gm.width === 400, "grading keeps size and transparency");

  // ── cut-out service ────────────────────────────────────────
  const rows = new Map<string, CutoutCacheRow>();
  const cache: CutoutCache = {
    get: async (u, h) => rows.get(`${u}:${h}`) ?? null,
    put: async (u, row) => void rows.set(`${u}:${row.sourceHash}`, row),
  };
  const stored = new Map<string, Buffer>();
  const counter = { calls: 0 };
  const callCount = () => counter.calls;
  const deps = {
    provider: { id: "mock", remove: async () => (counter.calls++, cutout) },
    cache,
    store: async ({ sourceHash, png }: { sourceHash: string; png: Buffer }) => {
      stored.set(`mem://${sourceHash}`, png);
      return { url: `mem://${sourceHash}`, storagePath: sourceHash };
    },
    loadImage: async (src: string) => stored.get(src) ?? Buffer.from(`photo:${src}`),
  };
  const off = await getProductCutout({ userId: "u1", source: "https://x/p.png" }, { ...deps, provider: null });
  assert(!off.ok && off.provider === "none", "no provider → cut-outs off");
  const first = await getProductCutout({ userId: "u1", source: "https://x/p.png" }, deps);
  assert(first.ok && first.png && !first.cached && first.url?.startsWith("mem://"), "cut-out made and stored");
  const firstMeta = await sharp(first.png!).metadata();
  assert(firstMeta.width! < 400, "cut-out is trimmed to the product");
  const again = await getProductCutout({ userId: "u1", source: "https://x/p.png" }, deps);
  assert(again.ok && again.cached && callCount() === 1, "second request hits the cache");
  const blank = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const bad = await getProductCutout({ userId: "u1", source: "https://x/blank.png" }, { ...deps, provider: { id: "mock", remove: async () => (counter.calls++, blank) } });
  assert(!bad.ok && bad.quality && !bad.quality.ok, "empty cut-out rejected");
  const badAgain = await getProductCutout({ userId: "u1", source: "https://x/blank.png" }, { ...deps, provider: { id: "mock", remove: async () => (counter.calls++, blank) } });
  assert(!badAgain.ok && badAgain.cached && callCount() === 2, "rejected cut-out is remembered");
  const outage = await getProductCutout({ userId: "u1", source: "https://x/other.png" }, { ...deps, provider: { id: "mock", remove: async () => { throw new Error("503"); } } });
  assert(!outage.ok && rows.size === 2, "provider outage is not cached");

  console.log("poster templates: all tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
