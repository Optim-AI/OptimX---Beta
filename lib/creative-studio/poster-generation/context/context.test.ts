/**
 * Phase 3 context normalization tests.
 * Run: node --import tsx lib/creative-studio/poster-generation/context/context.test.ts
 */

import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";
import { normalizeBrandSnapshot } from "./normalizers/brand";
import { normalizeCatalogProduct } from "./normalizers/catalog-product";
import { normalizeImportedProduct } from "./normalizers/imported-product";
import { mergeProductContexts } from "./normalizers/merge-product";
import {
  normalizeExistingProduct,
  normalizeUploadedProduct,
} from "./normalizers/uploaded-product";
import {
  resolvePosterContext,
  toPosterBrandContext,
  toPosterProductContext,
} from "./resolve";
import { classifyClaimStrings } from "./product-context";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const catalogProduct: Product = {
  product_name: "Yoga Bar High Protein Oats",
  price: "₹999",
  description: "Protein-packed oats for morning fuel",
  key_benefits: ["26g protein", "No added sugar", "Helps you start strong"],
  product_images: ["https://cdn.example.com/oats.png"],
  target_audience: "Fitness adults",
  emotional_angles: ["Energy"],
  use_cases: ["Breakfast"],
  short_benefit: "26g protein breakfast",
  category: "food",
};

const brand: BrandSnapshot = {
  name: "Yoga Bar",
  description: "Nutrition brand",
  audience: "Fitness-minded adults",
  offering: "Protein foods",
  tone: "energetic",
  primaryColors: ["#2D5A27", "#F5A623"],
  colors: { primary: "#2D5A27", secondary: "#F5A623" },
  brandVoice: "Bold",
  coreValueProp: "20g+ protein",
  logo: "https://cdn.example.com/logo.png",
  brand_aesthetic: ["modern"],
  brand_values: ["High protein"],
};

// 1. catalog
const cat = normalizeCatalogProduct(catalogProduct, { productId: "p1" });
assert(cat.source === "catalog", "catalog source");
assert(cat.name?.value === "Yoga Bar High Protein Oats", "catalog name");
assert(cat.name?.confidence === "authoritative", "catalog authoritative");
assert(cat.price?.value === "₹999", "catalog price");
assert(cat.images.length === 1, "catalog image");
assert(cat.factualClaims.value.includes("26g protein"), "factual claim");
assert(cat.marketingClaims.value.some((c) => /start strong/i.test(c)), "marketing claim separated");

// 2. URL import
const imported = normalizeImportedProduct(
  {
    product_name: "Protein Oats",
    brand_name: "Example",
    product_images: ["https://cdn.example.com/a.png"],
    category: "food",
    price: "₹899",
  },
  { productUrl: "https://shop.example.com/oats" }
);
assert(imported.source === "url_import", "url source");
assert(imported.category?.confidence === "inferred", "category inferred");
assert(imported.brandName?.confidence === "inferred", "brand from domain inferred");
assert(imported.benefits.value.length === 0, "no invented benefits");

// 3. upload
const uploaded = normalizeUploadedProduct({
  imageDataUrls: ["data:image/png;base64,aaa"],
  prompt: "my product photo",
});
assert(uploaded.source === "upload", "upload source");
assert(uploaded.name === null, "upload does not invent name");
assert(uploaded.images.length === 1, "upload image");
assert(uploaded.completeness === "minimal", "upload minimal");

// 4. existing
const existing = normalizeExistingProduct({
  productId: "ex1",
  productName: "Session Oats",
  price: "₹950",
  images: ["https://cdn.example.com/sess.png"],
});
assert(existing.source === "existing", "existing source");
assert(existing.name?.value === "Session Oats", "existing name");

// 5. brand
const brandCtx = normalizeBrandSnapshot(brand, { brandId: "b1" });
assert(brandCtx.identity.name?.value === "Yoga Bar", "brand name");
assert(brandCtx.identity.colors.palette.length === 2, "brand colors");
assert(brandCtx.identity.logo?.url?.includes("logo"), "brand logo");
assert(brandCtx.communication.audience?.value, "brand audience");
assert(brandCtx.completeness !== "none", "brand not none");

