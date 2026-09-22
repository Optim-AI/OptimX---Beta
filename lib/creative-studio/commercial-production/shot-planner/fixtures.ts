/**
 * Realistic shot-plan fixtures for Phase 3 tests (no live AI).
 */

import { makeValidBlueprint } from "../commercial-director/fixtures";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import { defaultStrategyForId } from "../generation/types";
import type { CommercialShot, ShotPlan } from "./types";

export function makeProtein30sBlueprint(): CommercialBlueprintCore {
  const base = makeValidBlueprint({
    campaignId: "camp_protein_30",
    campaignDuration: 30,
    aspectRatio: "9:16",
  });

  return {
    ...base,
    campaignId: "camp_protein_30",
    campaignDuration: 30,
    selectedConcept: {
      ...base.selectedConcept,
      title: "Rushed Morning → Calm Fuel",
      coreIdea:
        "A chaotic morning transforms into a calm, energized routine once the protein ritual lands",
      creativeConcept:
        "Temporal contrast commercial: handheld morning chaos resolves into controlled product ritual",
      emotionalDirection: "Anxiety → focus → calm energy",
      oneLinePitch: "The morning stops spinning when the fuel is simple",
      campaignFitRationale: "Awareness + habit formation for busy adults",
    },
    visualBeats: [
      {
        id: "beat-1",
        zone: "chaos",
        purpose: "Establish rushed morning",
        timestampStartSeconds: 0,
        timestampEndSeconds: 6,
        emotion: "Anxiety",
        intent: "Alarm, hurry, unfinished kitchen",
        productVisible: false,
        productVisibility: "none",
      },
      {
        id: "beat-2",
        zone: "friction",
        purpose: "Agitate the skip-breakfast problem",
        timestampStartSeconds: 6,
        timestampEndSeconds: 12,
        emotion: "Frustration",
        intent: "Empty fridge glance / time pressure",
        productVisible: false,
        productVisibility: "implied",
      },
      {
        id: "beat-3",
        zone: "product_enter",
        purpose: "Product discovered as the simple answer",
        timestampStartSeconds: 12,
        timestampEndSeconds: 20,
        emotion: "Focus",
        intent: "Hands find and prepare protein",
        productVisible: true,
        productVisibility: "partial",
      },
      {
        id: "beat-4",
        zone: "transform",
        purpose: "Energy and calm settle in",
        timestampStartSeconds: 20,
        timestampEndSeconds: 26,
        emotion: "Relief",
        intent: "Breath, posture change, readiness",
        productVisible: true,
        productVisibility: "partial",
      },
      {
        id: "beat-5",
        zone: "hero",
        purpose: "Product hero resolve",
        timestampStartSeconds: 26,
        timestampEndSeconds: 30,
        emotion: "Confidence",
        intent: "Stable package hero",
        productVisible: true,
        productVisibility: "hero",
      },
    ],
    editorialPlan: {
      ...base.editorialPlan,
      storyStructure: "chaos → friction → ritual → calm → hero",
      pacing: "fast → pause → controlled → hold",
      heroMomentSeconds: 28,
    },
    productStrategy: {
      ...base.productStrategy,
      firstAppearanceSeconds: 12,
      becomesImportantSeconds: 16,
      visibilityRequirements: "No product in opening chaos; clear mid-spot; hero at end",
    },
  };
}

