/**
 * Campaign orchestrator fixtures — mocked director/planner/providers (no live AI).
 */

import type { CampaignBrief } from "../campaign/types";
import type { CommercialBlueprintCore, CommercialDirector } from "../commercial-director/types";
import { makeValidBrief, makeValidBlueprint } from "../commercial-director/fixtures";
import type { ShotPlan, ShotPlanner, CommercialShot } from "../shot-planner/types";
import {
  makeProtein30sBlueprint,
  makeValid15sShotPlan,
  makeValidProtein30sShotPlan,
} from "../shot-planner/fixtures";
import { MockImageProvider, makeAvailableAssets } from "../reference-engine/fixtures";
import { MockVideoProvider } from "../video-executor/fixtures";
import type { CampaignOrchestratorOptions } from "./types";
import {
  InMemoryProductionManifestStore,
  InMemoryProductionRunStore,
} from "./state";
import { defaultStrategyForId } from "../generation/types";

export function makeMockDirector(blueprint: CommercialBlueprintCore): CommercialDirector {
  return {
    async direct(brief) {
      return {
        blueprint: {
          ...blueprint,
          campaignId: brief.campaignId,
          campaignDuration: brief.campaignDuration,
          aspectRatio: brief.aspectRatio,
        },
        rationale: "mock director",
      };
    },
  };
}

export function makeMockPlanner(plan: ShotPlan): ShotPlanner {
  return {
    async plan(blueprint) {
      return {
        ...plan,
        campaignId: blueprint.campaignId,
        campaignDuration: blueprint.campaignDuration,
      };
    },
  };
}

export function makeOrchestratorTestOptions(input: {
  blueprint: CommercialBlueprintCore;
  plan: ShotPlan;
  imageProvider?: MockImageProvider;
  videoProvider?: MockVideoProvider;
}): {
  options: CampaignOrchestratorOptions;
  imageProvider: MockImageProvider;
  videoProvider: MockVideoProvider;
  runStore: InMemoryProductionRunStore;
  manifestStore: InMemoryProductionManifestStore;
} {
  const imageProvider = input.imageProvider ?? new MockImageProvider();
  const videoProvider = input.videoProvider ?? new MockVideoProvider();
  const runStore = new InMemoryProductionRunStore();
  const manifestStore = new InMemoryProductionManifestStore();
  return {
    imageProvider,
    videoProvider,
    runStore,
    manifestStore,
    options: {
      director: makeMockDirector(input.blueprint),
      shotPlanner: makeMockPlanner(input.plan),
      imageProvider,
      videoProvider,
      runStore,
      manifestStore,
      log: () => undefined,
    },
  };
}

export function get15sFixture(): {
  brief: CampaignBrief;
  blueprint: CommercialBlueprintCore;
  plan: ShotPlan;
} {
  const plan = makeValid15sShotPlan();
  const brief = makeValidBrief({
    campaignId: plan.campaignId,
    campaignDuration: 15,
    aspectRatio: "9:16",
  });
  const blueprint = makeValidBlueprint({
    campaignId: plan.campaignId,
    campaignDuration: 15,
    aspectRatio: "9:16",
  });
  return { brief, blueprint, plan };
}

export function get30sFixture(): {
  brief: CampaignBrief;
  blueprint: CommercialBlueprintCore;
  plan: ShotPlan;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const brief = makeValidBrief({
    campaignId: plan.campaignId,
    campaignDuration: 30,
    aspectRatio: "9:16",
    product: {
      name: "Pulse Protein+",
      category: "protein",
      images: [],
    },
  });
  return { brief, blueprint, plan };
}

/** Plan with explicit circular dependency for negative tests. */
export function makeCircularDependencyPlan(): ShotPlan {
  const base = makeValid15sShotPlan();
  const shots = base.shots.slice(0, 2).map((s, i) => {
    const other = i === 0 ? base.shots[1].id : base.shots[0].id;
    return {
      ...s,
      continuity: {
        ...s.continuity,
        continuesFromShotIds: [other],
        mustMatch: s.continuity.mustMatch?.length
          ? s.continuity.mustMatch
          : ["circular fixture continuity"],
      },
    };
  });
  const rest = base.shots.slice(2);
  const all = [...shots, ...rest];
  const total = all.reduce((s, x) => s + x.durationSeconds, 0);
  return {
    ...base,
    shots: all,
    totalDurationSeconds: total,
  };
}

/** Invalid duration plan (sum != campaign). */
export function makeInvalidDurationPlan(): ShotPlan {
  const plan = makeValid15sShotPlan();
  const shots = plan.shots.map((s, i) =>
    i === 0 ? { ...s, durationSeconds: 10 } : s
  );
  return {
    ...plan,
    shots,
    totalDurationSeconds: shots.reduce((a, b) => a + b.durationSeconds, 0),
  };
}

export function makeIndependentShotsPlan(): ShotPlan {
  const blueprint = makeValidBlueprint({ campaignId: "camp_indep", campaignDuration: 15 });
  const lock = blueprint.continuityLock;
  const mk = (
    id: string,
    sequence: number,
    durationSeconds: number,
    strategy: "text-to-video" | "keyframe-first"
  ): CommercialShot =>
    ({
      id,
      sequence,
      durationSeconds,
      role: strategy === "keyframe-first" ? "product_hero" : "atmosphere",
      beatIds: ["beat-1"],
      shotWhy: `Independent shot ${id} for concurrency fixture — no cross-shot continuity requirement`,
      storyBeat: "parallel",
      visualDescription: `Scene for ${id}`,
      subject: "Subject",
      productVisibility: strategy === "keyframe-first" ? "hero" : "none",
      productVisibilityReason: "fixture",
      environment: "studio",
      framing: "medium",
      cameraMovement: "locked-off",
      lighting: "soft",
      composition: "centered",
      generationStrategy: defaultStrategyForId(
        strategy,
        strategy === "keyframe-first" ? "hero needs keyframe" : "atmosphere t2v"
      ),
      referenceRequirements: {
        productImages: strategy === "keyframe-first",
        keyframe: strategy === "keyframe-first",
        startFrame: strategy === "keyframe-first",
        endFrame: false,
        styleReferences: false,
        productReferenceRequired: strategy === "keyframe-first",
        productReferenceReason: "fixture",
        strategyType: strategy === "keyframe-first" ? "generated_keyframe" : "none",
        purpose: "fixture",
        keyframeRequired: strategy === "keyframe-first",
        keyframeRationale: "fixture",
      },
      continuity: { lock, continuesFromShotIds: [], mustMatch: [] },
      artifactRisk: "",
      artifactRisks: [],
      qcRequirements: ["composition"],
      generationRequired: true,
      estimatedComplexity: "low",
      referenceRequired: strategy === "keyframe-first",
      productState: {
        state: strategy === "keyframe-first" ? "hero_display" : "absent",
        description: "fixture",
      },
    }) as CommercialShot;

  // 4+4+4+3 = 15, all independent
  const shots = [
    mk("shot-a", 1, 4, "text-to-video"),
    mk("shot-b", 2, 4, "text-to-video"),
    mk("shot-c", 3, 4, "keyframe-first"),
    mk("shot-d", 4, 3, "text-to-video"),
  ];
  return {
    campaignId: "camp_indep",
    campaignDuration: 15,
    totalDurationSeconds: 15,
    continuityLock: lock,
    shots,
  };
}

export { makeAvailableAssets, MockImageProvider, MockVideoProvider };
