/**
 * Update existing keyframe contract: Phase 4 implements generation via reference-engine.
 * These types remain the durable asset shape; generation orchestration lives in
 * commercial-production/reference-engine/.
 */

import type { StoredAssetRef } from "../assets";
import type { QCResult } from "../qc/types";

export type KeyframeStatus = "planned" | "generating" | "ready" | "failed" | "rejected";

/**
 * A keyframe establishes look before video generation:
 * product, composition, environment, lighting, character, wardrobe, camera, treatment.
 * Reusable across multiple shots.
 */
export interface CommercialKeyframe {
  id: string;
  campaignId: string;
  /** Shots that should reuse this keyframe. */
  shotIds: string[];
  purpose: string;
  visualDescription: string;
  establishes: {
    productAppearance?: string;
    composition?: string;
    environment?: string;
    lighting?: string;
    characterAppearance?: string;
    wardrobe?: string;
    cameraPosition?: string;
    visualTreatment?: string;
  };
  productReferences: StoredAssetRef[];
  image?: StoredAssetRef;
  status: KeyframeStatus;
  qc?: QCResult;
}

export interface KeyframeGenerateRequest {
  campaignId: string;
  keyframeId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  productReferences: StoredAssetRef[];
  styleReferences?: StoredAssetRef[];
}

/**
 * Prefer reference-engine generateCommercialKeyframe for Phase 4+.
 * This interface remains for alternate generators.
 */
export interface KeyframeGenerator {
  generateKeyframe(request: KeyframeGenerateRequest): Promise<{ jobId: string }>;
}

export interface KeyframeQCEvaluator {
  evaluate(keyframe: CommercialKeyframe): Promise<QCResult>;
}