function baseShot(partial: Partial<CommercialShot> & Pick<CommercialShot, "id" | "sequence" | "durationSeconds" | "role" | "shotWhy" | "visualDescription" | "subject" | "productVisibility" | "generationStrategy">): CommercialShot {
  const productReferenceRequired =
    partial.referenceRequirements?.productReferenceRequired ??
    (partial.productVisibility === "hero" ||
      partial.productVisibility === "pack-shot" ||
      partial.productVisibility === "prominent" ||
      partial.role === "product_hero" ||
      partial.generationStrategy.requiresProductReference);

  const generationStrategy = {
    ...partial.generationStrategy,
    requiresProductReference:
      productReferenceRequired || partial.generationStrategy.requiresProductReference,
    requiresKeyframe:
      Boolean(partial.referenceRequirements?.keyframeRequired) ||
      partial.generationStrategy.requiresKeyframe,
  };

  const shot: CommercialShot = {
    beatIds: partial.beatIds || [],
    storyBeat: partial.storyBeat || partial.role,
    productVisibilityReason:
      partial.productVisibilityReason ||
      (partial.productVisibility === "none"
        ? "Product delayed for story"
        : "Product supports this moment"),
    environment: partial.environment || "Apartment kitchen, early morning",
    framing: partial.framing || "Medium close, vertical 9:16",
    cameraMovement: partial.cameraMovement || "Intimate handheld inheriting campaign treatment",
    lighting: partial.lighting || "Cool morning window light shifting warmer after product ritual",
    composition:
      partial.composition ||
      "Subject left-third, counter midground, doorway background; product enters foreground-right when visible",
    transitionIn: partial.transitionIn ?? (partial.sequence === 1 ? "none" : "cut"),
    transitionOut: partial.transitionOut ?? "cut",
    referenceRequirements: partial.referenceRequirements || {
      productImages: productReferenceRequired,
      keyframe: generationStrategy.requiresKeyframe,
      startFrame: generationStrategy.requiresStartFrame,
      endFrame: false,
      styleReferences: false,
      productReferenceRequired,
      productReferenceReason: productReferenceRequired
        ? "Visible packaging must match Pulse Protein+ identity"
        : "Product not material in frame",
      strategyType: productReferenceRequired
        ? generationStrategy.requiresKeyframe
          ? "generated_keyframe"
          : "existing_product_image"
        : "none",
      purpose: productReferenceRequired
        ? "Lock product packaging before generative video"
        : "No product reference required",
      characterReference: Boolean(partial.characterContinuity?.length),
      keyframeRequired: generationStrategy.requiresKeyframe,
      keyframeRationale: generationStrategy.requiresKeyframe
        ? "Exact composition and packaging control needed before image-to-video"
        : "Direct generation acceptable without keyframe",
    },
    continuity: partial.continuity || {
      lock: makeValidBlueprint().continuityLock,
      continuesFromShotIds: [],
      mustMatch: [],
    },
    artifactRisk: partial.artifactRisk || "hands; packaging text",
    artifactRisks: partial.artifactRisks || [
      {
        id: `${partial.id}-risk-1`,
        risk: "packaging_text",
        severity: "medium",
        reason: "Label may warp if product is visible",
        mitigation: "Use product reference; keep label-facing angles simple",
      },
    ],
    qcRequirements: partial.qcRequirements || [
      "visual_treatment",
      "continuity",
      "campaign_relevance",
    ],
    generationRequired: partial.generationRequired ?? true,
    estimatedComplexity: partial.estimatedComplexity || "medium",
    referenceRequired:
      partial.referenceRequired ??
      (productReferenceRequired || generationStrategy.requiresKeyframe),
    lens: partial.lens || "50mm equivalent",
    ...partial,
    generationStrategy,
  };

  if (shot.referenceRequirements.productReferenceRequired) {
    shot.generationStrategy.requiresProductReference = true;
  }
  if (shot.referenceRequirements.keyframeRequired) {
    shot.generationStrategy.requiresKeyframe = true;
  }
  return shot;
}

