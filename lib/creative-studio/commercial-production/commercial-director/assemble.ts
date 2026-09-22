/**
 * Normalize / assemble LLM draft → CommercialBlueprintCore.
 */

import type { CampaignBrief } from "../campaign/types";
import type { QCCheckId, QCResult } from "../qc/types";
import { DEFAULT_SHOT_QC_CHECKS } from "../qc/types";
import type { ContinuityLock } from "../continuity/types";
import type {
  ArtifactRisk,
  BrandStrategy,
  CommercialBlueprintCore,
  CommercialQCRequirements,
  EditorialPlan,
  ExploredCreativeConcept,
  PlatformStrategy,
  ProductStrategy,
  SelectedConcept,
  SoundDesignIntent,
  VisualBeat,
  VisualTreatment,
} from "./types";

export interface DirectorDraft {
  exploredConcepts?: ExploredCreativeConcept[];
  selectedConceptId?: string;
  rationale?: string;
  selectedConcept?: Partial<SelectedConcept> | SelectedConcept;
  creativeStrategy?: Record<string, unknown>;
  visualTreatment?: Partial<VisualTreatment> | VisualTreatment;
  visualBeats?: Array<Partial<VisualBeat> | VisualBeat>;
  editorialPlan?: Record<string, unknown> | EditorialPlan;
  soundDesignIntent?: Record<string, unknown> | SoundDesignIntent;
  productStrategy?: Record<string, unknown> | ProductStrategy;
  brandStrategy?: Record<string, unknown> | BrandStrategy;
  platformStrategy?: Record<string, unknown> | PlatformStrategy;
  continuityLock?: Record<string, unknown> | ContinuityLock;
  artifactRisks?: Array<Partial<ArtifactRisk> | ArtifactRisk>;
  commercialQCRequirements?:
    | (Partial<CommercialQCRequirements> & Record<string, unknown>)
    | CommercialQCRequirements;
}

const QC_IDS = new Set<string>(DEFAULT_SHOT_QC_CHECKS);

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pendingQCStub(requirements: CommercialQCRequirements): QCResult {
  return {
    passed: false,
    score: 0,
    severity: "info",
    recommendedAction: "manual_review",
    issues: requirements.checks.map((check) => ({
      check,
      severity: "info" as const,
      message: `Pending QC: ${check}`,
    })),
  };
}

function normalizeQCChecks(raw: unknown): QCCheckId[] {
  if (!Array.isArray(raw)) {
    return [
      "product_identity",
      "visual_treatment",
      "continuity",
      "product_visibility",
      "artifact_risk",
      "campaign_relevance",
    ];
  }
  const mapped = raw
    .map((c) => String(c))
    .map((c) => c.replace(/brand_consistency_via_campaign_relevance/i, "campaign_relevance"))
    .filter((c): c is QCCheckId => QC_IDS.has(c));
  return mapped.length >= 3 ? mapped : DEFAULT_SHOT_QC_CHECKS.slice(0, 6);
}

