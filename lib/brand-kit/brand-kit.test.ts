/**
 * Brand Kit tests: website extraction (offline fixtures) + input sanitising.
 * Run: npx tsx --tsconfig tsconfig.json lib/brand-kit/brand-kit.test.ts
 */

import {
  cleanFontFamily,
  extractBrandKitFromWebsite,
  googleFontFamilies,
  primaryFamilyFromStack,
  rankBrandColors,
  type BrandFetchText,
} from "./extract";
import { EMPTY_IDENTITY, normalizeHex, sanitizeBrandKitInput } from "./types";
import { fillKitFromSnapshot, isMeaningfulSnapshot, kitInputFromSnapshot, kitToSnapshot } from "./snapshot";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const HTML = `<!doctype html><html><head>
<title>FuelCo | High-protein breakfast</title>
<meta property="og:site_name" content="FuelCo">
<meta name="theme-color" content="#1F3A8A">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"FuelCo","logo":"https://cdn.fuelco.test/logo.svg"}</script>
<style>:root{--brand-primary:#1f3a8a;--brand-accent:#f59e0b;--font-display:"Playfair Display", Georgia, serif}</style>
</head><body>
<header><a href="/" class="site-logo"><img src="/img/fuelco-logo.svg" alt="FuelCo logo"></a></header>
<h1>Fuel your mornings</h1>
<div style="background-color:#F59E0B;color:#fff">Offer</div>
</body></html>`;

const CSS = `
@import url("/assets/extra.css");
body{font-family:__Inter_a1b2c3,__Inter_Fallback_a1b2c3,system-ui,sans-serif;color:#111827;background:#FFFFFF}
h1,h2,.hero-title{font-family:var(--font-display);color:#1f3a8a}
.btn-primary{background-color:#1F3A8A;color:#ffffff;border-color:#1e3a8a}
.btn-primary:hover{background-color:#1e3a8a}
.badge{background:#f59e0b}
.card{background:#ffffff;border:1px solid #e5e7eb}
footer{background-color:#111827;color:#f9fafb}
`;
const EXTRA_CSS = `@font-face{font-family:"FuelCo Sans";src:url(/fonts/fuelco-sans.woff2) format("woff2")}
.caption{font:500 0.875rem/1.4 "FuelCo Sans", sans-serif}`;

const fixtureFetch: BrandFetchText = async (url, kind) => {
  if (kind === "html") return { url: "https://fuelco.test/", body: HTML };
  if (url.endsWith("/assets/site.css")) return { url, body: CSS };
  if (url.endsWith("/assets/extra.css")) return { url, body: EXTRA_CSS };
  return null;
};