/** Valid 30s protein campaign shot plan demonstrating Phase 3 requirements. */
export function makeValidProtein30sShotPlan(): ShotPlan {
  const blueprint = makeProtein30sBlueprint();
  const lock = blueprint.continuityLock;

  const shots: CommercialShot[] = [
    baseShot({
      id: "shot-1",
      sequence: 1,
      durationSeconds: 4,
      role: "hook",
      beatIds: ["beat-1"],
      shotWhy:
        "Open on the rushed-morning problem with a pattern interrupt before any product appears, establishing the chaos the ritual will resolve",
      storyBeat: "Morning chaos",
      visualDescription:
        "A young professional jolts awake as an alarm blares; handheld camera follows them swinging out of bed in a small apartment, still wearing yesterday's work shirt, hair messy, phone flashlight cutting cool morning blue across an unmade bed and a half-open door toward the kitchen",
      subject: "Young professional (Character A) waking late",
      productVisibility: "none",
      productVisibilityReason: "Delay product to sell the problem first",
      generationStrategy: defaultStrategyForId(
        "text-to-video",
        "Atmospheric character hook without product geometry — text-to-video is sufficient"
      ),
      continuity: { lock, continuesFromShotIds: [], mustMatch: [] },
      characterContinuity: [
        {
          characterId: "char-a",
          identity: "Young professional woman, early 30s, short dark hair, tired expression",
          ageRange: "28-35",
          wardrobe: "Charcoal work shirt",
          mustMatch: ["face", "hair", "wardrobe"],
          roleInStory: "Protagonist",
        },
      ],
      productState: { state: "absent", description: "Product not yet in story" },
      qcRequirements: ["subject_consistency", "motion_quality", "visual_treatment", "campaign_relevance"],
      estimatedComplexity: "medium",
      artifactRisks: [
        {
          id: "s1-r1",
          risk: "anatomy_hands",
          severity: "medium",
          reason: "Fast wake-up motion can distort limbs",
          mitigation: "Keep motion readable; avoid extreme blur of hands near face",
        },
      ],
    }),
    baseShot({
      id: "shot-2",
      sequence: 2,
      durationSeconds: 4,
      role: "problem",
      beatIds: ["beat-1", "beat-2"],
      shotWhy:
        "Extend the morning friction into the kitchen so the upcoming product ritual has narrative earnedness rather than appearing as a random pack insert",
      storyBeat: "Kitchen friction",
      visualDescription:
        "Same woman moves quickly through the compact kitchen; open laptop and cold coffee mug sit on the counter while she opens an empty fridge door, cool practical light, hurried handheld following her path from doorway to counter — no product package visible yet",
      subject: "Character A + empty fridge / kitchen friction",
      productVisibility: "none",
      generationStrategy: defaultStrategyForId(
        "text-to-video",
        "Environment and action without product identity — text-to-video"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-1"],
        mustMatch: [
          "same woman face and hair",
          "same charcoal work shirt",
          "same apartment morning",
          "cool morning light",
        ],
        mustMatchDimensions: ["character", "face", "hair", "wardrobe", "location", "time_of_day", "lighting"],
      },
      continuityDimensions: ["character", "face", "hair", "wardrobe", "location", "time_of_day", "lighting"],
      characterContinuity: [
        {
          characterId: "char-a",
          identity: "Same young woman established in shot-1",
          wardrobe: "Charcoal work shirt",
          mustMatch: ["face", "hair", "wardrobe"],
        },
      ],
      productState: { state: "absent", description: "Still no product", transitionsFromShotId: "shot-1" },
      qcRequirements: ["continuity", "subject_consistency", "visual_treatment", "campaign_relevance"],
    }),
    baseShot({
      id: "shot-3",
      sequence: 3,
      durationSeconds: 5,
      role: "product_introduction",
      beatIds: ["beat-3"],
      shotWhy:
        "Introduce Pulse Protein+ as the discovered answer on the counter, shifting rhythm from chaotic handheld to more controlled product-aware framing without jumping straight to a sterile pack shot",
      storyBeat: "Product discovered",
      visualDescription:
        "Camera settles slightly as Character A notices the Pulse Protein+ tub on the kitchen counter beside the coffee mug; her hand reaches and rotates the closed package so the label faces camera in the foreground-right third while laptop remains soft in background",
      subject: "Character A discovering closed Pulse Protein+ tub",
      productVisibility: "partial",
      productVisibilityReason: "First clear product appearance as narrative discovery",
      generationStrategy: defaultStrategyForId(
        "product-reference-first",
        "Packaging becomes readable — product reference required before motion"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-2"],
        mustMatch: ["same woman", "same wardrobe", "same kitchen", "same morning window light"],
        mustMatchDimensions: ["character", "wardrobe", "location", "lighting", "product"],
      },
      characterContinuity: [
        {
          characterId: "char-a",
          identity: "Same young woman from shot-1",
          mustMatch: ["face", "hair", "wardrobe"],
        },
      ],
      productState: {
        state: "closed_package",
        description: "Tub closed, label readable",
        transitionsFromShotId: "shot-2",
      },
      qcRequirements: [
        "product_identity",
        "product_visibility",
        "continuity",
        "unwanted_text",
        "visual_treatment",
      ],
      estimatedComplexity: "high",
    }),
    baseShot({
      id: "shot-4",
      sequence: 4,
      durationSeconds: 6,
      role: "product_interaction",
      beatIds: ["beat-3", "beat-4"],
      shotWhy:
        "Show the preparation ritual that transforms chaos into calm — open package, scoop, mix — locking product state change for downstream keyframe continuity",
      storyBeat: "Preparation ritual",
      visualDescription:
        "Close-to-medium shot of hands opening the Pulse Protein+ tub, scooping powder into a clear shaker on the counter; steam-free morning light; label remains intermittently readable; motion is deliberate rather than frantic, marking the emotional turn",
      subject: "Hands + Pulse Protein+ preparation",
      productVisibility: "in-use",
      generationStrategy: defaultStrategyForId(
        "keyframe-first",
        "Complex hand+packaging interaction needs controlled keyframe before image-to-video"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-3"],
        mustMatch: ["same kitchen", "same product identity", "same morning light", "same wardrobe if arms visible"],
        mustMatchDimensions: ["location", "product", "product_state", "lighting", "wardrobe"],
      },
      productState: {
        state: "preparing",
        description: "Package opened; scooping into shaker",
        transitionsFromShotId: "shot-3",
      },
      qcRequirements: [
        "product_identity",
        "artifact_risk",
        "malformed_objects",
        "continuity",
        "product_visibility",
      ],
      artifactRisks: [
        {
          id: "s4-r1",
          risk: "hands_interaction",
          severity: "high",
          reason: "Scooping hands frequently morph fingers",
          mitigation: "Keyframe staged hands; limit finger contortion",
        },
        {
          id: "s4-r2",
          risk: "powder_physics",
          severity: "medium",
          reason: "Powder pour may look unnatural",
          mitigation: "Keep pour brief and readable",
        },
      ],
      estimatedComplexity: "high",
    }),
    baseShot({
      id: "shot-5",
      sequence: 5,
      durationSeconds: 5,
      role: "transformation",
      beatIds: ["beat-4"],
      shotWhy:
        "Pay off the emotional transformation — posture and light warm as she drinks — proving the ritual worked without needing another packaging lecture",
      storyBeat: "Calm energy",
      visualDescription:
        "Character A drinks from the shaker near the window; shoulders drop; cooler kitchen light warms slightly on her face; product tub sits partially visible on the counter behind her but is not the focus",
      subject: "Character A consuming shake",
      productVisibility: "background",
      productVisibilityReason: "Emotional payoff; product present but not hero yet",
      generationStrategy: defaultStrategyForId(
        "image-to-video",
        "Character continuity from prior keyframe/start frame preferred"
      ),
      referenceRequirements: {
        productImages: false,
        keyframe: true,
        startFrame: true,
        endFrame: false,
        styleReferences: false,
        productReferenceRequired: false,
        productReferenceReason: "Product is background only; identity already established",
        strategyType: "previous_shot",
        purpose: "Continue character appearance from prior staged frame",
        characterReference: true,
        previousShotReferenceIds: ["shot-4"],
        keyframeRequired: true,
        keyframeRationale: "Maintain face/wardrobe continuity into emotional beat",
      },
      continuity: {
        lock,
        continuesFromShotIds: ["shot-4"],
        mustMatch: ["same woman", "same wardrobe", "same kitchen", "shaker continuity"],
        mustMatchDimensions: ["character", "face", "wardrobe", "location", "props"],
      },
      characterContinuity: [
        {
          characterId: "char-a",
          identity: "Same young woman from shot-1",
          mustMatch: ["face", "hair", "wardrobe"],
        },
      ],
      productState: {
        state: "in_use_consuming",
        description: "Shake being consumed; tub open in background",
        transitionsFromShotId: "shot-4",
      },
      qcRequirements: ["continuity", "subject_consistency", "visual_treatment", "campaign_relevance"],
    }),
    baseShot({
      id: "shot-6",
      sequence: 6,
      durationSeconds: 6,
      role: "product_hero",
      beatIds: ["beat-5"],
      shotWhy:
        "Lock brand memory with a controlled product hero that honors packaging geometry after the story has earned the reveal — not a generic end pack shot pasted on chaos",
      storyBeat: "Product hero resolve",
      visualDescription:
        "Stable hero of Pulse Protein+ tub and sealed shaker on the cleared kitchen counter; label crisp and forward; warm settled morning light; shallow depth isolating product; no on-screen text",
      subject: "Pulse Protein+ tub hero with shaker",
      productVisibility: "hero",
      productVisibilityReason: "Final brand lock after narrative resolve",
      generationStrategy: defaultStrategyForId(
        "keyframe-first",
        "Exact packaging and controlled hero composition outweigh unconstrained generation"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-5"],
        mustMatch: ["same kitchen location", "same product identity", "warmer resolved lighting"],
        mustMatchDimensions: ["location", "product", "lighting", "color_grade"],
        allowedChanges: ["remove character", "tighten to product"],
      },
      productState: {
        state: "hero_display",
        description: "Closed-looking hero presentation with shaker",
        transitionsFromShotId: "shot-5",
      },
      qcRequirements: [
        "product_identity",
        "product_visibility",
        "unwanted_text",
        "composition",
        "visual_treatment",
        "artifact_risk",
      ],
      transitionOut: "fade",
      estimatedComplexity: "high",
    }),
  ];

  // Ensure durations sum to 30: 4+4+5+6+5+6=30
  return {
    campaignId: blueprint.campaignId,
    campaignDuration: 30,
    totalDurationSeconds: 30,
    continuityLock: lock,
    shots,
    continuityLinks: [
      {
        fromShotId: "shot-1",
        toShotId: "shot-2",
        dimensions: ["character", "wardrobe", "location", "lighting"],
        notes: "Character chain into kitchen",
      },
      {
        fromShotId: "shot-2",
        toShotId: "shot-3",
        dimensions: ["character", "location", "product"],
        notes: "Product enters same kitchen",
      },
      {
        fromShotId: "shot-3",
        toShotId: "shot-4",
        dimensions: ["product", "product_state", "location"],
        notes: "Package opens",
      },
      {
        fromShotId: "shot-4",
        toShotId: "shot-5",
        dimensions: ["character", "props"],
        notes: "Consume after prepare",
      },
      {
        fromShotId: "shot-5",
        toShotId: "shot-6",
        dimensions: ["location", "product"],
        notes: "Resolve to hero",
      },
    ],
  };
}

