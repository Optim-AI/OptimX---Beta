/**
 * Client helpers for the new poster-generation engine (Phase 7.5).
 * Browser never sends strategy/concept/DNA/spec as authoritative — only sessionId + inputs for brief.
 */

import { authFetch, safeResponseJson } from "@/lib/utils";
import type { BrandSnapshot, Product } from "./types";
import type {
  CreativeBrief,
  CreativeConcept,
  PosterAspectRatio,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterQcResult,
  PosterVisualDirection,
  PosterVariantCount,
} from "@/lib/creative-studio/poster-generation/types";

const ENGINE_SESSION_KEY = "skalx_poster_engine_session";

export type PosterEngineUiConcept = {
  id: string;
  name: string;
  description: string;
  territory: string;
  visualApproach: string;
};

export type PosterEngineResultItem = {
  generationId: string;
  variantId: string;
  imageUrl: string;
  conceptId: string;
  status: "ready" | "review" | "failed";
  qcSummary?: string | null;
  qcIssues?: string[];
  qc?: PosterQcResult | null;
  parentGenerationId?: string | null;
  versionNumber?: number;
};

export function engineSessionStorageKey(studioSessionId: string): string {
  return `${ENGINE_SESSION_KEY}:${studioSessionId}`;
}

export function saveEngineSessionId(
  studioSessionId: string,
  engineSessionId: string
): void {
  try {
    localStorage.setItem(
      engineSessionStorageKey(studioSessionId),
      engineSessionId
    );
  } catch {
    /* ignore */
  }
}

export function loadEngineSessionId(studioSessionId: string): string | null {
  try {
    return localStorage.getItem(engineSessionStorageKey(studioSessionId));
  } catch {
    return null;
  }
}

function mapThemeToVisualDirection(
  theme: string | null | undefined
): PosterVisualDirection {
  const t = (theme || "commercial").toLowerCase();
  const allowed: PosterVisualDirection[] = [
    "minimal",
    "professional",
    "commercial",
    "premium",
    "bold",
    "playful",
    "trendy",
    "festive",
    "dynamic",
  ];
  return (allowed.includes(t as PosterVisualDirection)
    ? t
    : "commercial") as PosterVisualDirection;
}

