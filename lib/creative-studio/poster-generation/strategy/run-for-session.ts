/**
 * Session-aware Marketing Strategy service — Phase 4.
 * Persists via PosterGenerationSessionService. Zero image credits.
 */

import type { StructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { MarketingStrategy, PosterGenerationSession } from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { strategistInputFromBrief } from "./from-brief";
import { generateMarketingStrategy } from "./strategist";
import type { MarketingStrategistInput } from "./strategy-input";
import { PosterStrategyError } from "./strategy-errors";
import { researchDigest } from "@/lib/research/brand-research";
import { getBrandResearch, researchMatchesBrandName } from "@/lib/research/store";

export type RunMarketingStrategyOptions = {
  sessionId: string;
  userId: string;
  /** Force a new strategy even if one exists for this brief */
  forceRegenerate?: boolean;
  generator?: StructuredGenerator;
  sessionService?: PosterGenerationSessionService;
};

export type RunMarketingStrategyResult = {
  session: PosterGenerationSession;
  strategy: MarketingStrategy;
  reused: boolean;
};

export async function runMarketingStrategyForSession(
  options: RunMarketingStrategyOptions
): Promise<RunMarketingStrategyResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  const session = await sessions.getSession(options.sessionId, options.userId);

  if (!session.brief) {
    throw new PosterStrategyError({
      code: "MISSING_BRIEF",
      message:
        "Poster session has no CreativeBrief. Create/update the brief before generating strategy.",
      stage: "runMarketingStrategyForSession",
    });
  }

  // Idempotency: reuse existing strategy for the same brief unless forced
  if (
    !options.forceRegenerate &&
    session.strategy &&
    session.strategy.briefId === session.brief.id
  ) {
    return { session, strategy: session.strategy, reused: true };
  }

  const input: MarketingStrategistInput = strategistInputFromBrief(session.brief);
  // Saved brand research sharpens the framing; best effort, never blocks the strategy.
  const research = await getBrandResearch(options.userId).catch(() => null);
  if (research && researchMatchesBrandName(research, input.brand.identity.name?.value)) {
    input.marketResearch = researchDigest(research, 1800);
  }
  const strategy = await generateMarketingStrategy(input, {
    generator: options.generator,
  });

  const updated = await sessions.updateStrategy(
    options.sessionId,
    options.userId,
    strategy
  );

  return { session: updated, strategy, reused: false };
}
