/**
 * Nano Banana request builder — compiles GenerationSpecification → provider prompt.
 * Translates only. Does not invent creative decisions.
 */

import type {
  GenerationCopySlot,
  GenerationSpecification,
  ImageGenerationRequest,
  PosterArtDirection,
  PosterAspectRatio,
} from "../types";

const PRODUCT_REF_INSTRUCTION =
  "IMAGE ROLE — PRODUCT: The image above is the USER-UPLOADED PRODUCT packshot. " +
  "Composite THIS exact product into the poster. " +
  "Do NOT invent, redraw, regenerate, redesign, approximate, replace, or swap this product for a different SKU/category/brand. " +
  "Packaging artwork, logo, colors, label text, proportions, and material finish must match this reference. " +
  "Natural perspective and lighting on the pack are allowed; inventing a new product is forbidden.";

const BASE_POSTER_LABEL = "BASE POSTER (previous version)";

function extractIterationUserRequest(
  spec: GenerationSpecification
): string | null {
  for (const req of spec.scene.outputRequirements || []) {
    const primary = req.match(/PRIMARY EDIT TASK:\s*(.+)/i);
    if (primary?.[1]?.trim()) return primary[1].trim();
  }
  for (const req of spec.scene.outputRequirements || []) {
    const m = req.match(/User request:\s*(.+?)(?:\s*Preserve locked|\s*$)/i);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function isIterationSpec(spec: GenerationSpecification): boolean {
  if (spec.iterationId || spec.parentGenerationId) return true;
  return (spec.scene.outputRequirements || []).some((r) =>
    /CONTROLLED ITERATION|PRIMARY EDIT TASK/i.test(r)
  );
}

const SLOT_GUIDANCE: Record<GenerationCopySlot["role"], string> = {
  primary: "the headline — the largest text on the poster and the first thing the eye reads",
  product_line: "the product name — small and clean, set close to the headline",
  secondary: "one supporting line — clearly smaller than the headline",
  supporting: "one supporting line — clearly smaller than the headline",
  badge: "a compact tag",
  cta: "the call to action — a clear button, smaller than the headline",
  label: "a short format label on its half — clear, medium size, high contrast",
};

function sentence(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Join non-empty fragments, skipping any already contained in an earlier one. */
function joinDistinct(parts: Array<string | null | undefined>, sep = " "): string {
  const out: string[] = [];
  for (const raw of parts) {
    const p = (raw || "").trim();
    if (!p) continue;
    const lower = p.toLowerCase();
    if (out.some((o) => o.toLowerCase().includes(lower))) continue;
    out.push(p);
  }
  return out.join(sep);
}

/** Join fragments as separate sentences (for fields that are full phrases). */
function joinSentences(parts: Array<string | null | undefined>): string {
  return joinDistinct(parts.map((p) => sentence(p || "")), " ");
}

/** Director keywords → a description the image model can act on. */
const PRODUCT_TREATMENT_PHRASES: Record<string, string> = {
  hero: "the product is the dominant hero object, large and front-facing",
  integrated: "the product sits naturally within the scene, clearly visible and in sharp focus",
  contextual: "the product appears in its real-use context, clearly visible",
  handheld: "the product is held in a hand with the label facing the camera",
  foreground: "the product is in the sharp foreground with the scene softly blurred behind it",
  background: "the product sits further back in the scene but stays clearly recognisable",
  "ingredient-associated": "the product is surrounded by its key ingredients",
};

function describeProductTreatment(value: string): string {
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return PRODUCT_TREATMENT_PHRASES[key] || value;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

const PALETTE_ROLE_USE: Record<string, string> = {
  primary: "the main brand colour — headline or key shapes",
  secondary: "secondary colour for supporting shapes",
  accent: "accent, used sparingly for highlights and the call to action",
  background: "background",
  text: "text",
};

function describeBrandPalette(colorsByRole: Array<{ hex: string; role: string }>): string {
  if (!colorsByRole.length) return "use the brand's colours from the product and logo.";
  return `${colorsByRole
    .map((c) => `${c.hex} (${PALETTE_ROLE_USE[c.role] || c.role})`)
    .join("; ")}.`;
}

function safeAreaNote(aspect: string): string {
  if (aspect === "9:16") {
    return "Keep the top and bottom 12% free of text so app UI never covers it.";
  }
  return "";
}

/**
 * Compile a concise, positive art-director brief for a fresh poster.
 * Image models follow one clear description far better than a long rule list,
 * so each instruction appears once and abstract strategy fields are left out
 * (they already shaped the concept and the copy).
 */
export function compileArtDirectorBrief(
  spec: GenerationSpecification,
  art: PosterArtDirection
): string {
  const c = art.concept;
  const t = art.theme;
  const brandProduct = joinDistinct([art.brandName, art.productName]);
  const lines: string[] = [];

  lines.push(
    `Create a finished, professional advertising poster for ${brandProduct}, composed natively for ${spec.aspectRatio} (${spec.intendedPlatform}).`
  );

  const refNotes: string[] = [];
  if (art.hasProductReference) {
    refNotes.push(
      "The attached product photo is the real product: feature exactly this product as the hero, with the same shape, label artwork, colours and printed text, lit to match the scene."
    );
  } else {
    refNotes.push(
      "No product photo is supplied, so do not show branded packaging; express the product through the scene."
    );
  }
  if (art.hasLogoReference) {
    refNotes.push("Place the attached logo small and unaltered.");
  }
  if (art.hasDesignReference) {
    refNotes.push(
      "The attached design reference sets mood and craft only; create an original layout."
    );
  }
  if (spec.references.some((r) => r.kind === "supporting" && r.url)) {
    refNotes.push(
      "The attached context photo shows the setting and mood to draw from; it is not the product and is not copied literally."
    );
  }
  lines.push(refNotes.join(" "));

  lines.push(
    sentence(
      `Concept${c.name ? ` — ${c.name}` : ""}: ${joinDistinct([c.visualStory], " ")}`
    )
  );

  const scene = [
    c.environment && `Setting: ${sentence(c.environment)}`,
    c.subject && `Subject: ${sentence(c.subject)}`,
    c.humanPresence && `People: ${sentence(c.humanPresence)}`,
    c.supportingElements && `Props and details: ${sentence(c.supportingElements)}`,
    c.productTreatment &&
      `Product placement: ${sentence(describeProductTreatment(c.productTreatment))}`,
  ].filter(Boolean);
  if (scene.length) lines.push(scene.join(" "));

  lines.push(
    [
      (c.cameraDirection || c.photographyStyle) &&
        `Camera: ${sentence(joinDistinct([c.cameraDirection, c.photographyStyle], "; "))}`,
      `Lighting: ${sentence(joinDistinct([c.lighting, t.lighting], "; "))}`,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const kit = art.brandKit ?? null;
  if (kit) {
    // The brand's own design system leads; the theme chip only adds mood.
    lines.push(
      `Brand style — ${kit.name}: follow this brand's own design system for colour, type and graphic style. Mood from the ${t.label} direction: ${sentence(
        joinDistinct([c.mood, t.mood], "; ")
      )} Colour: ${describeBrandPalette(kit.colors)} Keep other colours to natural tones in the photography. Graphic elements: ${joinSentences([c.graphicLanguage])}`
    );
  } else {
    const brandColors = art.brandColors.length
      ? ` Brand colours available as accents: ${art.brandColors.join(", ")}.`
      : "";
    lines.push(
      `Look and feel — ${t.label}: ${sentence(t.summary)} Mood: ${sentence(
        joinDistinct([c.mood, t.mood], "; ")
      )} Colour: ${joinSentences([c.colorTreatment, t.colorStrategy])}${brandColors} Graphic elements: ${joinSentences(
        [c.graphicLanguage, t.graphicLanguage]
      )}`
    );
  }
  if (t.must?.length) {
    // The theme chip must read at a glance (the old prompt's strength).
    lines.push(
      `Make the ${t.label} direction unmistakable${kit ? " while keeping the brand colours" : ""}: ${t.must
        .map(lowerFirst)
        .join("; ")}.`
    );
  }

  lines.push(
    [
      `Layout: ${sentence(joinDistinct([c.composition, t.compositionBias], "; "))}`,
      "Reserve a calm, uncluttered area for the text so it never sits on busy detail, and give the headline clear contrast against what is behind it.",
      "Keep all text and key elements at least 7% away from every edge.",
      art.adFormat?.layoutRule || "",
      safeAreaNote(spec.aspectRatio),
      c.aspectNotes && c.aspectNotes.split(/\s+/).length > 3 ? sentence(c.aspectNotes) : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (kit && (kit.headingFont || kit.bodyFont)) {
    const fonts = joinDistinct(
      [
        kit.headingFont && `Set the headline in ${kit.headingFont}`,
        kit.bodyFont && `supporting text and the call to action in ${kit.bodyFont}`,
      ],
      "; "
    );
    lines.push(
      `Typography: ${sentence(fonts)} If a font is unavailable, use the closest match in style. ${joinSentences([c.typographyTreatment])} Use a clear size hierarchy aligned to a consistent margin.`
    );
  } else {
    const fontNote = art.brandFont
      ? ` Use the brand font ${art.brandFont} or the closest match.`
      : "";
    lines.push(
      `Typography: ${joinSentences([c.typographyTreatment, t.typography])}${fontNote} Use a clear size hierarchy with no more than two typefaces, aligned to a consistent margin.`
    );
  }

  const slots = spec.copyHierarchy;
  const format = art.adFormat ?? null;
  const firstBadge = slots.find((s) => s.role === "badge");
  const textLines = slots.map((slot, i) => {
    let guidance = SLOT_GUIDANCE[slot.role];
    if (slot.role === "cta") {
      guidance = format
        ? `the call to action — ${format.ctaGuidance}`
        : art.concept.ctaTreatment
          ? `${SLOT_GUIDANCE.cta} (${art.concept.ctaTreatment})`
          : SLOT_GUIDANCE.cta;
    } else if (slot.role === "badge" && format) {
      guidance = slot === firstBadge ? format.badgeGuidance : SLOT_GUIDANCE.badge;
    }
    return `${i + 1}. "${slot.text}": ${guidance}.`;
  });
  lines.push(
    [
      `Text — render exactly ${slots.length === 1 ? "this line" : `these ${slots.length} lines`}, spelled exactly as written, each one once, and no other words:`,
      ...textLines,
      art.hasProductReference
        ? "Text printed on the product packaging stays as it appears in the product photo."
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (kit && (kit.mustInclude.length || kit.dos.length)) {
    lines.push(
      [
        "Brand rules:",
        ...kit.mustInclude.map((r) => `- Must include: ${r}`),
        ...kit.dos.map((r) => `- ${r}`),
      ].join("\n")
    );
  }

  const extra = (art.additionalRequirements || []).filter((x) => x && x.trim());
  if (extra.length) {
    lines.push(["Series context:", ...extra.map((r) => `- ${r}`)].join("\n"));
  }

  const claims = [
    ...spec.constraints.unsupportedClaims,
  ].filter((x) => x && x.trim());
  if (claims.length) {
    lines.push(`Do not state or imply: ${claims.join("; ")}.`);
  }

  const avoid = joinDistinct(
    [
      ...(kit?.donts ?? []).map(lowerFirst),
      ...t.avoid.map(lowerFirst),
      "extra text, prices, URLs or watermarks",
      "clip-art and stock-photo clichés",
      "cluttered layouts",
      "warped hands or garbled lettering",
    ],
    "; "
  );
  lines.push(
    `Finish: polished commercial art direction — one strong idea, crisp detail, clean edges and considered typography. Avoid ${avoid}.`
  );

  return lines.filter((l) => l.trim()).join("\n\n");
}

export function compileNanoBananaPrompt(
  spec: GenerationSpecification,
  options?: { forIteration?: boolean }
): string {
  const forIteration =
    options?.forIteration === true || isIterationSpec(spec);
  if (!forIteration && spec.artDirection) {
    return compileArtDirectorBrief(spec, spec.artDirection);
  }
  const sections: string[] = [];
  const hasProductRef = spec.references.some(
    (r) => r.kind === "product" && r.url
  );
  const editRequest = extractIterationUserRequest(spec);

  if (forIteration) {
    sections.push("=== CONTROLLED EDIT (PRIMARY TASK) ===");
    sections.push(
      "You are editing an EXISTING finished poster shown as BASE POSTER. This is NOT a fresh campaign generation."
    );
    sections.push(
      editRequest
        ? `Apply ONLY this change: ${editRequest}`
        : "Apply ONLY the planned iteration changes listed below."
    );
    sections.push(
      "Keep everything else as close as possible to the BASE POSTER: composition, product packaging appearance, brand marks, colors, typography placement, and copy (unless the edit explicitly changes copy)."
    );
    sections.push(
      "Do NOT invent a new concept, new layout from scratch, or a different product. Prefer a minimal delta from the BASE POSTER."
    );
    if (hasProductRef) {
      sections.push(
        "Product packaging identity must remain the same SKU as the BASE POSTER / PRODUCT reference — do not redraw a lookalike pack."
      );
    }
  } else {
    sections.push("=== ROLE ===");
    sections.push(
      "You are executing an approved commercial poster GenerationSpecification. Translate it faithfully. Do not invent a new creative concept, marketing message, unsupported claims, or product packaging."
    );

    if (hasProductRef) {
      sections.push("\n=== HARD PRODUCT LOCK (NON-NEGOTIABLE) ===");
      sections.push(
        "A PRODUCT reference image is attached. The poster MUST feature that exact uploaded product only. Never generate substitute packaging, a lookalike, or a redesigned pack."
      );
    }

    sections.push("\n=== THEME LOCK (MUST BE VISUALLY OBVIOUS) ===");
    sections.push(spec.scene.visualDirectionExpression);
    sections.push(`Mood: ${spec.scene.mood}`);
    sections.push(`Color strategy: ${spec.scene.colorStrategy}`);
    sections.push(`Typography: ${spec.scene.typography}`);
    sections.push(`Graphic language: ${spec.scene.graphicLanguage}`);
    sections.push(`Lighting: ${spec.scene.lighting}`);
    sections.push(`Composition bias: ${spec.scene.composition}`);
    sections.push(`Visual rhythm / density: ${spec.scene.visualRhythm}`);
    const themeReqs = (spec.scene.outputRequirements || []).filter(
      (r) =>
        /theme lock|theme must|theme avoid|THEME LOCK/i.test(r) ||
        r.startsWith("Theme must:") ||
        r.startsWith("Theme avoid:")
    );
    for (const req of themeReqs) {
      sections.push(req);
    }
    sections.push(
      "If this poster could pass for a different visual-direction chip, the theme lock failed — strengthen theme-specific cues."
    );
  }

  sections.push("\n=== CAMPAIGN ===");
  sections.push(`Objective: ${spec.strategyAlignment.objective}`);
  sections.push(`Audience: ${spec.strategyAlignment.audience}`);
  sections.push(`Primary message: ${spec.strategyAlignment.primaryMessage}`);
  sections.push(`Angle: ${spec.strategyAlignment.communicationAngle}`);

  sections.push("\n=== PRODUCT FIDELITY ===");
  sections.push(spec.scene.productFidelityRules);
  sections.push(spec.constraints.productFidelity);

  sections.push("\n=== BRAND ===");
  sections.push(spec.scene.brandIntegration);
  if (spec.constraints.brandRequirements.length) {
    sections.push(spec.constraints.brandRequirements.join("; "));
  }
  sections.push(spec.constraints.logoFidelity);

  sections.push("\n=== CREATIVE CONCEPT ===");
  sections.push(`Territory: ${spec.scene.visualTerritory}`);
  sections.push(`Visual story: ${spec.scene.visualStory}`);
  sections.push(`Subject: ${spec.scene.subjectTreatment}`);
  sections.push(`Product treatment: ${spec.scene.productTreatment}`);
  sections.push(`Environment: ${spec.scene.environment}`);
  sections.push(`Human presence: ${spec.scene.humanPresence}`);
  sections.push(`Mood: ${spec.scene.mood}`);

  sections.push(
    forIteration
      ? "\n=== VISUAL EXECUTION (apply edit on top of BASE POSTER) ==="
      : "\n=== VISUAL EXECUTION (CreativeDNA + Theme) ==="
  );
  sections.push(`Composition: ${spec.scene.composition}`);
  sections.push(`Photography/illustration: ${spec.scene.photographyStyle}`);
  sections.push(`Lighting: ${spec.scene.lighting}`);
  sections.push(`Color strategy: ${spec.scene.colorStrategy}`);
  sections.push(`Typography strategy: ${spec.scene.typography}`);
  sections.push(`Graphic language: ${spec.scene.graphicLanguage}`);
  sections.push(`Visual rhythm: ${spec.scene.visualRhythm}`);
  sections.push(`Hierarchy: ${spec.scene.hierarchy}`);
  sections.push(
    `Visual direction expression: ${spec.scene.visualDirectionExpression}`
  );

  sections.push(
    "\n=== TYPOGRAPHY / APPROVED COPY (exact — do not paraphrase) ==="
  );
  for (const slot of spec.copyHierarchy) {
    sections.push(
      `[${slot.role.toUpperCase()} | ${slot.importance}] ${slot.text}`
    );
  }
  sections.push(spec.constraints.copyFidelity);

  sections.push("\n=== COLOR ===");
  sections.push(spec.scene.colorStrategy);

  sections.push("\n=== REFERENCES ===");
  sections.push(spec.constraints.referenceHandling);
  sections.push(spec.scene.designReferenceInfluence);
  if (forIteration) {
    sections.push(
      `${BASE_POSTER_LABEL} is the source image to edit. PRODUCT refs are for packaging identity only.`
    );
  }
  if (spec.references.length === 0) {
    sections.push("No reference images attached.");
  } else {
    for (const ref of spec.references) {
      sections.push(`${ref.label} | kind=${ref.kind} | role=${ref.role}`);
    }
  }

  sections.push("\n=== FORMAT ===");
  sections.push(
    `Aspect ratio: ${spec.aspectRatio} — ${spec.intendedPlatform}`
  );
  for (const req of spec.scene.outputRequirements) {
    // Skip dumping the full theme recipe again on iterations — it fights LOCAL edits
    if (
      forIteration &&
      (/^THEME LOCK —/i.test(req) ||
        /^Theme must:/i.test(req) ||
        /^Theme avoid:/i.test(req))
    ) {
      continue;
    }
    sections.push(`- ${req}`);
  }

  sections.push("\n=== CONSTRAINTS ===");
  if (spec.constraints.unsupportedClaims.length) {
    sections.push(
      `Forbidden/unsupported claims (do not depict or imply): ${spec.constraints.unsupportedClaims.join("; ")}`
    );
  }
  if (spec.strategyAlignment.allowedClaims.length) {
    sections.push(
      `Allowed factual claims only: ${spec.strategyAlignment.allowedClaims.join("; ")}`
    );
  }

  sections.push("\n=== FINAL INSTRUCTION ===");
  if (forIteration) {
    sections.push(
      editRequest
        ? `Output the updated poster with this change clearly visible: ${editRequest}`
        : "Output the updated poster with the planned iteration clearly visible."
    );
    sections.push(
      "If the result looks like an unrelated new poster, you failed — start from the BASE POSTER and apply a minimal edit."
    );
  } else {
    sections.push(
      "Execute this GenerationSpecification faithfully as a finished advertising poster. Prefer one strong idea over decorative clutter. Do not copy any design reference literally."
    );
    if (hasProductRef) {
      sections.push(
        "FINAL HARD LOCK: Composite the attached PRODUCT reference packshot exactly. Do not invent product packaging."
      );
    }
    sections.push(
      "FINAL THEME LOCK: The selected visual-direction theme must be unmistakable in mood, color, typography, and graphic language."
    );
  }

  return sections.join("\n");
}

export function buildNanoBananaReferenceInstructions(
  spec: GenerationSpecification
): Array<{
  kind: GenerationSpecification["references"][number]["kind"];
  role: GenerationSpecification["references"][number]["role"];
  label: string;
  instruction: string;
  url?: string | null;
}> {
  const ranked = [...spec.references].sort((a, b) => {
    const rank = (k: string) =>
      k === "product" ? 0 : k === "logo" ? 1 : k === "design" ? 2 : 3;
    return rank(a.kind) - rank(b.kind);
  });

  // Art-director briefs already explain each image once; keep per-image notes short.
  const concise = !!spec.artDirection && !isIterationSpec(spec);

  return ranked.map((ref) => {
    let instruction = `${ref.label}.`;
    if (concise) {
      instruction =
        ref.kind === "product"
          ? "Product photo: the real product to feature exactly as shown."
          : ref.kind === "logo"
            ? "Brand logo: reproduce exactly, small."
            : ref.kind === "design"
              ? "Design reference: mood and craft only; do not copy its layout, text or product."
              : "Supporting context image: use only if it helps the concept.";
    } else if (ref.kind === "product") {
      instruction = `${ref.label}. ${PRODUCT_REF_INSTRUCTION}`;
    } else if (ref.kind === "logo") {
      instruction +=
        " TYPE: LOGO. ROLE: BRAND MARK. Preserve exactly; do not redesign.";
    } else if (ref.kind === "design") {
      instruction +=
        " TYPE: DESIGN. ROLE: VISUAL INSPIRATION ONLY. Extract high-level art direction. Do NOT copy exact layout, text, decorative elements, or distinctive arrangement. Never replace the product with anything from this design reference.";
    } else {
      instruction +=
        " TYPE: SUPPORTING. ROLE: OPTIONAL CONTEXT. Use only if it supports the approved concept. Do not invent product packaging from this image.";
    }
    return {
      kind: ref.kind,
      role: ref.role,
      label: ref.label,
      instruction,
      url: ref.url,
    };
  });
}

/** Prefer product refs; keep at most `max` images with product slots reserved. */
export function prioritizeReferenceImages<
  T extends { kind: string; url?: string | null }
>(refs: T[], max = 4): T[] {
  const withUrl = refs.filter((r) => !!r.url);
  const products = withUrl.filter((r) => r.kind === "product");
  const others = withUrl.filter((r) => r.kind !== "product");
  const reserved = Math.min(products.length, Math.max(1, Math.min(2, max)));
  const productSlots = products.slice(0, reserved);
  const remaining = Math.max(0, max - productSlots.length);
  return [...productSlots, ...others.slice(0, remaining)];
}

export function buildImageGenerationRequest(options: {
  specification: GenerationSpecification;
  userId: string;
  prompt?: string;
  referenceImages?: ImageGenerationRequest["referenceImages"];
  mode?: "generate" | "edit";
  /** Prior poster URL/data URL for controlled iteration */
  baseImageUrl?: string | null;
}): ImageGenerationRequest {
  const forIteration = !!options.baseImageUrl;
  const prompt =
    options.prompt ??
    compileNanoBananaPrompt(options.specification, { forIteration });
  let refs =
    options.referenceImages ??
    buildNanoBananaReferenceInstructions(options.specification).map((r) => ({
      role: r.role,
      kind: r.kind,
      label: r.label,
      instruction: r.instruction,
      mimeType: "image/png",
      url: r.url || undefined,
    }));

  if (options.baseImageUrl) {
    const editRequest =
      extractIterationUserRequest(options.specification) ||
      "the planned iteration change";
    const productRefs = refs
      .filter((r) => r.kind === "product" && r.url)
      .slice(0, 1)
      .map((r) => ({
        ...r,
        instruction:
          `${r.label}. IMAGE ROLE — PRODUCT IDENTITY ONLY. Match this exact packaging on the edited poster. ` +
          `Do not invent a new product. Prefer keeping the pack appearance already present in the BASE POSTER when it matches this SKU.`,
      }));
    refs = [
      {
        role: "design_inspiration" as const,
        kind: "design" as const,
        label: BASE_POSTER_LABEL,
        instruction:
          `TYPE: BASE POSTER — PRIMARY EDIT SOURCE. ` +
          `Start from this exact poster and apply ONLY: "${editRequest}". ` +
          `Preserve layout, product packaging, branding, colors, and all text unless the edit explicitly changes them. ` +
          `Do not regenerate a brand-new poster idea.`,
        mimeType: "image/png",
        url: options.baseImageUrl,
      },
      ...productRefs,
    ].slice(0, 4);
  } else {
    refs = prioritizeReferenceImages(refs, 4);
  }

  return {
    specification: {
      ...options.specification,
      compiledPrompt: prompt,
    },
    prompt,
    aspectRatio: options.specification.aspectRatio as PosterAspectRatio,
    referenceImages: refs,
    mode: options.mode ?? "generate",
    baseImage: null,
    metadata: {
      sessionId: options.specification.sessionId,
      generationId: options.specification.generationId,
      variantId: options.specification.variantId,
      userId: options.userId,
    },
  };
}