function territoryLabel(territory: string): string {
  return territory
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function conceptToUiCard(c: CreativeConcept): PosterEngineUiConcept {
  const visualBits = [
    territoryLabel(c.territory),
    c.humanPresence && c.humanPresence !== "none"
      ? "Human presence"
      : "Product-led",
    c.emotionalExpression,
  ].filter(Boolean);
  return {
    id: c.id,
    name: c.name,
    description: c.description || c.visualStory || c.rationale,
    territory: c.territory,
    visualApproach: visualBits.slice(0, 3).join(" · "),
  };
}

export type BuildBriefInput = {
  brand: BrandSnapshot | null;
  product: Product | null;
  productName?: string | null;
  productImageUrls: string[];
  creativePrompt: string;
  theme: string;
  aspectRatio: PosterAspectRatio;
  variantCount: PosterVariantCount;
  referencePoster?: {
    dataUrl?: string | null;
    imageUrl?: string | null;
    analysis?: Record<string, unknown> | null;
  } | null;
};

/** Prefer http(s) image URLs; allow at most one small data URL as fallback. */
function slimImageUrls(urls: string[], maxDataChars = 400_000): string[] {
  const clean = (urls || []).filter(Boolean);
  const http = clean.filter((u) => /^https?:\/\//i.test(u));
  if (http.length) return http.slice(0, 4);
  const data = clean.filter(
    (u) => u.startsWith("data:") && u.length <= maxDataChars
  );
  return data.slice(0, 1);
}

/**
 * Shrink CreativeBrief for API transport.
 * Large data-URL product images turn PATCH bodies into megabyte strings that
 * Next may leave unparsed — which breaks action routing.
 */
export function slimBriefForApi(brief: CreativeBrief): CreativeBrief {
  const productUrls = slimImageUrls(
    (brief.product?.images || []).map((i) => i.url).filter(Boolean)
  );
  const productImages = productUrls.map((url) => ({ url }));
  const productRefs = productImages.slice(0, 4).map((img, i) => ({
    id: `product_ref_${i}`,
    role: "product_packshot" as const,
    image: img,
  }));

  const designRefs = (brief.designReferences || [])
    .map((ref, i) => {
      const url = ref.image?.url;
      if (!url) return null;
      if (/^https?:\/\//i.test(url)) {
        return {
          ...ref,
          id: ref.id || `design_ref_${i}`,
          image: { url },
          designAnalysis: ref.designAnalysis || null,
        };
      }
      if (url.startsWith("data:") && url.length <= 400_000) {
        return {
          ...ref,
          id: ref.id || `design_ref_${i}`,
          image: { url },
          designAnalysis: null,
        };
      }
      return null;
    })
    .filter(Boolean) as CreativeBrief["designReferences"];

  const logoUrl = brief.brand?.logo?.url;
  const logo =
    logoUrl &&
    (/^https?:\/\//i.test(logoUrl) ||
      (logoUrl.startsWith("data:") && logoUrl.length <= 200_000))
      ? { url: logoUrl }
      : null;

  return {
    ...brief,
    brand: {
      ...brief.brand,
      snapshot: null,
      logo,
    },
    product: brief.product
      ? {
          ...brief.product,
          images: productImages,
          catalogProduct: null,
        }
      : null,
    productReferences: productRefs,
    designReferences: designRefs.slice(0, 1),
    supportingReferences: [],
  };
}

export function buildCreativeBriefFromWorkspace(
  input: BuildBriefInput
): CreativeBrief {
  const now = new Date().toISOString();
  const productImageUrls = slimImageUrls(input.productImageUrls || []);
  const productImages = productImageUrls.map((url) => ({ url }));

  const productName =
    input.product?.product_name ||
    input.productName ||
    "Product";

  const productRefs = productImages.slice(0, 4).map((img, i) => ({
    id: `product_ref_${i}`,
    role: "product_packshot" as const,
    image: img,
  }));

  const designRefs: CreativeBrief["designReferences"] = [];
  const refCandidates = [
    input.referencePoster?.imageUrl,
    input.referencePoster?.dataUrl,
  ].filter(Boolean) as string[];
  const slimRef = slimImageUrls(refCandidates, 400_000)[0];
  if (slimRef) {
    designRefs.push({
      id: "design_ref_1",
      role: "design_inspiration",
      image: { url: slimRef },
      designAnalysis:
        !slimRef.startsWith("data:") && input.referencePoster?.analysis
          ? (input.referencePoster.analysis as any)
          : null,
      influence: "balanced",
    });
  }

  const brand = input.brand;
  const logoCandidate = brand?.logo || brand?.logoUrl || null;
  const logoUrl =
    typeof logoCandidate === "string"
      ? logoCandidate
      : (logoCandidate as any)?.url || null;
  const slimLogo = logoUrl ? slimImageUrls([logoUrl], 200_000)[0] : null;

  const brief: CreativeBrief = {
    id: `brief_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    brand: {
      snapshot: null,
      name: brand?.name || null,
      logo: slimLogo ? { url: slimLogo } : null,
      primaryColors: brand?.primaryColors || [],
      fonts: brand?.fontStyles || null,
      tone: brand?.brandVoice || null,
      voice: brand?.personality || null,
      industry: brand?.productCategory || null,
      audience: brand?.audience || null,
      tagline: brand?.tagline || null,
      coreValueProp: brand?.coreValueProp || null,
      aestheticTags: [],
      values: [],
      guidelinesApplied: !!brand,
    },
    product: {
      source: input.product ? "catalog" : "upload",
      name: productName,
      description: input.product?.description || null,
      shortBenefit: input.product?.short_benefit || null,
      category: input.product?.category || null,
      benefits: input.product?.key_benefits || [],
      factualClaims: input.product?.key_benefits || [],
      features: [],
      emotionalAngles: input.product?.emotional_angles || [],
      useCases: input.product?.use_cases || [],
      images: productImages,
      brandName: brand?.name || null,
      price: input.product?.price || null,
      targetAudience: input.product?.target_audience || null,
      catalogProduct: null,
    },
    userInstruction: input.creativePrompt.trim(),
    visualDirection: mapThemeToVisualDirection(input.theme),
    aspectRatio: input.aspectRatio,
    variantCount: input.variantCount,
    constraints: [],
    productReferences: productRefs,
    designReferences: designRefs,
    supportingReferences: [],
  };

  return slimBriefForApi(brief);
}

async function parseJson(res: Response): Promise<any> {
  const data = (await safeResponseJson(res)) as any;
  if (!res.ok || data?.ok === false) {
    const msg =
      data?.error?.message ||
      data?.error ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data;
}

function assertEngineSessionId(id: unknown, label: string): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new Error(`${label}: engine sessionId is missing`);
  }
  return id.trim();
}

function withSessionId(
  session: PosterGenerationSession,
  fallbackId: string
): PosterGenerationSession {
  const id = assertEngineSessionId(session?.id || fallbackId, "session");
  return session?.id === id ? session : { ...session, id };
}

export async function createOrLoadPosterEngineSession(options: {
  studioSessionId: string;
  brandId?: string | null;
  productId?: string | null;
  brief?: CreativeBrief | null;
}): Promise<{ session: PosterGenerationSession; created: boolean }> {
  const existingId = loadEngineSessionId(options.studioSessionId);
  if (existingId) {
    try {
      const res = await authFetch(
        `/api/creative-studio/poster/session/${existingId}`,
        { cache: "no-store" }
      );
      const data = await parseJson(res);
      if (data.session) {
        const session = withSessionId(
          data.session as PosterGenerationSession,
          existingId
        );
        saveEngineSessionId(options.studioSessionId, session.id);
        return { session, created: false };
      }
    } catch {
      /* create fresh */
    }
  }

  // Try lookup by studio session
  try {
    const lookup = await authFetch(
      `/api/creative-studio/poster/session?studioSessionId=${encodeURIComponent(options.studioSessionId)}`,
      { cache: "no-store" }
    );
    const data = await parseJson(lookup);
    if (data.kind === "structured" && data.session) {
      const session = withSessionId(
        data.session as PosterGenerationSession,
        data.session.id
      );
      saveEngineSessionId(options.studioSessionId, session.id);
      return { session, created: false };
    }
  } catch {
    /* create */
  }

  const res = await authFetch("/api/creative-studio/poster/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studioSessionId: options.studioSessionId,
      brandId: options.brandId || null,
      productId: options.productId || null,
      brief: options.brief ? slimBriefForApi(options.brief) : null,
    }),
  });
  const data = await parseJson(res);
  const session = withSessionId(
    data.session as PosterGenerationSession,
    data.session?.id
  );
  saveEngineSessionId(options.studioSessionId, session.id);
  return { session, created: true };
}

export async function updatePosterEngineBrief(
  engineSessionId: string,
  brief: CreativeBrief
): Promise<PosterGenerationSession> {
  const sid = assertEngineSessionId(engineSessionId, "updateBrief");
  const res = await authFetch(
    `/api/creative-studio/poster/session/${sid}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateBrief",
        brief: slimBriefForApi(brief),
      }),
    }
  );
  const data = await parseJson(res);
  return withSessionId(data.session as PosterGenerationSession, sid);
}

