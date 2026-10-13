/**
 * Legacy Meta Ads campaign-create route — **disabled (PR W1.1)**.
 *
 * Previously created paused campaigns via first-account fallback and fixed
 * ×100 budget conversion. That mutation path is gone: this handler returns
 * HTTP 410 and never calls the Meta Graph API.
 *
 * Do not restore campaign-creation logic here. Future paid Ads writes must use
 * `lib/ads/providers/meta` (`metaGraphPost`, `resolveMetaAdsWriteContext`) with
 * the selected Ads account — never `meta-publish` / `meta-instagram` tokens.
 *
 * Organic Facebook / Instagram publishing is unchanged and uses separate routes.
 *
 * @see docs/PAID_ADS_ARCHITECTURE.md
 */
import type { NextApiRequest, NextApiResponse } from "next";

/** Stable, non-sensitive client/API error code for the disabled legacy write path. */
export const LEGACY_META_ADS_WRITE_DISABLED = "legacy_meta_ads_write_disabled" as const;

export const LEGACY_META_ADS_WRITE_DISABLED_MESSAGE =
  "Legacy Meta Ads campaign creation is disabled. Use the paid Ads connection and future write APIs; this endpoint will not create or mutate campaigns." as const;

type DisabledBody = {
  error: typeof LEGACY_META_ADS_WRITE_DISABLED;
  message: typeof LEGACY_META_ADS_WRITE_DISABLED_MESSAGE;
};

/**
 * Respond with 410 Gone. Exported for unit tests — must not invoke Graph or
 * campaign-creation helpers (none remain in this module).
 */
export function respondLegacyMetaAdsWriteDisabled(
  res: NextApiResponse<DisabledBody>
): void {
  res.status(410).json({
    error: LEGACY_META_ADS_WRITE_DISABLED,
    message: LEGACY_META_ADS_WRITE_DISABLED_MESSAGE,
  });
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<DisabledBody | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  return respondLegacyMetaAdsWriteDisabled(res);
}
