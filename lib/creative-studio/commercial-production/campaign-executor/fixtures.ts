/**
 * Campaign executor fixtures + re-exports of mock providers.
 */

import { makeValidBrief } from "../commercial-director/fixtures";
import { make15sCompileInput, make30sCompileInput } from "../campaign-compiler/fixtures";
import { compileCampaignGeneration } from "../campaign-compiler";
import { MockVideoProvider } from "../video-executor/fixtures";
import { makeMockDirector, makeMockPlanner } from "../campaign-orchestrator/fixtures";
import { makeAvailableAssets } from "../reference-engine/fixtures";
import type { CampaignGenerationSpec } from "../campaign-compiler/types";
import type { CampaignExecutorOptions } from "./types";

export function makeNative15sSpec(): CampaignGenerationSpec {
  return compileCampaignGeneration(make15sCompileInput());
}

export function makeNative30sSpec(): CampaignGenerationSpec {
  return compileCampaignGeneration(make30sCompileInput());
}

export function makeExecutorTestOptions(input?: {
  videoProvider?: MockVideoProvider;
  blueprint?: ReturnType<typeof make15sCompileInput>["blueprint"];
  plan?: ReturnType<typeof make15sCompileInput>["shotPlan"];
}): {
  options: CampaignExecutorOptions;
  videoProvider: MockVideoProvider;
} {
  const videoProvider = input?.videoProvider ?? new MockVideoProvider();
  const compileInput = make15sCompileInput();
  const blueprint = input?.blueprint ?? compileInput.blueprint;
  const plan = input?.plan ?? compileInput.shotPlan;
  return {
    videoProvider,
    options: {
      videoProvider,
      director: makeMockDirector(blueprint),
      shotPlanner: makeMockPlanner(plan),
      pollIntervalMs: 1,
      maxWaitMs: 5000,
      log: () => undefined,
    },
  };
}

export { makeValidBrief, makeAvailableAssets, MockVideoProvider, make15sCompileInput, make30sCompileInput };
