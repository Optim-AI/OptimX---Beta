/**
 * Run: npx tsx lib/photo-studio/photo-studio.test.ts
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { recommendShots, shotDirection, SHOTS } from "./shots";
import { normalizeProductProfile } from "./analyze";
import { refineCutout } from "./cutout-refine";
import { CANVAS, renderPackshot } from "./packshot";
import { LabelDriftError, MAX_GUIDED_ATTEMPTS, photoProImageModel, renderShot, scoreFidelity, WRONG_WORDS_MAX_SCORE } from "./render";
import { artDirectorPrompt, parseShotBrief } from "./art-direct";
import { scenePlacement } from "./packshot";
import { getShot } from "./shots";
import { existsSync } from "node:fs";
import { prepareMaster } from "./master";
import { assertCanShoot, keepPhotos, shootShot, PhotoStudioError, type WithLockedShoot } from "./shoot";
import { FREE_PHOTOS_PER_SHOOT_PER_DAY, isKept, photosInLastDay, toPhotoViews } from "./drafts";
import type { ShotResult } from "./types";
import { editPhoto, editPrompt } from "./edit";
import type { ImageGenerationProvider } from "@/lib/creative-studio/poster-generation/types";

async function main() {
  // Profile normalisation + recommendations
  const food = normalizeProductProfile({ name: "Peri Peri Anchovies", isFood: true, storyProps: ["chillies", "anchovies"], finish: "glossy plastic", sizeClass: "handheld" });
  const recs = recommendShots(food);
  assert.equal(food.kind, "packaged_food", "food is detected as packaged food");
  assert.ok(recs.includes("marketplace_white") && recs.includes("food_served") && recs.includes("food_ingredients"), "food gets food shots");
  const drink = normalizeProductProfile({ name: "Mango juice", kind: "beverage" });
  assert.ok(recommendShots(drink).includes("bev_pour"));
  assert.ok(shotDirection("food_served", food, { aspect: "4:5", lighting: "studio_soft", backdrop: "#fff" }).includes("steel"), "Indian styling for food");
  const sofa = normalizeProductProfile({ name: "Sofa", sizeClass: "large" });
  assert.ok(!recommendShots(sofa).includes("in_hand"), "no in-hand shot for large products");
  assert.equal(normalizeProductProfile({ sizeClass: "huge", viewAngle: "weird" }).sizeClass, "handheld");
  assert.equal(new Set(SHOTS.map((s) => s.id)).size, SHOTS.length);
  const dir = shotDirection("styled_still_life", food, { aspect: "4:5", lighting: "dramatic", backdrop: "#F2C14E" });
  assert.ok(dir.includes("chillies") && dir.includes("#F2C14E") && /hard key light/.test(dir));
  assert.ok(!/softbox/i.test(shotDirection("pedestal", food, { aspect: "4:5", lighting: "studio_soft", backdrop: "#fff" })), "no studio-gear words in set direction");
  console.log("  ok  shot list and direction");

  // Cut-out cleanup: drops a stray logo island and keeps the product
  const W = 200, H = 200;
  const rgba = Buffer.alloc(W * H * 4);
  const paint = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; rgba[i] = 120; rgba[i + 1] = 80; rgba[i + 2] = 40; rgba[i + 3] = a; }
  };
  paint(60, 60, 140, 170, 255); // product
  paint(5, 5, 30, 15, 255); // logo island
  paint(100, 100, 102, 102, 140); // see-through patch inside product
  const refined = await refineCutout(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
  const meta = await sharp(refined).metadata();
  assert.equal(meta.width, 80, "trimmed to the product, logo island dropped");
  assert.equal(meta.height, 110);
  // Multi-part products (earbuds beside their case) keep every sizeable part
  rgba.fill(0);
  paint(20, 60, 120, 160, 255); // case
  paint(150, 120, 175, 150, 255); // earbud (~7% of the case)
  paint(185, 5, 195, 10, 255); // stray speck
  const parts = await sharp(await refineCutout(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())).metadata();
  assert.equal(parts.width, 155, "earbud kept beside the case");
  assert.equal(parts.height, 100, "speck dropped");
  console.log("  ok  cut-out cleanup");

  // Exact packshot: pure white edges for marketplace, right canvas size
  const product = await sharp({ create: { width: 300, height: 400, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
  const white = await renderPackshot({ cutout: product, aspect: "1:1", style: "white" });
  const wm = await sharp(white).metadata();
  assert.deepEqual([wm.width, wm.height], [CANVAS["1:1"].width, CANVAS["1:1"].height]);
  const corner = await sharp(white).extract({ left: 0, top: 0, width: 10, height: 10 }).raw().toBuffer();
  assert.ok(corner.every((v) => v === 255), "marketplace background is pure white");
  console.log("  ok  exact packshot");

  // Guided shot: low fidelity → one corrective reshoot, keep the better
  let calls = 0;
  const prompts: string[] = [];
  const provider = {
    id: "mock",
    async generate(req: any) {
      calls++;
      prompts.push(req.prompt);
      return { ok: true, imageBuffer: await sharp({ create: { width: 64, height: 80, channels: 3, background: "#888" } }).png().toBuffer(), provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  let checks = 0;
  const out = await renderShot({
    shotId: "in_hand", profile: food, settings: { aspect: "4:5", lighting: "studio_soft", backdrop: "#fff" }, aspect: "4:5",
    source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: "g",
    checkFidelity: async () => (++checks === 1 ? { checked: true, score: 4, issues: ["label says Crunchie"] } : { checked: true, score: 9, issues: [] }),
  });
  assert.equal(calls, 2);
  assert.ok(prompts[1].includes("PRODUCT FIDELITY FIX") && prompts[1].includes("Crunchie"));
  assert.equal(out.fidelity, 9);
  assert.equal(out.method, "guided");
  // Exact shot without a cut-out falls back to guided
  const fallback = await renderShot({
    shotId: "marketplace_white", profile: food, settings: { aspect: "1:1", lighting: "studio_soft", backdrop: "#fff" }, aspect: "1:1",
    source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: "g2",
    checkFidelity: async () => ({ checked: true, score: 9, issues: [] }),
  });
  assert.equal(fallback.method, "guided");
  assert.ok(prompts[prompts.length - 1].includes("pure white (#FFFFFF)"));
  console.log("  ok  guided shots and fidelity reshoot");

  // Variations: the second take is a genuinely different photo
  const settings = { aspect: "4:5" as const, lighting: "studio_soft" as const, backdrop: "#E07A5F" };
  const guidedTake = (variation: number) =>
    renderShot({ shotId: "in_hand", profile: food, settings, aspect: "4:5", source: { buffer: product, mimeType: "image/png" }, cutout: null, provider, userId: "u", sessionId: "s", generationId: `v${variation}`, variation, checkFidelity: async () => ({ checked: true, score: 9, issues: [] }) });
  await guidedTake(0);
  assert.ok(!prompts[prompts.length - 1].includes("SECOND TAKE"));
  await guidedTake(1);
  assert.ok(prompts[prompts.length - 1].includes("SECOND TAKE"), "second take asks for a different photo");
  const sweepTake = (variation: number) =>
    renderShot({ shotId: "color_sweep", profile: food, settings, aspect: "4:5", source: { buffer: product, mimeType: "image/png" }, cutout: product, provider, userId: "u", sessionId: "s", generationId: "c", variation });
  assert.ok(!(await sweepTake(0)).buffer.equals((await sweepTake(1)).buffer), "exact second take differs");
  console.log("  ok  variations differ");

  // Scene: the set is built around the product in the frame (edit), then the exact product is put back
  const edits: any[] = [];
  const editProvider = {
    id: "mock",
    async generate(req: any) {
      edits.push(req);
      // A model that keeps the product where it is: return the base image unchanged.
      const base = req.referenceImages[0]?.base64Data;
      const img = base ? Buffer.from(base, "base64") : await sharp({ create: { width: 64, height: 80, channels: 3, background: "#888" } }).png().toBuffer();
      return { ok: true, imageBuffer: img, provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  // A labelled product (stripes), so the "did the product stay put" check has structure to compare.
  const stripes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="200">${Array.from({ length: 10 }, (_, i) => `<rect y="${i * 20}" width="120" height="10" fill="${i % 2 ? "#c33" : "#fff"}"/>`).join("")}</svg>`);
  const labelled = await sharp(stripes).png().toBuffer();
  const scene = await renderShot({ shotId: "styled_still_life", profile: food, settings, aspect: "4:5", source: { buffer: labelled, mimeType: "image/png" }, cutout: labelled, provider: editProvider, userId: "u", sessionId: "s", generationId: "sc" });
  assert.equal(scene.method, "scene");
  assert.equal(edits.length, 1, "one edit when the product stays put");
  assert.equal(edits[0].mode, "edit");
  assert.ok(/built around the product/.test(edits[0].prompt) && /chillies/.test(edits[0].prompt));
  // The model redraws the photo instead of editing: kept only when its label passes the check
  const redrawProvider = {
    id: "mock",
    generate: async () => ({ ok: true, imageBuffer: await sharp({ create: { width: 64, height: 80, channels: 3, background: "#246" } }).png().toBuffer(), provider: "mock", model: "m", estimatedCostCredits: 1 }),
  } as unknown as ImageGenerationProvider;
  const redrawn = await renderShot({
    shotId: "styled_still_life", profile: food, settings, aspect: "4:5", source: { buffer: labelled, mimeType: "image/png" }, cutout: labelled,
    provider: redrawProvider, userId: "u", sessionId: "s", generationId: "rd", artDirector: null,
    checkFidelity: async () => ({ checked: true, score: 8, issues: [], wrongWords: [] }),
  });
  assert.equal(redrawn.method, "guided", "a redrawn scene is reported as AI-drawn");
  assert.equal(redrawn.fidelity, 8);
  console.log("  ok  scene built around the product");

  // Master packshot: recreated when faithful; upload cut-out only when nothing covers the product
  const cutCalls: Buffer[] = [];
  const cutout = async (b: Buffer) => (cutCalls.push(b), product);
  const masterOf = (score: number, obstructed: boolean) =>
    prepareMaster({
      source: { buffer: Buffer.from("upload"), mimeType: "image/png" },
      profile: { ...food, obstructed },
      provider,
      checkFidelity: async () => ({ checked: true, score, issues: score < 8 ? ["label differs"] : [] }),
      cutout,
      userId: "u",
      sessionId: "s",
    });
  const good = await masterOf(9, true);
  assert.equal(good.via, "recreated");
  assert.ok(good.packshot && !cutCalls[cutCalls.length - 1].equals(Buffer.from("upload")), "cut-out made from the recreated packshot");
  const drifted = await masterOf(5, false);
  assert.equal(drifted.via, "upload");
  assert.ok(cutCalls[cutCalls.length - 1].equals(Buffer.from("upload")));
  const held = await masterOf(5, true);
  assert.equal(held.via, "none", "a held product never uses the upload's cut-out");
  assert.equal(held.cutout, null);
  console.log("  ok  master packshot");

  // Shooting is free: photos are private drafts with a preview, and the marketplace image is one photo
  const dataUrl = `data:image/png;base64,${product.toString("base64")}`;
  const baseState = { sourceUrl: dataUrl, masterUrl: dataUrl, cutoutUrl: dataUrl, prepared: true, profile: food, settings, shots: [] as string[] };
  const savedShots: ShotResult[] = [];
  const shootDeps = {
    provider,
    store: async (_u: string, _s: string, id: string) => ({ storagePath: `private/${id}.png`, previewPath: `private/${id}.preview.jpg` }),
    save: async (_u: string, _s: string, r: ShotResult[]) => void savedShots.push(...r),
    view: (r: ShotResult[]) => toPhotoViews(r, async (paths) => new Map(paths.map((p) => [p, `signed://${p}`]))),
    limits: { getBalance: async () => 3, photosToday: async () => 0 },
  };
  const results = await shootShot({ userId: "u", sessionId: "s", shotId: "marketplace_white", variations: 2, state: { ...baseState, results: [] } }, shootDeps);
  assert.equal(results.length, 1, "marketplace main image is a single photo");
  assert.equal(results[0].method, "exact");
  assert.equal(results[0].kept, false, "a new photo is a draft");
  assert.ok(results[0].url.startsWith("signed://") && results[0].url.endsWith(".preview.jpg"), "the browser gets the watermarked preview");
  assert.ok(!("storagePath" in results[0]) && !("previewPath" in results[0]), "storage paths never reach the browser");
  assert.ok(savedShots[0].storagePath && savedShots[0].kept === false && savedShots[0].url === "", "the full file stays private until kept");
  // Limits: a credit is needed to shoot, and free photos are capped per day
  await assert.rejects(
    shootShot({ userId: "u", sessionId: "s", shotId: "marketplace_white", state: { ...baseState, results: [] } }, { ...shootDeps, limits: { getBalance: async () => 0, photosToday: async () => 0 } }),
    (e: unknown) => e instanceof PhotoStudioError && e.status === 402
  );
  const today = (n: number): ShotResult[] => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, shotId: "in_hand", url: "", kept: false, storagePath: `private/d${i}.png`, previewPath: `private/d${i}.preview.jpg`, method: "guided" as const, aspect: "4:5" as const, createdAt: new Date().toISOString() }));
  await assert.rejects(
    assertCanShoot("u", { ...baseState, results: today(FREE_PHOTOS_PER_SHOOT_PER_DAY) }, 1, shootDeps.limits),
    (e: unknown) => e instanceof PhotoStudioError && e.code === "DAILY_LIMIT"
  );
  await assert.rejects(assertCanShoot("u", { ...baseState, results: [] }, 1, { getBalance: async () => 5, photosToday: async () => 60 }), /daily limit/);
  const old: ShotResult = { shotId: "in_hand", url: "https://x/old.png", method: "guided", aspect: "4:5", createdAt: new Date().toISOString() };
  assert.equal(photosInLastDay([old]), 0, "photos from before keep-to-pay don't count against the cap");
  assert.ok(isKept(old), "photos from before keep-to-pay are already the customer's");
  console.log("  ok  free draft photos and limits");

  // Keep: 1 credit per newly kept photo, once; the full file is released; no credits → nothing kept
  const shootRow: { results: ShotResult[] } = { results: [...today(3), old] };
  let balance = 2;
  const paid: number[] = [];
  const lock: WithLockedShoot = async (_u, _s, fn) =>
    fn({
      results: shootRow.results,
      pay: async (amount) => (balance >= amount ? ((balance -= amount), paid.push(amount), true) : false),
      save: async (r) => void (shootRow.results = r),
    });
  const keepDeps = { lock, publish: async (_u: string, _s: string, r: ShotResult) => `https://public/${r.id}.png`, getState: async () => ({ ...baseState, results: shootRow.results }) };
  await assert.rejects(keepPhotos("u", "s", [], keepDeps), /Choose at least one/);
  await assert.rejects(keepPhotos("u", "s", ["d0", "d1", "d2"], keepDeps), (e: unknown) => e instanceof PhotoStudioError && e.status === 402, "not enough credits for three");
  assert.ok(shootRow.results.every((r) => r.kept !== true) && balance === 2, "a refused keep changes nothing");
  assert.deepEqual(await keepPhotos("u", "s", ["d0", "d1", "https://x/old.png", "nope"], keepDeps), { charged: 2 });
  assert.equal(balance, 0);
  const keptNow = shootRow.results.filter((r) => r.kept === true);
  assert.deepEqual(keptNow.map((r) => r.url), ["https://public/d0.png", "https://public/d1.png"], "kept photos get their full public file");
  assert.ok(keptNow.every((r) => r.published && r.keptAt));
  assert.deepEqual(await keepPhotos("u", "s", ["d0", "d1"], keepDeps), { charged: 0 }, "keeping again never charges again");
  assert.deepEqual(paid, [2]);
  const views = await toPhotoViews(shootRow.results, async () => new Map());
  assert.deepEqual(views.map((v) => v.kept), [true, true, false, true]);
  assert.equal(views[0].url, "https://public/d0.png");
  console.log("  ok  keep and pay");

  // New shot types: fashion and beauty get their own lists, and every shot has an example picture
  const kurta = normalizeProductProfile({ name: "Block-print kurta", kind: "fashion", isWearable: true });
  assert.deepEqual(recommendShots(kurta).slice(1, 4), ["fashion_folded", "fashion_worn", "fashion_detail"]);
  const serum = normalizeProductProfile({ name: "Face serum", kind: "beauty", labelText: ["Saffra", "Gel Moisturiser"], look: "a frosted green pump bottle" });
  assert.ok(recommendShots(serum).includes("beauty_texture") && recommendShots(serum).includes("beauty_shelf"));
  assert.deepEqual(serum.labelText, ["Saffra", "Gel Moisturiser"]);
  for (const id of ["detail_macro", "on_the_go", "fashion_folded", "fashion_detail", "fashion_worn", "fashion_flatlay", "fashion_hanger", "beauty_ingredients", "beauty_texture", "beauty_shelf", "beauty_in_use"]) {
    assert.ok(getShot(id), `shot ${id} exists`);
  }
  const missing = SHOTS.filter((x) => !existsSync(`public/images/photo-studio/examples/${x.id}.webp`)).map((x) => x.id);
  assert.deepEqual(missing, [], "every shot has an example picture for the shot picker");
  console.log("  ok  new shot types");

  // Label check: readable wrong words cap the score, unreadable print does not
  assert.equal(scoreFidelity({ score: 9, wrongWords: ["HIGH IN FIEER → HIGH IN FIBER"], issues: [] }).score, WRONG_WORDS_MAX_SCORE);
  assert.equal(scoreFidelity({ score: 9, wrongWords: [], issues: ["slightly warmer"] }).score, 9);
  assert.equal(scoreFidelity({}).checked, false);
  assert.ok(scoreFidelity({ score: 8, wrongWords: ["BOOD → BASED"] }).issues[0].includes("BOOD"));

  // Guided reshoots: wrong words → reshoot naming them → last try on the stronger model → dropped if still wrong
  const models: Array<string | undefined> = [];
  const fixPrompts: string[] = [];
  const countingProvider = {
    id: "mock",
    async generate(req: any) {
      models.push(req.model);
      fixPrompts.push(req.prompt);
      return { ok: true, imageBuffer: await sharp({ create: { width: 64, height: 80, channels: 3, background: "#888" } }).png().toBuffer(), provider: "mock", model: "m", estimatedCostCredits: 1 };
    },
  } as unknown as ImageGenerationProvider;
  const wrong = { checked: true, score: 5, issues: ["label text wrong: FIEER → FIBER"], wrongWords: ["FIEER → FIBER"] };
  const guidedInput = {
    shotId: "flat_lay", profile: serum, settings, aspect: "4:5" as const, source: { buffer: product, mimeType: "image/png" }, cutout: null,
    provider: countingProvider, userId: "u", sessionId: "s", generationId: "lbl", artDirector: null,
  };
  await assert.rejects(renderShot({ ...guidedInput, checkFidelity: async () => wrong }), LabelDriftError, "a shot whose label stays wrong is never delivered");
  assert.equal(models.length, MAX_GUIDED_ATTEMPTS);
  assert.deepEqual(models, [undefined, undefined, photoProImageModel()], "only the last try uses the stronger model");
  assert.ok(fixPrompts[1].includes("FIEER → FIBER") && fixPrompts[0].includes('"Saffra", "Gel Moisturiser"'), "label words go in as text; wrong ones are named in the reshoot");
  models.length = 0;
  let labelChecks = 0;
  const rescued = await renderShot({ ...guidedInput, checkFidelity: async () => (++labelChecks < 3 ? wrong : { checked: true, score: 9, issues: [], wrongWords: [] }) });
  assert.equal(rescued.fidelity, 9, "the stronger model's clean result is delivered");
  // Shape drift without wrong words still delivers the best attempt (as before)
  const soft = await renderShot({ ...guidedInput, checkFidelity: async () => ({ checked: true, score: 6, issues: ["lid slightly taller"], wrongWords: [] }) });
  assert.equal(soft.fidelity, 6);
  console.log("  ok  label check and reshoots");

  // Art director: the written scene replaces the template; placement moves the pasted product
  const brief = { scene: "On a dark granite kitchen counter beside a steel kadai of steaming upma with curry leaves, the product on the left third, soft window light from the right.", placement: "left" as const };
  const briefed: any[] = [];
  const directed = await renderShot({
    shotId: "food_kitchen", profile: food, settings, aspect: "4:5", source: { buffer: labelled, mimeType: "image/png" }, cutout: labelled,
    provider: { ...editProvider, generate: async (req: any) => (briefed.push(req), editProvider.generate(req)) } as unknown as ImageGenerationProvider,
    userId: "u", sessionId: "s", generationId: "ad",
    artDirector: async (input) => {
      assert.equal(input.method, "scene");
      assert.equal(input.lighting, null, "default lighting leaves the light to the art director");
      return brief;
    },
  });
  assert.equal(directed.method, "scene");
  assert.ok(briefed[0].prompt.includes("steel kadai of steaming upma") && !briefed[0].prompt.includes("steel dabba"), "brief used instead of the template");
  const centred = scenePlacement("4:5", 300, 600, "surface", 0);
  const leftSide = scenePlacement("4:5", 300, 600, "surface", 0, "left");
  const mirrored = scenePlacement("4:5", 300, 600, "surface", 1, "left");
  assert.ok(leftSide.left < centred.left && mirrored.left > centred.left, "placement follows the brief; the second take mirrors it");
  assert.equal(parseShotBrief('{"scene":"too short","placement":"left"}'), null);
  assert.equal(parseShotBrief(JSON.stringify(brief))?.placement, "left");
  const sceneRules = artDirectorPrompt({ shot: getShot("food_kitchen")!, method: "scene", profile: food, settings, template: "t", lighting: null, person: null });
  const guidedRules = artDirectorPrompt({ shot: getShot("on_the_go")!, method: "guided", profile: food, settings, template: "t", lighting: "warm low golden-hour sunlight", person: "a woman aged 25-40", variation: 1 });
  assert.ok(/MUST stand upright/.test(sceneRules) && !/SECOND TAKE/.test(sceneRules));
  assert.ok(/lying on its side/.test(guidedRules) && /golden-hour/.test(guidedRules) && /a woman aged 25-40/.test(guidedRules) && /SECOND TAKE/.test(guidedRules));
  // A failed art director never fails the shot
  const noBrief = await renderShot({ ...guidedInput, artDirector: async () => { throw new Error("offline"); }, checkFidelity: async () => ({ checked: true, score: 9, issues: [] }) });
  assert.equal(noBrief.method, "guided");
  console.log("  ok  art-directed scenes");

  // Edit: only this shoot's photos, brief + product attached, added next to the original
  const shotUrl = "mem://shot-1";
  const editState = {
    sourceUrl: dataUrl, masterUrl: dataUrl, cutoutUrl: dataUrl, prepared: true, profile: food, settings, shots: [],
    results: [
      { shotId: "food_scoop", url: shotUrl, method: "guided" as const, aspect: "4:5" as const, createdAt: "t" },
      { id: "draft-1", shotId: "food_scoop", url: "", kept: false, storagePath: "private/draft-1.png", previewPath: "private/draft-1.preview.jpg", method: "guided" as const, aspect: "4:5" as const, createdAt: "t" },
    ],
  };
  const editReqs: any[] = [];
  const photoEditProvider = {
    ...provider,
    generate: async (req: any) => (editReqs.push(req), { ok: true, imageBuffer: product }),
  } as unknown as ImageGenerationProvider;
  const saved: any[] = [];
  const draftsRead: string[] = [];
  const editDeps = {
    provider: photoEditProvider,
    loadImage: async () => ({ buffer: product, mimeType: "image/png" }),
    loadDraft: async (path: string) => (draftsRead.push(path), product),
    writeBrief: async () => "Left hand holds the jar at chest height; right index finger points at the label.",
    checkFidelity: async () => ({ checked: true, score: 9, issues: [] }),
    store: async (_u: string, _s: string, id: string) => ({ storagePath: `private/${id}.png`, previewPath: `private/${id}.preview.jpg` }),
    save: async (_u: string, _s: string, r: any[]) => void saved.push(...r),
    view: (r: ShotResult[]) => toPhotoViews(r, async (paths) => new Map(paths.map((p) => [p, `signed://${p}`]))),
    limits: { getBalance: async () => 1, photosToday: async () => 0 },
  };
  await assert.rejects(
    editPhoto({ userId: "u", sessionId: "s", photoId: "https://evil.example/x.png", request: "point at it", state: editState }, editDeps),
    /isn't part of this shoot/,
    "only photos from this shoot can be edited"
  );
  await assert.rejects(editPhoto({ userId: "u", sessionId: "s", photoId: shotUrl, request: "   ", state: editState }, editDeps), /Say what/);
  assert.equal(editReqs.length, 0, "rejected edits never reach the image model");
  const edited = await editPhoto({ userId: "u", sessionId: "s", photoId: shotUrl, request: "make her point at it", state: editState }, editDeps);
  assert.ok(edited.url.startsWith("signed://") && edited.kept === false, "an edited photo is a free draft with a preview");
  assert.equal(edited.shotId, "food_scoop", "edited photo stays with its shot");
  assert.equal(edited.editedFrom, shotUrl);
  assert.equal(edited.editRequest, "make her point at it");
  assert.equal(saved.length, 1, "saved as a new photo, original kept");
  assert.ok(saved[0].storagePath && saved[0].kept === false);
  // Editing a draft works from its private full file, never from the watermarked preview
  await editPhoto({ userId: "u", sessionId: "s", photoId: "draft-1", request: "warmer light", state: editState }, editDeps);
  assert.deepEqual(draftsRead, ["private/draft-1.png"]);
  editReqs.length = 1;
  const sent = editReqs[0];
  assert.equal(sent.mode, "edit");
  assert.deepEqual(sent.referenceImages.map((r: any) => r.role), ["design_inspiration", "product_packshot"], "base photo + exact product attached");
  assert.ok(sent.prompt.includes("right index finger points at the label") && sent.prompt.includes("make her point at it"));
  // Low fidelity → one corrective retry, keeps the better one
  editReqs.length = 0;
  let editChecks = 0;
  await editPhoto(
    { userId: "u", sessionId: "s", photoId: shotUrl, request: "scoop", state: editState },
    { ...editDeps, checkFidelity: async () => (++editChecks === 1 ? { checked: true, score: 4, issues: ["label says Helth"] } : { checked: true, score: 9, issues: [] }) }
  );
  assert.equal(editReqs.length, 2, "one retry when the product drifted");
  assert.ok(editReqs[1].prompt.includes("label says Helth"));
  assert.ok(!editPrompt("same", "same").includes("client's own words"), "no duplicate request when brief falls back to it");
  console.log("  ok  photo edit");
  console.log("photo-studio tests passed");
}
void main();
