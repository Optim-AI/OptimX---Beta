/**
 * Phase 9 — production safety unit checks
 * Run: node --import tsx lib/creative-studio/poster-generation/production-safety.test.ts
 */

import {
  publicErrorMessage,
  sanitizeErrorForClient,
  sanitizeSessionForClient,
} from "./production-safety";
import type { PosterGenerationSession } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const sample = {
  id: "s1",
  userId: "u1",
  status: "ready",
  version: 1,
  createdAt: "",
  updatedAt: "",
  brief: null,
  strategy: null,
  concepts: [],
  selectedConceptIds: [],
  dnaByConceptId: {},
  specifications: [
    {
      id: "spec1",
      sessionId: "s1",
      briefId: "b",
      strategyId: "st",
      conceptId: "c",
      dnaId: "d",
      createdAt: "",
      generationId: "g1",
      variantId: "v1",
      variantIndex: 0,
      aspectRatio: "4:5",
      intendedPlatform: "ig",
      renderCopy: { headline: "H", badges: [] },
      copyHierarchy: [],
      strategyAlignment: {
        objective: "o",
        primaryMessage: "p",
        audience: "a",
        communicationAngle: "c",
        allowedClaims: [],
        forbiddenClaims: [],
        restrictedClaims: [],
      },
      scene: {
        visualTerritory: "",
        visualStory: "",
        composition: "",
        subjectTreatment: "",
        productRole: "",
        productTreatment: "",
        environment: "",
        humanPresence: "",
        lighting: "",
        photographyStyle: "",
        colorStrategy: "",
        typography: "",
        graphicLanguage: "",
        visualRhythm: "",
        mood: "",
        hierarchy: "",
        productFidelityRules: "",
        brandIntegration: "",
        designReferenceInfluence: "",
        visualDirectionExpression: "",
        outputRequirements: [],
      },
      references: [],
      attachedAssetIds: [],
      constraints: {
        productFidelity: "",
        logoFidelity: "",
        copyFidelity: "",
        unsupportedClaims: [],
        referenceHandling: "",
        brandRequirements: [],
      },
      userOverrides: {},
      compiledPrompt: "SECRET PROMPT DO NOT LEAK",
    },
  ],
  assets: [
    {
      id: "g1",
      sessionId: "s1",
      generationId: "g1",
      variantId: "v1",
      variantIndex: 0,
      conceptId: "c",
      dnaId: "d",
      specificationId: "spec1",
      imageUrl: "https://x",
      provider: "nano",
      model: "m",
      creditsConsumed: 1,
      status: "failed",
      errorCode: "PROVIDER_FAILED",
      errorMessage: "Gemini 429 RESOURCE_EXHAUSTED rate limit",
      createdAt: "",
    },
  ],
  iterations: [],
  trace: {
    totalCreditsConsumed: 1,
    generationCount: 1,
    retryCount: 0,
    lastError: "Gemini 429 RESOURCE_EXHAUSTED",
  },
} as unknown as PosterGenerationSession;

assert(
  publicErrorMessage("PROVIDER_FAILED").includes("credit wasn't charged") ||
    publicErrorMessage("PROVIDER_FAILED").toLowerCase().includes("couldn't"),
  "friendly provider failed"
);

const prev = (process.env as { NODE_ENV?: string }).NODE_ENV;
(process.env as { NODE_ENV?: string }).NODE_ENV = "production";

const sanitizedErr = sanitizeErrorForClient({
  code: "PROVIDER_FAILED",
  message: "Gemini 429 RESOURCE_EXHAUSTED",
  retryable: true,
});
assert(sanitizedErr.code === "PROVIDER_FAILED", "code kept");
assert(
  !sanitizedErr.message.includes("RESOURCE_EXHAUSTED"),
  "no gemini leak in prod"
);

const sessionOut = sanitizeSessionForClient(sample);
assert(
  sessionOut.specifications[0].compiledPrompt == null,
  "compiledPrompt stripped"
);
assert(
  !String(sessionOut.assets[0].errorMessage).includes("RESOURCE_EXHAUSTED"),
  "asset error sanitized"
);

(process.env as { NODE_ENV?: string }).NODE_ENV = prev;
console.log("poster-generation production-safety.test.ts: PASS");