export async function runPosterStrategy(
  engineSessionId: string,
  forceRegenerate = false
): Promise<{ strategy: unknown; session: PosterGenerationSession }> {
  const sid = assertEngineSessionId(engineSessionId, "runPosterStrategy");
  const res = await authFetch(
    `/api/creative-studio/poster/strategy?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        forceRegenerate: forceRegenerate === true,
      }),
    }
  );
  const data = await parseJson(res);
  return { strategy: data.strategy, session: data.session };
}

export async function runPosterConcepts(
  engineSessionId: string,
  options: { conceptCount?: number; forceRegenerate?: boolean } = {}
): Promise<{
  concepts: CreativeConcept[];
  session: PosterGenerationSession;
}> {
  const sid = assertEngineSessionId(engineSessionId, "runPosterConcepts");
  const res = await authFetch(
    `/api/creative-studio/poster/concepts?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        conceptCount: options.conceptCount,
        forceRegenerate: options.forceRegenerate === true,
      }),
    }
  );
  const data = await parseJson(res);
  return {
    concepts: (data.concepts || []) as CreativeConcept[],
    session: data.session,
  };
}

export async function selectPosterConcept(
  engineSessionId: string,
  conceptId: string
): Promise<PosterGenerationSession> {
  const sid = assertEngineSessionId(engineSessionId, "selectPosterConcept");
  const res = await authFetch(
    `/api/creative-studio/poster/concepts?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        action: "select",
        conceptIds: [conceptId],
      }),
    }
  );
  const data = await parseJson(res);
  // select endpoint returns partial session — reload full
  const full = await authFetch(
    `/api/creative-studio/poster/session/${sid}`,
    { cache: "no-store" }
  );
  const fullData = await parseJson(full);
  return withSessionId(
    (fullData.session || data.session) as PosterGenerationSession,
    sid
  );
}

export async function generatePosterEngine(options: {
  engineSessionId: string;
  conceptId: string;
  variantCount: number;
  forceRegenerate?: boolean;
}): Promise<{
  outcomes: Array<{
    success: boolean;
    generationId: string;
    asset: PosterGeneratedAsset;
  }>;
  creditsCharged: number;
  successfulVariants: number;
  failedVariants: number;
  partial: boolean;
  session: PosterGenerationSession;
}> {
  const sid = assertEngineSessionId(
    options.engineSessionId,
    "generatePosterEngine"
  );
  const res = await authFetch(
    `/api/creative-studio/poster/generate?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        conceptId: options.conceptId,
        variantCount: options.variantCount,
        forceRegenerate: options.forceRegenerate === true,
      }),
    }
  );
  const data = await parseJson(res);
  return {
    outcomes: (data.outcomes || []).map((o: any) => ({
      success: !!o.success,
      generationId: o.generationId,
      asset: {
        ...(o.asset || {}),
        imageUrl: o.asset?.imageUrl || "",
        generationId: o.generationId || o.asset?.generationId,
        status: o.asset?.status || (o.success ? "generated" : "failed"),
        errorMessage: o.asset?.errorMessage || null,
      },
    })),
    creditsCharged: data.creditsCharged ?? 0,
    successfulVariants: data.successfulVariants ?? 0,
    failedVariants: data.failedVariants ?? 0,
    partial: !!data.partial,
    session: data.session,
  };
}