async function run() {
  // ── helpers
  assert(cleanFontFamily("__Inter_a1b2c3") === "Inter", "next/font family unwrapped");
  assert(cleanFontFamily("__Inter_Fallback_a1b2c3") === null, "next/font fallback dropped");
  assert(cleanFontFamily("system-ui") === null, "system fonts ignored");
  assert(
    primaryFamilyFromStack("var(--font-display)", new Map([["--font-display", '"Playfair Display", serif']])) ===
      "Playfair Display",
    "CSS variable resolved"
  );
  const g = googleFontFamilies("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter");
  assert(g.join(",") === "Playfair Display,Inter", "Google Fonts families parsed");
  assert(normalizeHex("#ABC") === "#aabbcc", "short hex expanded");

  const ranked = rankBrandColors([
    { hex: "#1f3a8a", weight: 10, use: "other" },
    { hex: "#1e3a8a", weight: 3, use: "background" },
    { hex: "#f59e0b", weight: 4, use: "background" },
    { hex: "#ffffff", weight: 6, use: "background" },
    { hex: "#111827", weight: 5, use: "text" },
  ]);
  assert(ranked[0].hex === "#1f3a8a" && ranked[0].role === "primary", "most used chromatic colour is primary");
  assert(ranked.filter((c) => c.hex === "#1e3a8a").length === 0, "near-identical blues merged");
  assert(ranked.find((c) => c.role === "background")?.hex === "#ffffff", "background role");
  assert(ranked.find((c) => c.role === "text")?.hex === "#111827", "text role");

  // ── full extraction
  const ex = await extractBrandKitFromWebsite("https://fuelco.test", fixtureFetch);
  assert(ex.name === "FuelCo", `site name (${ex.name})`);
  assert(ex.stylesheetsRead === 2, `linked + @imported stylesheets read (${ex.stylesheetsRead})`);
  assert(ex.fonts.heading?.family === "Playfair Display", `heading font (${ex.fonts.heading?.family})`);
  assert(ex.fonts.heading?.source === "google", "heading font from Google Fonts");
  assert(ex.fonts.body?.family === "Inter", `body font (${ex.fonts.body?.family})`);
  const custom = ex.fonts.all.find((f) => f.family === "FuelCo Sans");
  assert(custom?.source === "custom" && custom.url === "https://fuelco.test/fonts/fuelco-sans.woff2", "custom @font-face found with file URL");

  const primary = ex.colors.find((c) => c.role === "primary");
  assert(primary?.hex === "#1f3a8a", `primary colour (${primary?.hex})`);
  assert(ex.colors.find((c) => c.role === "secondary")?.hex === "#f59e0b", "secondary colour");
  assert(ex.colors.find((c) => c.role === "background")?.hex === "#ffffff", "background colour");

  assert(ex.logoCandidates[0]?.url === "https://cdn.fuelco.test/logo.svg", "structured-data logo ranked first");
  assert(ex.logoCandidates.some((c) => c.url === "https://fuelco.test/img/fuelco-logo.svg"), "header logo found");

  // Unreachable stylesheets degrade to warnings, not failures
  const partial = await extractBrandKitFromWebsite("https://fuelco.test", async (url, kind) =>
    kind === "html" ? { url: "https://fuelco.test/", body: HTML } : null
  );
  assert(partial.warnings.some((w) => w.includes("Could not read stylesheet")), "missing CSS warned");
  assert(partial.fonts.heading?.family === "Playfair Display", "Google + inline CSS still give fonts");

  // ── sanitising editor input
  const ok = sanitizeBrandKitInput({
    name: "  FuelCo  ",
    websiteUrl: "https://fuelco.test",
    logo: { url: "https://cdn.fuelco.test/logo.svg" },
    colors: [{ hex: "1F3A8A", role: "primary" }, { hex: "#fff", role: "nope" }],
    fonts: { heading: { family: 'Playfair "Display"', source: "google" }, body: { family: "" } },
    guidelines: { mustInclude: ["Logo top-left", "Logo top-left", ""], dos: [], donts: ["No gradients"] },
    extra: "ignored",
  });
  assert(ok.ok, "valid kit accepted");
  if (ok.ok) {
    assert(ok.value.name === "FuelCo", "name trimmed");
    assert(ok.value.colors[0].hex === "#1f3a8a" && ok.value.colors[1].role === "accent", "hex normalised, unknown role → accent");
    assert(ok.value.fonts.heading?.family === "Playfair Display", "quotes stripped from family");
    assert(ok.value.fonts.body === null, "empty font dropped");
    assert(ok.value.guidelines.mustInclude.length === 1, "duplicate/empty rules removed");
    assert(!("extra" in ok.value), "unknown fields dropped");
  }
  const bad = sanitizeBrandKitInput({ name: "", logo: { url: "javascript:alert(1)" }, colors: [{ hex: "blue" }] });
  assert(!bad.ok && bad.errors.length === 3, "missing name, unsafe logo URL and bad hex rejected");

  // ── Brand Guideline (BrandSnapshot) ⇄ Brand Kit bridge
  const guideline = {
    name: "Vantoralife",
    description: "Everyday carry for travellers",
    audience: "Commuters and travellers",
    offering: "backpacks, travel bags, luggage",
    tone: "rugged",
    personality: "adventurous, dependable",
    coreValueProp: "Built to carry more, weigh less",
    brand_values: ["Durability", "Design"],
    logo: "https://vantoralife.test/logo.png",
    primaryColors: ["#111111", "not-a-colour", "#F59E0B"],
    primaryFont: "Montserrat",
    website_url: "https://vantoralife.test",
    productImages: ["https://vantoralife.test/p1.jpg"],
  };
  const fromGuideline = kitInputFromSnapshot(guideline as never, { isDefault: true });
  assert(fromGuideline, "guideline → kit");
  if (fromGuideline) {
    assert(fromGuideline.name === "Vantoralife" && fromGuideline.isDefault, "name + default");
    assert(fromGuideline.colors.map((c) => `${c.role}:${c.hex}`).join(",") === "primary:#111111,secondary:#f59e0b", "valid colours in role order");
    assert(fromGuideline.fonts.heading?.family === "Montserrat", "font carried over");
    assert(fromGuideline.identity.offering === "backpacks, travel bags, luggage", "offering");
    assert(fromGuideline.identity.tone === "adventurous, dependable", "personality preferred for tone");
    assert(fromGuideline.identity.valueProposition === "Built to carry more, weigh less", "value proposition");
    assert(fromGuideline.identity.values.join(",") === "Durability,Design", "values");
  }
  assert(kitInputFromSnapshot({ name: "My Brand" } as never, { isDefault: true }) === null, "empty placeholder ignored");
  assert(isMeaningfulSnapshot({ name: "My Brand", offering: "Pickles" } as never), "placeholder name with content kept");

  const curated = {
    id: "k1", name: "Vantoralife", websiteUrl: null, isDefault: true,
    logo: { url: "https://cdn.test/curated.svg" },
    colors: [{ hex: "#0a0a0a", role: "primary" as const }],
    fonts: { heading: null, body: null },
    guidelines: { mustInclude: [], dos: [], donts: [] },
    identity: { ...EMPTY_IDENTITY, audience: "Curated audience" },
    createdAt: "", updatedAt: "",
  };
  const filled = fillKitFromSnapshot(curated, guideline as never);
  assert(filled, "empty fields get filled");
  if (filled) {
    assert(filled.logo?.url === "https://cdn.test/curated.svg", "curated logo kept");
    assert(filled.colors[0].hex === "#0a0a0a" && filled.colors.length === 1, "curated colours kept");
    assert(filled.identity.audience === "Curated audience", "curated audience kept");
    assert(filled.identity.offering === "backpacks, travel bags, luggage", "empty offering filled");
    assert(filled.fonts.heading?.family === "Montserrat", "empty font filled");
    assert(filled.websiteUrl === "https://vantoralife.test/", "empty website filled");
  }
  assert(fillKitFromSnapshot({ ...curated, ...filled!, id: "k1", createdAt: "", updatedAt: "" }, guideline as never) === null, "nothing to fill → no update");

  const served = kitToSnapshot({ ...curated, identity: { ...EMPTY_IDENTITY, offering: "Kit offering" } }, guideline as never);
  assert(served.name === "Vantoralife" && served.offering === "Kit offering", "kit values win");
  assert(served.description === "Everyday carry for travellers", "legacy fills gaps for the same brand");
  assert(served.logo === "https://cdn.test/curated.svg" && served.primaryColors?.[0] === "#0a0a0a", "kit look served");
  assert(served.productImages?.[0] === "https://vantoralife.test/p1.jpg", "legacy-only fields kept for the same brand");
  const otherBrand = kitToSnapshot({ ...curated, name: "Oorgaa" }, guideline as never);
  assert(!otherBrand.productImages && otherBrand.description === "", "a different brand's guideline is not mixed in");

  console.log("brand-kit.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