// 6–8. references via resolve
const resolved = resolvePosterContext({
  catalogProduct,
  brandSnapshot: brand,
  designReferences: [
    {
      url: "https://cdn.example.com/ref-poster.png",
      analysis: {
        composition: "asymmetric",
        layout: "editorial",
        typography: "bold stack",
        colorStrategy: "high contrast",
        imagery: "product still",
        graphicLanguage: "minimal",
        hierarchy: "type then product",
        spacing: "generous",
        visualTreatment: "matte",
        designMechanism: "editorial",
        avoid: ["copy logos"],
      },
    },
  ],
  supportingReferences: [{ url: "https://cdn.example.com/still.png" }],
});
assert(
  resolved.referenceContext.designReferences.length === 1,
  "design ref"
);
assert(
  resolved.referenceContext.designReferences[0].role === "design_inspiration",
  "design role"
);
assert(
  resolved.referenceContext.productReferences.some(
    (r) => r.role === "product_packshot"
  ),
  "product packshot ref"
);
assert(
  resolved.referenceContext.productReferences.some(
    (r) => r.role === "brand_logo"
  ),
  "logo as product/brand ref"
);
assert(
  resolved.referenceContext.supportingReferences.length === 1,
  "supporting still"
);
assert(
  resolved.referenceContext.designReferences[0].role === "design_inspiration",
  "design stays design"
);

// 9. missing product
const empty = resolvePosterContext({ brandSnapshot: null });
assert(empty.productContext.completeness === "none", "no product = none");
assert(empty.brandContext.completeness === "none", "no brand = none");

// 10–11. conflicts
const merged = mergeProductContexts(
  normalizeImportedProduct({
    product_name: "Oats",
    price: "₹899",
    product_images: ["https://a"],
  }),
  normalizeCatalogProduct({
    ...catalogProduct,
    price: "₹999",
  })
);
assert(merged.price?.value === "₹999", "catalog price wins precedence");
assert(
  merged.conflicts.some((c) => c.field === "price"),
  "price conflict recorded"
);
assert(
  merged.conflicts.find((c) => c.field === "price")!.values.length >= 2,
  "both price values kept"
);

// 12–13. provenance + inferred vs authoritative
assert(cat.price?.source === "catalog", "price provenance catalog");
assert(imported.category?.confidence === "inferred", "inferred category");
assert(cat.price?.confidence === "authoritative", "authoritative price");

// 14. claim classification
const classified = classifyClaimStrings([
  "26g protein",
  "Best protein in India",
  "No added sugar",
]);
assert(classified.factual.includes("26g protein"), "26g factual");
assert(
  classified.marketing.some((m) => /best protein/i.test(m)),
  "best = marketing"
);

// 15. completeness
assert(cat.completeness === "complete" || cat.completeness === "partial", "catalog complete-ish");
assert(uploaded.completeness === "minimal", "upload minimal completeness");

// 16. deterministic adapters
const p1 = toPosterProductContext(cat);
const p2 = toPosterProductContext(cat);
assert(p1?.name === p2?.name && p1?.price === p2?.price, "deterministic product adapter");
const b1 = toPosterBrandContext(brandCtx);
assert(b1.name === "Yoga Bar", "brand adapter");
assert(b1.primaryColors.length === 2, "brand colors adapter");

// existing wins over catalog on merge order
const precedence = mergeProductContexts(
  cat,
  normalizeExistingProduct({
    productName: "Session Wins",
    price: "₹1",
    images: ["https://x"],
  })
);
assert(precedence.name?.value === "Session Wins", "existing beats catalog");
assert(precedence.source === "existing", "source = existing");

// malformed-ish: empty upload
const bare = normalizeUploadedProduct({});
assert(bare.completeness === "none", "empty upload none");

console.log("poster-generation context.test.ts: PASS");
