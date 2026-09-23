/**
 * Phase 1 smoke checks for poster-generation schemas.
 * Run: node --import tsx lib/creative-studio/poster-generation/guards.test.ts
 */

import {
  assertCreativeBriefShape,
  createEmptyPosterSession,
  isPosterAspectRatio,
  isPosterSessionStatus,
  isPosterVariantCount,
  isPosterVisualDirection,
} from "./guards";
import type { CreativeBrief } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(isPosterAspectRatio("4:5"), "4:5 aspect");
assert(!isPosterAspectRatio("16:9"), "reject 16:9 (UI uses 1.91:1)");
assert(isPosterVisualDirection("premium"), "premium direction");
assert(!isPosterVisualDirection("luxury"), "reject unknown direction");
assert(isPosterVariantCount(3), "3 variants");
assert(!isPosterVariantCount(4), "reject 4 variants");
assert(isPosterSessionStatus("draft"), "draft status");
assert(isPosterSessionStatus("cancelled"), "cancelled status");

const session = createEmptyPosterSession({
  id: "sess_1",
  userId: "user_1",
  studioSessionId: "studio_1",
});
assert(session.status === "draft", "empty session draft");
assert(session.version === 1, "version 1");
assert(session.trace.generationCount === 0, "zero generations");
assert(session.brief === null, "no brief yet");

const brief: CreativeBrief = {
  id: "brief_1",
  createdAt: new Date().toISOString(),
  brand: {
    snapshot: null,
    primaryColors: [],
    aestheticTags: [],
    values: [],
    guidelinesApplied: false,
  },
  product: null,
  userInstruction: "Create a product launch poster",
  visualDirection: "commercial",
  aspectRatio: "4:5",
  variantCount: 3,
  constraints: [],
  productReferences: [],
  designReferences: [],
  supportingReferences: [],
};
assert(assertCreativeBriefShape(brief), "brief shape ok");
assert(!assertCreativeBriefShape({}), "reject empty object");

console.log("poster-generation guards.test.ts: PASS");
