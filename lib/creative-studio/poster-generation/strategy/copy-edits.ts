/**
 * User edits to the poster copy (headline, supporting line, CTA) before any
 * image is generated. Saved on the same strategy, so concepts stay valid, and
 * recorded as user overrides so generation renders them exactly.
 */

import type { MarketingStrategy } from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { PosterStrategyError } from "./strategy-errors";

export type StrategyCopyEdits = {
  headline?: string | null;
  supporting?: string | null;
  cta?: string | null;
};

const LIMITS = { headline: 120, supporting: 160, cta: 40 } as const;

function clean(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Apply copy edits to a strategy (pure). Untouched fields keep their current values. */
export function applyCopyEdits(strategy: MarketingStrategy, edits: StrategyCopyEdits): MarketingStrategy {
  const copy = { ...strategy.copy };
  const overrides = { ...strategy.userOverrides };

  if ("headline" in edits) {
    const headline = clean(edits.headline, LIMITS.headline);
    if (!headline) {
      throw new PosterStrategyError({
        code: "VALIDATION",
        message: "The headline can't be empty.",
        stage: "applyCopyEdits",
      });
    }
    copy.headline = headline;
    overrides.headline = headline;
  }
  if ("supporting" in edits) {
    const supporting = clean(edits.supporting, LIMITS.supporting);
    copy.supporting = supporting;
    overrides.message = supporting;
  }
  if ("cta" in edits) {
    const cta = clean(edits.cta, LIMITS.cta);
    copy.cta = cta;
    overrides.cta = cta;
  }
  return { ...strategy, copy, userOverrides: overrides };
}

export async function updateStrategyCopyForSession(options: {
  sessionId: string;
  userId: string;
  edits: StrategyCopyEdits;
  sessionService?: PosterGenerationSessionService;
}): Promise<MarketingStrategy> {
  const sessions = options.sessionService ?? createPosterGenerationSessionService();
  const session = await sessions.getSession(options.sessionId, options.userId);
  if (!session.strategy) {
    throw new PosterStrategyError({
      code: "MISSING_BRIEF",
      message: "Develop the creative first — there is no message to edit yet.",
      stage: "updateStrategyCopyForSession",
    });
  }
  const updated = applyCopyEdits(session.strategy, options.edits);
  // Same strategy id → the session keeps its concepts.
  const saved = await sessions.updateStrategy(options.sessionId, options.userId, updated);
  return saved.strategy ?? updated;
}
