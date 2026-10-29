# Photo Studio — design

Upload one product photo; get a product photo shoot: marketplace packshots, studio
shots, styled still lifes, lifestyle scenes, in-hand and on-model shots.

## What a real product shoot covers (research)

A professional e-commerce shoot is planned as a **shot list**, typically 5–8 images per
product (main image, alternate studio shots, detail/scale, lifestyle):

| Shot | Purpose | How a studio does it |
|---|---|---|
| Main packshot | Marketplace main image (Amazon: pure white RGB 255, product ≈ 85% of frame, no text) | Seamless white sweep, two softboxes at ~45°, background lit separately, soft contact shadow |
| Colour sweep | Brand-consistent catalogue / PDP | Seamless coloured paper sweep, soft shadow |
| Reflection | Premium / glossy products | Product on white or black acrylic for a clean mirror reflection |
| Styled still life | PDP gallery, social | Product with props/ingredients that tell what it is |
| Pedestal / sculptural | Premium, beauty, gifting | Plinths, arches, single-colour set, directional light |
| Levitation / splash | Freshness, energy, ads | Product with ingredients frozen mid-air (high-speed flash) |
| Lifestyle in context | Show use, belonging | Product in its real environment (kitchen, desk, bathroom, outdoors) |
| In hand | Scale and handling (42% of shoppers try to judge size from images; 37% of sites show no scale shot — Baymard via Snappr) | Hand model holding/using the product |
| On model | Aspiration, fit | Model using/holding/wearing the product |
| Flat lay | Bundles, contents, overhead social | Top-down arrangement on a surface |

Lighting vocabulary: soft key + fill (clean e-commerce), single hard light (dramatic),
window light (natural lifestyle), golden hour (warm lifestyle), rim light (dark products).

## What competitors do

Photoroom, Pebblely, Mokker, Claid, Flair, Booth, Botika: upload → background removal →
themed scenes/templates, some with virtual models. The recurring failure is **product
fidelity**: Photoroom's own benchmark (850 products, 3,400 generations) found logo/text
distortion was the most common failure (20%), and the best model passed a fidelity check
only ~38% of the time even with safeguards. The tools that hold up treat the real photo
as a **locked layer** and generate only the scene around it.

## Our approach — three render methods

1. **Exact (composite)** — deterministic: background removed from the real photo, placed
   on a white/colour sweep with a soft contact shadow (and optional mirror reflection).
   Pixel-identical product. Used for marketplace packshot, colour sweep, reflection.
2. **Exact in a scene (built around the product)** — the real cut-out is placed in the
   frame first and the image model edits that frame, building the set *around* it
   (surface under its base, perspective at the product's height, contact shadow,
   reflections, matching light). A structural-similarity guard rejects any attempt
   that moved or redrew the product (one retry), and the exact cut-out is put back
   colour-graded. If both attempts move it, the fallback shoots an empty set and
   composites + relights the product. Used for styled still life, pedestal,
   levitation, lifestyle in context.
3. **Guided (AI with product reference)** — for shots where the product must be held or
   used (in hand, on model, lifestyle in use), the image model renders the whole scene
   from the product photo. A vision **fidelity check** compares the result with the
   original (shape, colours, label/logo, text) and regenerates once if it drifted,
   keeping the more faithful attempt.

**Master packshot.** Uploads are rarely studio-clean (a hand holding the product,
clutter, phone light). At upload the image model recreates the product *alone* as a
clean packshot on white; a fidelity check (≥ 8/10 against the upload, one corrective
retry) guards label, logo, text and shape. Its cut-out feeds methods 1–2 and the
packshot is the product reference for method 3. If the recreation drifts, the
upload's own cut-out is used — unless the product read says it's held or overlapped,
in which case methods 1–2 fall back to method 3.

Background removal: Photoroom or remove.bg when their key is set, otherwise the free
built-in ISNet model (`CUTOUT_PROVIDER=none` turns it off).

**Variations.** The second take is a different photo: AI shots get a "second take"
direction (different set/props/light, or angle/framing for people shots) and the
product sits off-centre; exact shots use a paler sweep or a deep-toned reflection set.
The marketplace image is always one photo.

## Flow

1. **Upload** a product photo (or pick one from the brand's catalogue).
2. **Product read** — vision analysis: what it is, category, material/finish (glossy,
   matte, glass, metal, fabric), size class, colours, where it's used, who uses it.
3. **Shot list** — recommended shots for this product with their purpose (marketplace,
   PDP, social, ads), editable: pick shots, variations per shot, aspect ratio
   (1:1 marketplace, 4:5 feed, 9:16 story), lighting mood, backdrop colour (brand
   colours), model preferences for people shots.
4. **Shoot** — shots render two at a time with progress. Free while Photo Studio is in
   beta (`PHOTO_STUDIO_CHARGES` in `lib/photo-studio/shoot.ts`); afterwards 1 image
   credit per photo kept.
5. **Review** — gallery grouped by shot, full-screen viewer with feed previews,
   download, reshoot a shot. The shoot is saved (creative_studio_sessions,
   session_type "photo") and appears in Generated Contents.
