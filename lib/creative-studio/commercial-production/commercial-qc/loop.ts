/**
 * Controlled regeneration loop helper.
 * Calls a provided regenerate callback — never invokes Runway directly.
 */

import { runCommercialQC } from "./evaluate";
import {
  appendRegenerationHistory,
  formatRegenerationInstruction,
  regenerationLimitReached,
} from "./regeneration";
import {
  DEFAULT_MAX_AUTO_REGENERATIONS,
  type CommercialQCInput,
  type CommercialQCOptions,
  type CommercialQCReport,
  type RegenerationHistoryEntry,
} from "./types";
import type { FinalCommercial } from "../campaign-executor/types";

export interface RegenerationLoopResult {
  finalCommercial: FinalCommercial;
  report: CommercialQCReport;
  history: RegenerationHistoryEntry[];
  generationsProduced: number;
}

export interface RunQCWithRegenerationInput extends Omit<
  CommercialQCInput,
  "finalCommercial"
> {
  finalCommercial: FinalCommercial;
  /**
   * Produce the next commercial version. Must use mocked providers in tests.
   * Receives regeneration instruction text + next version id.
   */
  regenerate: (args: {
    nextVersion: string;
    instruction: string;
    previous: FinalCommercial;
    report: CommercialQCReport;
  }) => Promise<FinalCommercial>;
}

/**
 * Evaluate QC; if regenerate, call regenerate() up to maxAutoRegenerations.
 * Stops on accept, manual_review, or limit.
 */
export async function runQCWithRegenerationLoop(
  input: RunQCWithRegenerationInput,
  options: CommercialQCOptions = {}
): Promise<RegenerationLoopResult> {
  const maxAuto =
    input.maxAutoRegenerations ??
    options.maxAutoRegenerations ??
    DEFAULT_MAX_AUTO_REGENERATIONS;

  let current = input.finalCommercial;
  let history: RegenerationHistoryEntry[] = [...(input.regenerationHistory || [])];
  let generationsProduced = 0;
  let report: CommercialQCReport;

  // Prevent infinite loops even if decision logic regresses
  const hardCap = maxAuto + 2;

  for (let i = 0; i < hardCap; i++) {
    report = await runCommercialQC(
      {
        ...input,
        finalCommercial: current,
        regenerationHistory: history,
        regenerationCount: history.length,
        maxAutoRegenerations: maxAuto,
      },
      options
    );

    if (report.decision === "accept" || report.decision === "manual_review") {
      return {
        finalCommercial: current,
        report,
        history,
        generationsProduced,
      };
    }

    // regenerate
    if (!report.regeneration || regenerationLimitReached(history.length, maxAuto)) {
      const forced: CommercialQCReport = {
        ...report,
        decision: "manual_review",
        regeneration: undefined,
      };
      return {
        finalCommercial: current,
        report: forced,
        history,
        generationsProduced,
      };
    }

    const plan = report.regeneration;
    const instruction = formatRegenerationInstruction(plan);
    const next = await input.regenerate({
      nextVersion: plan.generationVersion,
      instruction,
      previous: current,
      report,
    });
    generationsProduced += 1;

    const entry: RegenerationHistoryEntry = {
      fromVersion: plan.sourceGenerationVersion,
      toVersion: plan.generationVersion,
      decidedAt: new Date().toISOString(),
      decision: "regenerate",
      reason: plan.reason,
      plan,
    };
    history = appendRegenerationHistory(history, entry);
    current = next;
  }

  // Exhausted hard cap
  report = await runCommercialQC(
    {
      ...input,
      finalCommercial: current,
      regenerationHistory: history,
      regenerationCount: history.length,
      maxAutoRegenerations: maxAuto,
    },
    options
  );

  return {
    finalCommercial: current,
    report: {
      ...report,
      decision: "manual_review",
      regeneration: undefined,
    },
    history,
    generationsProduced,
  };
}