export function assembleBlueprintFromDraft(
  brief: CampaignBrief,
  draft: DirectorDraft
): CommercialBlueprintCore {
  const duration = brief.campaignDuration;
  const explored = Array.isArray(draft.exploredConcepts)
    ? draft.exploredConcepts.map((c, i) => ({
        id: str(c.id, `explore-${i + 1}`),
        title: str(c.title, `Direction ${i + 1}`),
        coreIdea: str(c.coreIdea),
        creativeConcept: str(c.creativeConcept),
        emotionalDirection: str(c.emotionalDirection),
        visualMetaphor: c.visualMetaphor ? str(c.visualMetaphor) : undefined,
        oneLinePitch: str(c.oneLinePitch),
        narrativeMechanism: str(c.narrativeMechanism),
        productInteraction: str(c.productInteraction),
        visualLanguage: str(c.visualLanguage),
        campaignFitNotes: str(c.campaignFitNotes),
      }))
    : [];

  const selectedFromExplore =
    explored.find((c) => c.id === draft.selectedConceptId) || explored[0];

  const selectedConcept: SelectedConcept = {
    title: str(draft.selectedConcept?.title, selectedFromExplore?.title || ""),
    coreIdea: str(draft.selectedConcept?.coreIdea, selectedFromExplore?.coreIdea || ""),
    creativeConcept: str(
      draft.selectedConcept?.creativeConcept,
      selectedFromExplore?.creativeConcept || ""
    ),
    emotionalDirection: str(
      draft.selectedConcept?.emotionalDirection,
      selectedFromExplore?.emotionalDirection || ""
    ),
    visualMetaphor:
      str(
        draft.selectedConcept?.visualMetaphor,
        selectedFromExplore?.visualMetaphor || ""
      ) || undefined,
    oneLinePitch: str(
      draft.selectedConcept?.oneLinePitch,
      selectedFromExplore?.oneLinePitch || ""
    ),
    campaignFitRationale: str(
      draft.selectedConcept?.campaignFitRationale,
      selectedFromExplore?.campaignFitNotes || draft.rationale || ""
    ),
    sourceConcept: brief.selectedConcept,
  };

  const cs = (draft.creativeStrategy || {}) as Record<string, unknown>;
  const creativeStrategy = {
    campaignGoal: str(
      cs.campaignGoal,
      String(brief.marketingObjective || brief.creativeStrategy?.campaignGoal || "Drive Sales")
    ),
    targetAudience: str(
      cs.targetAudience,
      brief.targetAudience || brief.creativeStrategy?.targetAudience || "Audience not fully specified"
    ),
    creativeAngle: str(cs.creativeAngle, selectedConcept.creativeConcept),
    coreMessage: str(cs.coreMessage, brief.campaignMessage || selectedConcept.oneLinePitch),
    corePainPoint: str(cs.corePainPoint, brief.creativeStrategy?.corePainPoint || "Not specified in brief"),
    coreDesire: str(cs.coreDesire, brief.creativeStrategy?.coreDesire || "Not specified in brief"),
    biggestObjection: str(
      cs.biggestObjection,
      brief.creativeStrategy?.biggestObjection || "Not specified in brief"
    ),
    hookType: str(cs.hookType, String(brief.hookType || brief.creativeStrategy?.hookType || "Auto")),
    cta: str(cs.cta, brief.creativeStrategy?.cta || "Learn more"),
    conversionObjective: str(
      cs.conversionObjective,
      brief.creativeStrategy?.conversionObjective || str(cs.campaignGoal, "Drive Sales")
    ),
    productIntelligence: brief.creativeStrategy?.productIntelligence,
    frameworkId: brief.creativeStrategy?.frameworkId,
    emotionalDrivers: brief.creativeStrategy?.emotionalDrivers,
  };

  const vt = (draft.visualTreatment || {}) as Partial<VisualTreatment>;
  const visualTreatment: VisualTreatment = {
    visualStyle: str(vt.visualStyle),
    lighting: str(vt.lighting),
    colorLanguage: str(vt.colorLanguage),
    environment: str(vt.environment),
    cameraLanguage: str(vt.cameraLanguage),
    lensLanguage: str(vt.lensLanguage),
    texture: str(vt.texture),
    productionDesign: str(vt.productionDesign),
    typographyDirection: str(
      vt.typographyDirection,
      "Prefer no on-screen text or logo overlays; brand lock via product and end frame only"
    ),
    motionLanguage: str(vt.motionLanguage),
    pacing: str(vt.pacing),
  };

  const beatsRaw = Array.isArray(draft.visualBeats) ? draft.visualBeats : [];
  const visualBeats: VisualBeat[] = beatsRaw.map((raw, i) => {
    const b = raw as Partial<VisualBeat> & { productVisible?: boolean; productVisibility?: string };
    const start = Math.max(0, Math.min(duration, num(b.timestampStartSeconds, (i * duration) / Math.max(beatsRaw.length, 1))));
    let end = Math.max(
      start + 0.5,
      Math.min(duration, num(b.timestampEndSeconds, start + duration / Math.max(beatsRaw.length, 1)))
    );
    if (end <= start) end = Math.min(duration, start + 1);
    return {
      id: str(b.id, `beat-${i + 1}`),
      zone: str(b.zone, `zone-${i + 1}`),
      purpose: str(b.purpose, str(b.intent, "story beat")),
      timestampStartSeconds: Number(start.toFixed(2)),
      timestampEndSeconds: Number(end.toFixed(2)),
      emotion: str(b.emotion),
      intent: str(b.intent),
      productVisible: bool(b.productVisible, false),
      productVisibility:
        b.productVisibility === "none" ||
        b.productVisibility === "implied" ||
        b.productVisibility === "partial" ||
        b.productVisibility === "hero"
          ? b.productVisibility
          : bool(b.productVisible, false)
            ? "partial"
            : "none",
    };
  });

  const ep = (draft.editorialPlan || {}) as Record<string, unknown>;
  const editorialPlan = {
    storyStructure: str(ep.storyStructure),
    pacing: str(ep.pacing),
    transitionStrategy: str(ep.transitionStrategy),
    cuttingRhythm: str(ep.cuttingRhythm),
    heroMomentSeconds: Math.max(
      0,
      Math.min(duration, num(ep.heroMomentSeconds, Math.round(duration * 0.7)))
    ),
  };

  const sd = (draft.soundDesignIntent || {}) as Record<string, unknown>;
  const soundDesignIntent = {
    music: str(sd.music) || undefined,
    voiceover: str(sd.voiceover) || undefined,
    soundEffects: str(sd.soundEffects) || undefined,
    silenceStrategy: str(sd.silenceStrategy) || undefined,
  };

  const ps = (draft.productStrategy || {}) as Record<string, unknown>;
  const productStrategy = {
    visibilityRequirements: str(ps.visibilityRequirements),
    heroMoments: Array.isArray(ps.heroMoments)
      ? (ps.heroMoments as unknown[]).map((h) => str(h)).filter(Boolean)
      : [],
    identityLock: str(ps.identityLock, `Match ${brief.product.name} packaging and label exactly`),
    avoidRegeneratingProductWhenReferenceExists: bool(
      ps.avoidRegeneratingProductWhenReferenceExists,
      true
    ),
    firstAppearanceSeconds: num(ps.firstAppearanceSeconds, editorialPlan.heroMomentSeconds * 0.6),
    becomesImportantSeconds: num(ps.becomesImportantSeconds, editorialPlan.heroMomentSeconds),
    prominence: str(ps.prominence) || undefined,
    interaction: str(ps.interaction) || undefined,
    packagingVisibility: str(ps.packagingVisibility) || undefined,
    revealStrategy: str(ps.revealStrategy) || undefined,
    finalCtaFrame: str(ps.finalCtaFrame) || undefined,
  };

  const brandUnknowns: string[] = [];
  if (!brief.brand.personality) brandUnknowns.push("personality not provided in brief");
  if (!brief.brand.tone && !brief.brand.voice) brandUnknowns.push("tone/voice not provided");
  if (!brief.brand.visualPreferences) brandUnknowns.push("visual preferences not provided");
  if (!brief.brand.primaryColors?.length) brandUnknowns.push("brand colors not provided");

  const bs = (draft.brandStrategy || {}) as Record<string, unknown>;
  const brandStrategy = {
    personality: str(
      bs.personality,
      brief.brand.personality || "Personality not provided — do not invent a brand persona"
    ),
    message: str(bs.message, brief.campaignMessage || brief.brand.tagline || selectedConcept.oneLinePitch),
    doNotLookGeneric: str(bs.doNotLookGeneric),
    differentiation: str(bs.differentiation),
    tone: str(bs.tone, brief.brand.tone || brief.brand.voice) || undefined,
    visualIdentity: str(bs.visualIdentity, brief.brand.visualPreferences) || undefined,
    communicationStyle: str(bs.communicationStyle) || undefined,
    constraints: Array.isArray(bs.constraints)
      ? (bs.constraints as unknown[]).map((c) => str(c)).filter(Boolean)
      : [],
    unknowns: Array.isArray(bs.unknowns)
      ? [...new Set([...(bs.unknowns as unknown[]).map((u) => str(u)).filter(Boolean), ...brandUnknowns])]
      : brandUnknowns,
  };

  const pls = (draft.platformStrategy || {}) as Record<string, unknown>;
  const platformStrategy = {
    platform: brief.platform,
    aspectRatio: brief.aspectRatio,
    safeAreas: str(pls.safeAreas) || undefined,
    firstFrameHook: str(pls.firstFrameHook),
    framing: str(pls.framing) || undefined,
    pacingInfluence: str(pls.pacingInfluence) || undefined,
    textUsage: str(pls.textUsage, "Avoid on-screen text overlays") || undefined,
    hookTiming: str(pls.hookTiming) || undefined,
    composition: str(pls.composition) || undefined,
    ctaStrategy: str(pls.ctaStrategy) || undefined,
  };

  const cl = (draft.continuityLock || {}) as Record<string, unknown>;
  const continuityLock = {
    character: str(cl.character) || undefined,
    wardrobe: str(cl.wardrobe) || undefined,
    location: str(cl.location) || undefined,
    lighting: str(cl.lighting) || undefined,
    timeOfDay: str(cl.timeOfDay) || undefined,
    product: str(cl.product, `${brief.product.name} identity lock`) || undefined,
    colorGrade: str(cl.colorGrade) || undefined,
    visualTreatmentSummary: str(cl.visualTreatmentSummary, visualTreatment.visualStyle) || undefined,
  };

  const artifactRisks: ArtifactRisk[] = (
    Array.isArray(draft.artifactRisks) ? draft.artifactRisks : []
  ).map((raw, i) => {
    const r = raw as Partial<ArtifactRisk>;
    return {
      id: str(r.id, `risk-${i + 1}`),
      category: (str(r.category, "other") as ArtifactRisk["category"]) || "other",
      description: str(r.description),
      severity:
        r.severity === "low" || r.severity === "medium" || r.severity === "high"
          ? r.severity
          : "medium",
      mitigation: str(r.mitigation),
    };
  });

  const qcr = (draft.commercialQCRequirements || {}) as Partial<CommercialQCRequirements> &
    Record<string, unknown>;
  const commercialQCRequirements: CommercialQCRequirements = {
    checks: normalizeQCChecks(qcr.checks),
    productIdentity: str(qcr.productIdentity, `Verify ${brief.product.name} identity against references`),
    brandConsistency: str(
      qcr.brandConsistency,
      `Verify tone/personality alignment with ${brief.brand.name} without inventing missing brand facts`
    ),
    visualContinuity: str(
      qcr.visualContinuity,
      "Verify continuity locks: character, wardrobe, location, lighting, product, grade"
    ),
    conceptAdherence: str(
      qcr.conceptAdherence,
      `Verify execution follows selected concept: ${selectedConcept.title}`
    ),
    productVisibility: str(
      qcr.productVisibility,
      productStrategy.visibilityRequirements || "Verify product appears per product strategy"
    ),
    visualTreatmentConsistency: str(
      qcr.visualTreatmentConsistency,
      "Verify all shots honor the campaign VisualTreatment DNA"
    ),
    artifactRiskChecks: Array.isArray(qcr.artifactRiskChecks)
      ? (qcr.artifactRiskChecks as unknown[]).map((x) => str(x)).filter(Boolean)
      : artifactRisks.map((r) => r.description),
  };

  return {
    campaignId: brief.campaignId,
    selectedConcept,
    exploredConcepts: explored.length ? explored : undefined,
    creativeStrategy,
    visualTreatment,
    visualBeats,
    editorialPlan,
    soundDesignIntent,
    productStrategy,
    brandStrategy,
    platformStrategy,
    campaignDuration: duration,
    aspectRatio: brief.aspectRatio,
    continuityLock,
    commercialQCRequirements,
    commercialQC: pendingQCStub(commercialQCRequirements),
    artifactRisks,
    createdAt: new Date().toISOString(),
  };
}