export async function runPosterQcClient(
  engineSessionId: string,
  generationId: string
): Promise<{ qc: PosterQcResult; creditsCharged: 0 }> {
  const sid = assertEngineSessionId(engineSessionId, "runPosterQcClient");
  const res = await authFetch(
    `/api/creative-studio/poster/qc?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        generationId,
      }),
    }
  );
  const data = await parseJson(res);
  return { qc: data.qc as PosterQcResult, creditsCharged: 0 };
}

export type PosterIterationPlanPreview = {
  iterationId: string;
  mode: "LOCAL" | "DESIGN" | "CREATIVE" | "FULL";
  userRequest: string;
  userFacingSummary: string;
  target: string;
  preserved: string[];
  parentGenerationId: string;
};

export async function planPosterIterationClient(options: {
  engineSessionId: string;
  generationId: string;
  request: string;
}): Promise<PosterIterationPlanPreview> {
  const sid = assertEngineSessionId(
    options.engineSessionId,
    "planPosterIteration"
  );
  const res = await authFetch(
    `/api/creative-studio/poster/iterate?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        generationId: options.generationId,
        request: options.request,
        action: "plan",
      }),
    }
  );
  const data = await parseJson(res);
  const mode = (data.plan?.mode || "LOCAL") as PosterIterationPlanPreview["mode"];
  const preserved =
    mode === "FULL"
      ? ["Product identity preserved", "Campaign strategy preserved"]
      : mode === "CREATIVE"
        ? [
            "Product identity preserved",
            "Marketing objective preserved",
            "Campaign strategy preserved",
          ]
        : mode === "DESIGN"
          ? [
              "Product identity preserved",
              "Marketing message preserved",
              "Campaign objective preserved",
            ]
          : [
              "Product identity preserved",
              "Marketing message preserved",
              "Creative direction preserved",
            ];

  return {
    iterationId: data.plan.iterationId,
    mode,
    userRequest: data.plan.userRequest,
    userFacingSummary: data.plan.userFacingSummary,
    target: data.plan.target,
    preserved,
    parentGenerationId: data.plan.parentGenerationId,
  };
}

