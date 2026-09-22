/**
 * Asset references for the commercial pipeline.
 *
 * Store URLs / Supabase storage paths — never persist large base64 payloads.
 * Reuse `lib/storage/client.ts` (`campaign-assets`, `user-uploads`) and
 * `lib/creative-studio/video-delivery.ts` for uploads.
 */

export const COMMERCIAL_STORAGE_BUCKETS = {
  CAMPAIGN_ASSETS: "campaign-assets",
  USER_UPLOADS: "user-uploads",
} as const;

export type CommercialStorageBucket =
  (typeof COMMERCIAL_STORAGE_BUCKETS)[keyof typeof COMMERCIAL_STORAGE_BUCKETS];

export type CommercialAssetKind =
  | "product_image"
  | "brand_logo"
  | "creative_reference"
  | "user_concept_image"
  | "keyframe"
  | "shot_video"
  | "final_video"
  | "audio_music"
  | "audio_sfx"
  | "overlay";

export interface StoredAssetRef {
  id: string;
  kind: CommercialAssetKind;
  /** Supabase bucket. Omit for remote http(s) assets not yet ingested. */
  bucket?: CommercialStorageBucket;
  /** Path within the bucket. Prefer this over embedding bytes. */
  path?: string;
  /** Public or signed URL. */
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  /** Optional relationship: which product / shot / keyframe this belongs to. */
  productId?: string;
  shotId?: string;
  keyframeId?: string;
  campaignId?: string;
}

export type GeneratedAssetStatus = "pending" | "ready" | "failed" | "replaced";

export interface GeneratedAsset {
  id: string;
  campaignId: string;
  shotId?: string;
  keyframeId?: string;
  jobId?: string;
  kind: Extract<CommercialAssetKind, "keyframe" | "shot_video" | "final_video" | "overlay">;
  asset: StoredAssetRef;
  provider?: string;
  model?: string;
  status: GeneratedAssetStatus;
  createdAt: string;
}
