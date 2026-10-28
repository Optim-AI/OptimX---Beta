# Poster templates: text-free scenes, product cut-outs, code-rendered type

**Status:** Design — for review before building · **Date:** 2026-10-28
**Scope:** Brand Studio single posters first; carousels and resize reuse it later.
**Related:** `scripts/poster-eval/` (stress test), `lib/creative-studio/poster-generation/` (current engine), Brand Kit (`lib/brand-kit/`).

---

## 1. Why

The poster stress test (8 ad briefs, independent judge) puts posters at **~5–6 / 10**. The failures that remain after the prompt, copy and ad-format fixes all come from asking one image model to do everything:

| Failure (seen in the eval and the live test) | Cause |
|---|---|
| Garbled or invented text ("Proin", "30% Cr offer"), paraphrased lines | The image model draws the text |
| Fonts only approximate the brand; CTA buttons and badges vary in quality | Typography isn't real typography |
| Layout differs every time; the offer or rating gets buried | No layout system — the model invents one per image |
| Product loses parts (serum dropper), lighting mismatch | The model redraws the product |
| 1:1 and 9:16 versions of "the same ad" don't match | Each size is a separate generation |
| Every text edit costs a credit and may change the image | Text is baked into the pixels |

Human designers avoid all of these the same way: **real product photography, real type, and a grid/template**. This design splits the poster into layers so each is made by the right tool.

## 2. The idea in one picture

```
            ┌──────────────── Template (per ad goal × aspect) ────────────────┐
            │ zones: headline · supporting · CTA · badge · labels · logo ·    │
            │        product box · "calm area" the scene must leave empty     │
            └─────────────────────────────────────────────────────────────────┘
                   │                    │                         │
     ① Scene (AI)  ▼     ② Product (cut-out)  ▼        ③ Type & marks (code)  ▼
  text-free background,      user's real photo,         headline, supporting, CTA,
  respects calm areas,       background removed,        badge, labels, logo — brand
  no product (cut-out mode)  shadow + colour match      fonts, exact colours, auto-fit
                   └──────────────┬─────┴──────────────────────┘
                                  ▼
                     ④ Composition renderer (server)
              sharp (image layers) + opentype.js glyph paths (type & vectors)
                                  ▼
               final PNG/JPG  +  composition manifest (editable layers)
```

- **Only ① costs an image credit.** ② is cached per product photo. ③ and ④ are deterministic and take well under a second, so text edits, colour tweaks and many resizes are free and instant.
- Text is **correct by construction**: what the user approved is what renders, in the brand's fonts.

## 3. Templates

### 3.1 What a template is

A template is a TypeScript definition (in the repo, versioned, reviewed like code) describing one proven ad layout for one or more ad goals, with a layout per aspect ratio.

```ts
// lib/creative-studio/poster-templates/types.ts (proposed)
type Box = { x: number; y: number; w: number; h: number };       // 0–1 of the canvas

type PosterTemplate = {
  id: string;                         // "offer-hero"
  version: number;
  label: string;                      // shown on thumbnails
  goals: AdFormatKind[];              // offer, launch, social_proof, …
  territories?: CreativeTerritory[];  // concept routes it suits
  background: "scene" | "brand_solid" | "split";   // what fills the canvas
  productMode: "cutout" | "in_scene" | "none";     // who places the product
  layouts: Partial<Record<PosterAspectRatio, TemplateLayout>>;
};

type TemplateLayout = {
  product?: { box: Box; anchor: "bottom" | "center"; shadow: "soft" | "contact" | "none" };
  calmAreas: Box[];                   // regions the scene must keep empty and low-detail
  headline: TextSlot;
  supporting?: TextSlot;
  labels?: TextSlot[];                // e.g. Before / After
  badge?: BadgeSlot;                  // offer burst, rating seal, ribbon
  cta?: CtaSlot;
  logo?: { box: Box; variant: "auto" | "light" | "dark" };
  scrim?: { box: Box; kind: "gradient" | "solid" | "auto" };   // legibility layer
  safeArea: Box;                      // nothing important outside it (9:16 UI zones)
};

type TextSlot = {
  box: Box;
  align: "left" | "center" | "right";
  fontRole: "heading" | "body";
  colorRole: "primary" | "text" | "background" | "accent" | "auto";
  minSize: number; maxSize: number;   // in % of canvas height — auto-fit picks the largest that fits
  maxLines: number;
  case?: "upper" | "none";
  tracking?: number;
};
type BadgeSlot = TextSlot & { shape: "burst" | "seal" | "pill" | "ribbon" | "card"; fill: "accent" | "primary" };
type CtaSlot = TextSlot & { style: "solid_pill" | "outline_pill" | "block"; fill: "primary" | "accent" };
```