export async function executePosterIterationClient(options: {
  engineSessionId: string;
  iterationId: string;
}): Promise<{
  generationId: string;
  imageUrl: string;
  versionNumber: number;
  parentGenerationId: string | null;
  creditsCharged: number;
  qcSummary: string | null;
  qcPassed: boolean | null;
}> {
  const sid = assertEngineSessionId(
    options.engineSessionId,
    "executePosterIteration"
  );
  const res = await authFetch(
    `/api/creative-studio/poster/iterate?sessionId=${encodeURIComponent(sid)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        iterationId: options.iterationId,
        action: "execute",
      }),
    }
  );
  const data = await parseJson(res);
  return {
    generationId: data.generationId,
    imageUrl: data.asset?.imageUrl,
    versionNumber: data.asset?.versionNumber ?? 2,
    parentGenerationId: data.asset?.parentGenerationId || null,
    creditsCharged: data.creditsCharged ?? 0,
    qcSummary: data.qc?.summary || null,
    qcPassed: data.qc ? !!data.qc.passed : null,
  };
}

export function qcToResultStatus(
  qc: PosterQcResult | null | undefined,
  assetStatus: string
): "ready" | "review" | "failed" {
  if (assetStatus === "failed") return "failed";
  if (!qc) return "review";
  if (qc.passed || qc.status === "pass") return "ready";
  if (qc.status === "fix_local") return "review";
  return "review";
}

export function mapSessionAssetsToResults(
  session: PosterGenerationSession
): PosterEngineResultItem[] {
  const generated = (session.assets || []).filter(
    (a) => a.status === "generated" && a.imageUrl
  );
  const active = generated.filter((a) => a.isActive !== false);
  const pool = active.length ? active : generated;

  // One card per variant lineage — highest version wins
  const byVariant = new Map<string, (typeof pool)[number]>();
  for (const a of pool) {
    const key = a.variantId || a.generationId;
    const prev = byVariant.get(key);
    if (!prev || (a.versionNumber || 1) >= (prev.versionNumber || 1)) {
      byVariant.set(key, a);
    }
  }

  return [...byVariant.values()].map((a) => ({
    generationId: a.generationId,
    variantId: a.variantId,
    imageUrl: a.imageUrl,
    conceptId: a.conceptId,
    status: qcToResultStatus(a.qc, a.status),
    qcSummary: a.qc?.summary || null,
    qcIssues: (a.qc?.issues || []).map((i) => i.message),
    qc: a.qc || null,
    parentGenerationId: a.parentGenerationId || null,
    versionNumber: a.versionNumber,
  }));
}
