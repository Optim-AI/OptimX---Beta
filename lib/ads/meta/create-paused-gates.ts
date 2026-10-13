/**
 * Fail-closed gates for Meta Ads create-paused Graph writes (PR W2.5).
 *
 * Draft CRUD may be entitled via META_ADS_CREATE_ENABLED alone.
 * Live create-paused mutations require additional explicit approvals because
 * the multipart adimages contract and staging permissions are unverified.
 *
 * Defaults are all denied. There is no production bypass.
 */

import {
  decideMetaAdsCreateAccess,
  type MetaAdsCreateAccess,
} from "@/lib/ads/meta/create-access";

export type MetaAdsCreatePausedGateCode =
  | "not_entitled"
  | "adimages_contract_unapproved"
  | "graph_writes_disabled"
  | "ok";

export type MetaAdsCreatePausedGateResult = {
  allowed: boolean;
  code: MetaAdsCreatePausedGateCode;
  reason: string | null;
  entitled: MetaAdsCreateAccess;
  adimagesContractApproved: boolean;
  graphWritesEnabled: boolean;
};

function envFlagTrue(
  env: Record<string, string | undefined>,
  key: string
): boolean {
  return String(env[key] || "").toLowerCase() === "true";
}

/**
 * Whether the Ad Images multipart contract has been explicitly approved
 * for this environment after staging verification.
 *
 * Default: false. Official Meta docs were inaccessible during W2.4/W2.5;
 * do not enable until live response shape is confirmed.
 */
export function isMetaAdImagesContractApproved(
  env: Record<string, string | undefined> = process.env
): boolean {
  return envFlagTrue(env, "META_ADS_ADIMAGES_CONTRACT_APPROVED");
}

/**
 * Whether create-paused may perform Meta Graph POST/upload mutations.
 * Separate from draft entitlement. Default: false.
 */
export function isMetaAdsCreatePausedGraphWritesEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return envFlagTrue(env, "META_ADS_CREATE_PAUSED_GRAPH_WRITES");
}

/**
 * Combined gate for executing create-paused mutations for a user.
 * Fail closed: entitlement AND adimages contract AND graph-writes flag.
 */
export function decideMetaAdsCreatePausedWriteAccess(
  authenticatedUserId: string,
  env: Record<string, string | undefined> = process.env
): MetaAdsCreatePausedGateResult {
  const entitled = decideMetaAdsCreateAccess(authenticatedUserId, env);
  const adimagesContractApproved = isMetaAdImagesContractApproved(env);
  const graphWritesEnabled = isMetaAdsCreatePausedGraphWritesEnabled(env);

  if (!entitled.entitled) {
    return {
      allowed: false,
      code: "not_entitled",
      reason: entitled.reason,
      entitled,
      adimagesContractApproved,
      graphWritesEnabled,
    };
  }

  if (!adimagesContractApproved) {
    return {
      allowed: false,
      code: "adimages_contract_unapproved",
      reason:
        "Meta Ad Images multipart contract is not approved for this environment (META_ADS_ADIMAGES_CONTRACT_APPROVED). Create-paused Graph writes stay disabled until staging verification.",
      entitled,
      adimagesContractApproved,
      graphWritesEnabled,
    };
  }

  if (!graphWritesEnabled) {
    return {
      allowed: false,
      code: "graph_writes_disabled",
      reason:
        "Create-paused Graph mutations are disabled (META_ADS_CREATE_PAUSED_GRAPH_WRITES). Enable only on reviewed staging after contract verification.",
      entitled,
      adimagesContractApproved,
      graphWritesEnabled,
    };
  }

  return {
    allowed: true,
    code: "ok",
    reason: null,
    entitled,
    adimagesContractApproved,
    graphWritesEnabled,
  };
}