### 3.2 Starter library (v1 — 10 templates × 4:5 / 1:1 / 9:16, 1.91:1 where it makes sense)

| Template | Goals | Background | Product | Notes |
|---|---|---|---|---|
| **Offer Hero** | offer | brand_solid (+ optional AI texture) | cut-out, large | Huge offer number, burst badge, solid CTA. Needs **no scene** → fast and cheap. |
| **Product Hero Scene** | launch, awareness | scene | cut-out on a generated surface | Headline band top; product on a plinth/surface the scene leaves empty. |
| **Split Panel** | launch, feature, offer | split (brand panel + scene) | cut-out or in-scene | Text on solid panel = perfect legibility. |
| **Before / After** | before_after | scene ×2 (two halves) | cut-out at the divide | Labels rendered in code; the two halves are generated as one image with a clear split. |
| **Rating Card** | social_proof | brand_solid or soft scene | cut-out | Large rating seal + stars + short quote card. |
| **Feature Callouts** | feature | brand_solid or studio scene | cut-out, centre | 2–3 callout labels with leader lines from badges/features. |
| **Festive Frame** | festive | scene with occasion décor | cut-out as the gift | "Order by" ribbon; décor framed around calm centre. |
| **Lifestyle Story** | launch, awareness, feature | scene | **in_scene** (hands, use) | Bottom gradient scrim + headline; product placed by the model (see §5). |
| **Minimal Editorial** | launch, awareness | brand_solid / soft scene | cut-out, small | Big type, lots of whitespace — "premium" look. |
| **Statement** | awareness | brand_solid | none / small | Typography-led brand line, for brands without a product photo (services). |

Templates are where the "human touch" lives, so **the v1 layouts should be designed by a graphic designer** (Figma → coordinates), not invented in code. Each template gets 2–3 art-direction variants (alignment, colour blocking) so posters don't look samey.

### 3.3 Choosing templates

```
ad goal (from the composer)  ──►  candidate templates (goals[] match)
concept territory             ──►  rank (territories[] match, brand-kit fit, product photo available?)
aspect / placement            ──►  must have a layout for it
```

The concept director keeps producing creative ideas (scene, mood, story); a concept is now **paired with a template** — the idea decides the scene, the template decides the layout.

## 4. Product cut-outs

**When:** once per product photo, the first time it's used; cached by a hash of the source URL.

**Pipeline:** source photo → background removal → trim to content → quality checks (edge noise, coverage %, alpha sanity) → store PNG with alpha in `campaign-assets/product-cutouts/{userId}/{hash}.png` → record in a `product_cutouts` table (source hash, URL, width/height, provider, quality score).

**Provider (decision needed):** behind an interface `CutoutProvider.remove(image) → PNG`.

| Option | Pros | Cons |
|---|---|---|
| Hosted product cut-out API (e.g. Photoroom, remove.bg) | Best quality on products, no infra | Per-image cost; external data processor |
| Hosted open model (e.g. BiRefNet / rembg via Replicate) | Good quality, cheaper | Cold starts; still external |
| Self-hosted (`@imgly/background-removal-node`, ONNX) | No per-image cost, data stays in-house | Large bundle for serverless; slower; ops |
| Gemini image edit on a flat background, then key | Already integrated | Unreliable edges; not a true alpha matte |

Recommendation: start with a hosted product-specialised API behind the interface (cut-outs are cached, so volume is per product, not per poster), and keep the option to self-host later. **Check current pricing and data-processing terms before choosing.**

**Hard cases:** glass and transparent bottles (the serum), hair/fur, white products on white. Quality checks flag low-confidence cut-outs → that poster falls back to `in_scene` mode, and the product card asks the user for a cleaner photo.

**Making a cut-out look photographed, not pasted:**
- Contact shadow + soft drop shadow rendered from the alpha mask (sharp blur/offset), direction taken from the scene's lighting hint.
- Colour match: nudge the cut-out's white balance/exposure toward the scene's average around the product box.
- Optional **harmonise pass** (later phase): an image-model edit at low strength that relights the product edges only, followed by a fidelity check against the cut-out (label/shape must match) — skipped if the check fails.

## 5. Scene generation (text-free)

A new compiler, `compileSceneBrief(spec, template, layout)`, alongside the current art-director brief:

