/**
 * Campaign compiler fixtures.
 */

import { makeValidBrief, makeValidBlueprint } from "../commercial-director/fixtures";
import {
  makeProtein30sBlueprint,
  makeValid15sShotPlan,
  makeValidProtein30sShotPlan,
} from "../shot-planner/fixtures";
import { makeAvailableAssets, makeProductAsset } from "../reference-engine/fixtures";
import type { CompileCampaignGenerationInput } from "./types";

export function make15sCompileInput(
  overrides: Partial<CompileCampaignGenerationInput> = {}
): CompileCampaignGenerationInput {
  const plan = makeValid15sShotPlan();
  const blueprint = makeValidBlueprint({
    campaignId: plan.campaignId,
    campaignDuration: 15,
    aspectRatio: "9:16",
  });
  return {
    blueprint,
    shotPlan: plan,
    availableAssets: makeAvailableAssets(),
    generationVersion: "v1",
    generationMode: "native_continuous",
    ...overrides,
  };
}

export function make30sCompileInput(
  overrides: Partial<CompileCampaignGenerationInput> = {}
): CompileCampaignGenerationInput {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  return {
    blueprint,
    shotPlan: plan,
    availableAssets: makeAvailableAssets(),
    generationVersion: "v1",
    generationMode: "native_continuous",
    ...overrides,
  };
}

export { makeValidBrief, makeAvailableAssets, makeProductAsset };