/** Compact valid 15s plan. */
export function makeValid15sShotPlan(): ShotPlan {
  const blueprint = makeValidBlueprint({ campaignDuration: 15, campaignId: "camp_15" });
  const lock = blueprint.continuityLock;
  const shots: CommercialShot[] = [
    baseShot({
      id: "shot-1",
      sequence: 1,
      durationSeconds: 3,
      role: "hook",
      beatIds: ["beat-1"],
      shotWhy:
        "Stop the scroll with after-work kitchen inertia before product appears, matching the delayed-reveal product strategy",
      visualDescription:
        "Adult drops a work bag by a kitchen doorway at dusk; handheld; product absent; cool window sidelight",
      subject: "Character entering kitchen",
      productVisibility: "none",
      generationStrategy: defaultStrategyForId("text-to-video", "Atmosphere without product"),
      continuity: { lock, continuesFromShotIds: [], mustMatch: [] },
      productState: { state: "absent", description: "No product yet" },
    }),
    baseShot({
      id: "shot-2",
      sequence: 2,
      durationSeconds: 4,
      role: "product_interaction",
      beatIds: ["beat-3"],
      shotWhy:
        "Bridge from inertia into the scoop decision — the commercial's turning action where product becomes narratively necessary",
      visualDescription:
        "Hands scoop from Pulse Protein+ tub into a shaker on the counter; label readable foreground-right; laptop soft background",
      subject: "Hands preparing product",
      productVisibility: "in-use",
      generationStrategy: defaultStrategyForId(
        "keyframe-first",
        "Hand + packaging needs keyframe control"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-1"],
        mustMatch: ["same kitchen", "same evening light"],
        mustMatchDimensions: ["location", "lighting"],
      },
      productState: {
        state: "preparing",
        description: "Scooping",
        transitionsFromShotId: "shot-1",
      },
      qcRequirements: ["product_identity", "artifact_risk", "continuity", "product_visibility"],
    }),
    baseShot({
      id: "shot-3",
      sequence: 3,
      durationSeconds: 5,
      role: "product_hero",
      beatIds: ["beat-4"],
      shotWhy:
        "End on controlled product hero so packaging memory sticks after the ritual — exact identity over motion spectacle",
      visualDescription:
        "Hero of Pulse Protein+ tub and shaker on counter; label crisp; warm settled light; no text overlays",
      subject: "Product hero",
      productVisibility: "hero",
      generationStrategy: defaultStrategyForId(
        "keyframe-first",
        "Hero packaging requires keyframe-first"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-2"],
        mustMatch: ["same product", "same counter"],
        mustMatchDimensions: ["product", "location"],
      },
      productState: {
        state: "hero_display",
        description: "Final hero",
        transitionsFromShotId: "shot-2",
      },
      qcRequirements: [
        "product_identity",
        "product_visibility",
        "unwanted_text",
        "composition",
        "visual_treatment",
      ],
    }),
    baseShot({
      id: "shot-4",
      sequence: 4,
      durationSeconds: 3,
      role: "end_card",
      beatIds: ["beat-4"],
      shotWhy:
        "Brand lock as motion graphics end card rather than forcing another generative video clip — lower artifact risk for typography/CTA",
      visualDescription:
        "Clean end card with brand mark treatment and product still underneath; minimal motion; no hallucinated logo geometry",
      subject: "End card / brand lock",
      productVisibility: "prominent",
      generationStrategy: defaultStrategyForId(
        "motion-graphics",
        "Typography/CTA end card is better as motion graphics than unconstrained video generation"
      ),
      continuity: {
        lock,
        continuesFromShotIds: ["shot-3"],
        mustMatch: ["same product identity if shown"],
        mustMatchDimensions: ["product"],
      },
      productState: {
        state: "hero_display",
        description: "End card product",
        transitionsFromShotId: "shot-3",
      },
      qcRequirements: ["unwanted_text", "campaign_relevance", "visual_treatment"],
      estimatedComplexity: "low",
    }),
  ];
  // 3+4+5+3 = 15
  return {
    campaignId: "camp_15",
    campaignDuration: 15,
    totalDurationSeconds: 15,
    continuityLock: lock,
    shots,
  };
}