- Keeps everything about mood, setting, light, camera, palette, brand colours, theme cues.
- **Removes all text instructions** and adds: *"No text, letters, numbers, logos, labels or watermarks anywhere."*
- Turns template geometry into plain language: *"Keep the top 35% calm and low-detail (soft wall, sky or gradient) — it will hold the headline."* / *"Leave a clear, softly lit surface in the lower centre for the product; do not place any product there."*
- `productMode: "in_scene"` → the product photo is attached exactly as today, but still with no text.
- `background: "brand_solid"` → no scene call at all (optionally a cheap texture/gradient image).

Verification after generation (cheap, deterministic + one QC call):
- **Calm-area check:** edge density / variance inside each calm area (sharp); too busy → retry once, else add a stronger scrim.
- **No-text check:** QC model asked only "is there any text or logo?"; text found → retry once.
- Product fidelity check only for `in_scene`.

## 6. Composition renderer

`renderPoster({ template, layout, scene, cutout, copy, brandKit, logo, size }) → { image, manifest }`

- **Image layers with `sharp`:** scene (cover-fit to canvas), scrim/gradient, product cut-out + shadows, logo bitmap.
- **Type and vector layers as SVG** (built in Phase 1 with opentype.js instead of Satori: the renderer already computes every line break and position, so it draws glyph outlines as SVG paths directly — no layout engine or WASM in the serverless bundle; sharp rasterises and composites): headline, supporting, labels, badge shapes, CTA button, star icons, leader lines.
- **Auto-fit:** for each text slot, binary-search the largest font size between min/max that fits the box within `maxLines`; balanced line breaks; never shrink below `minSize` — if it doesn't fit, flag "headline too long" back to the message step instead of rendering tiny text.
- **Legibility:** sample the scene's luminance under each text box; pick text colour by WCAG contrast (≥ 4.5:1 for supporting text, ≥ 3:1 for large headlines) from the brand palette roles; if no brand colour passes, strengthen the scrim.
- **Logo:** pick light/dark variant by background luminance; never stretched.
- **Fonts:** Brand Kit heading/body fonts. Google Fonts are fetched once as TTF and cached in storage; custom brand fonts need TTF/OTF/WOFF (opentype.js doesn't read WOFF2 — convert on upload or ask for TTF); fallback = closest Google font by category. Noto fonts bundled for Indic scripts so regional-language posters work.
- **Output size:** 2K per aspect (e.g. 1856×2304 for 4:5).
- **Manifest:** JSON of every layer (asset URLs, boxes, resolved font sizes/colours, copy). Stored on the asset; it is what makes edits and resizes free.

Performance target: < 1 s per render on a serverless function; renders are pure, so they can be cached by manifest hash.

## 7. How it plugs into the current engine

```
brief → strategy → concepts → [choose concept + template] → spec
     → cut-out (cached) → scene (AI, 1 credit, or none) → render → store → QC
```

| Area | Change |
|---|---|
| `types.ts` | `PosterTemplate`, `TemplateLayout`, `CompositionManifest`; asset gains `sceneUrl`, `cutoutUrl`, `templateId`, `manifest`. Existing `imageUrl` stays the final poster. |
| `generation/` | New `compileSceneBrief`; `generatePostersForSession` branches on `POSTER_TEMPLATES` flag: template path vs current path. |
| New `poster-templates/` | Template definitions, selector, renderer, auto-fit, legibility, fonts. |
| New `product-cutouts/` | Provider interface, cache table, quality checks. |
| QC | Text accuracy is guaranteed; QC focuses on scene artefacts, calm areas, product fidelity (`in_scene`) and overall design. |
| Iteration | Text/colour/layout edits → re-render manifest (free). Visual edits → edit the **scene only** (existing iteration code), then re-render. |
| Carousel | One template family across all slides = consistent series by construction. |
| Credits | 1 credit per scene (as now). Re-renders, text edits and cut-outs: free. Resize: free when the scene can be re-cropped; 1 credit when a new scene is needed. |
| UI | Directions show **template thumbnails rendered instantly** with the product cut-out and approved copy on a brand-colour background (free) — the "routes as thumbnails" step from the research. Results get "Edit text" (instant) and "Make all sizes". |

The current path stays behind the flag until the eval shows the template path is better.

## 8. Resize ("make all sizes")

- Same template, layout for the new aspect, same copy and cut-out → re-render.
- Scene: re-crop around the product/calm areas when the new aspect fits inside the scene (4:5 ↔ 1:1); otherwise extend the scene with an image-model outpaint (1 credit) — or generate the scene at the tallest aspect first so other sizes are crops.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Composited products look pasted | Shadows from alpha, colour match, scene leaves a lit surface, optional harmonise pass; `in_scene` templates for lifestyle shots. |
| Cut-out fails (glass, white-on-white) | Quality score → fall back to `in_scene`; ask for a better photo. |
| Posters look templated / samey | Designer-made variants per template, brand-kit styling, concept-driven scenes, rotate variants across a session. |
| Image model still adds text to scenes | Explicit no-text instruction + text QC + one retry; scrims cover minor marks in text zones. |
| SVG/librsvg limits (no blend modes, limited filters) | Effects done in sharp; SVG only for type and simple vectors. |
| Font licensing for custom brand fonts | Use only fonts the user uploads/owns or Google Fonts; don't scrape font files from sites without consent. |
| Serverless limits (memory/time) | Renders are small; cut-outs are async and cached; heavy models stay off the request path. |

## 10. How we'll know it worked

Extend the eval (`scripts/poster-eval/`) with a template mode and run the same 8 briefs, blind A/B against the current pipeline.

| Metric | Today (run 2) | Target |
|---|---|---|
| Text exactly right | 67% | **100%** (by construction) |
| Craft | 4.9 | ≥ 6.5 |
| Average ad score | 5.3 | ≥ 7 |
| Would ship as-is | 29% | ≥ 50% |
| Briefs with ≥ 1 shippable poster | 50% | ≥ 80% |
| Text edit cost / time | 1 credit, ~20 s | 0 credits, < 1 s |

## 11. Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 — Renderer + 3 templates** (~1 week) | Renderer (sharp + opentype.js, auto-fit, legibility, fonts), cut-out provider + cache, scene brief, flag. Templates: Offer Hero, Product Hero Scene, Split Panel (4:5, 1:1, 9:16). | Eval on offer/launch/feature cases beats current path in blind A/B; 100% text accuracy. |
| **2 — Library + UI** (~1 week) | Remaining 7 templates, template thumbnails as routes, instant text edits, brand fonts from Brand Kit, Indic fonts. | Full 8-case eval meets targets; usability pass in the app. |
| **3 — Sizes, carousel, polish** (~1 week) | Make all sizes, carousel on templates, harmonise pass, QC rework, remove the flag. | Default for all new posters; legacy path kept for old sessions. |

## 12. Decisions needed before building

1. **Cut-out provider** — hosted API (recommended to start) vs self-hosted; budget per product photo.
2. **Template design** — commission a designer for the v1 layouts (recommended), or start from in-house layouts and refine.
3. **Resize credits** — free crops + 1 credit for new scenes (proposed)?
4. **Regional languages in v1** — ship Indic font support in Phase 2 (proposed) or later?
5. **Rollout** — per-user flag for internal testing first, then all new sessions.

## Phase 1 build notes

- Code: `lib/creative-studio/poster-templates/` (types, templates, selector, renderer, text fit, fonts, palette, scene brief) and `lib/creative-studio/product-cutouts/` (provider interface, Photoroom / remove.bg adapters, quality check, per-user cache table `product_cutouts`).
- Turn on with `POSTER_TEMPLATES=1` plus `PHOTOROOM_API_KEY` or `REMOVE_BG_API_KEY`. Without a key (or when a cut-out fails the quality check) posters use the current full-AI path. `CUTOUT_PROVIDER=local` enables a basic flood-fill cut-out for clean white-background packshots only — for evals, not production.
- opentype.js quirks handled: its GSUB engine throws on some Google fonts and its `toPathData` can emit `NaN`, so glyphs are laid out (advance + kerning) and serialised by our own code. `sharp().extract().stats()` reads the source image, so region sampling extracts to a buffer first.
- Offer Hero needs no image-model call (brand colour + cut-out + type); it still costs 1 credit like every poster.
- Tests: `npm run test:poster-templates`; flag-path cases in `generation.test.ts`. Eval: `EVAL_MODE=templates` in `scripts/poster-eval/run.ts`.

- **Concept-aware choice:** `conceptTemplateFit` sends concepts with people, the product in use, sequences/multi-panel layouts, demonstrations or metaphors to the full-AI path. Otherwise the concept's territory ranks the templates (product hero → Split Panel; lifestyle/ritual → Product Hero Scene; typography/graphic → Offer Hero). Offer ads lead with Offer Hero, and variants never repeat a template. Scene briefs carry the concept's story and props (a served bowl, ingredients) beside the empty stage.
- **Harmonise pass** (scene templates; `POSTER_TEMPLATE_HARMONIZE=0` turns it off, saving one image call): the image model relights and grounds the composited product. The result is rejected if the product region or the scene changed structurally. The exact cut-out is then pasted back, colour-graded to the new light, and split layouts get their brand panel restored, so the label and panel never come from the model.
- QC is told when a poster came from a template: it judges layout on legibility and hierarchy rather than against the concept's composition notes, and fails pasted-looking products.
