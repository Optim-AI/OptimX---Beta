/**
 * Meta Ads draft lifecycle statuses (PR W2.0).
 *
 * Local draft rows are not Meta campaigns. Only `created_paused` (and
 * transitional `creating` / `partial_failure`) may carry Meta object IDs.
 */

export const META_ADS_DRAFT_STATUSES = [
  "draft",
  "validating",
  "creating",
  "created_paused",
  "partial_failure",
  "failed",
  "archived",
] as const;

export type MetaAdsDraftStatus = (typeof META_ADS_DRAFT_STATUSES)[number];

/** Statuses that may store Meta campaign/adset/creative/ad ids. */
export const META_ADS_DRAFT_STATUSES_ALLOWING_META_IDS: ReadonlySet<MetaAdsDraftStatus> =
  new Set(["creating", "created_paused", "partial_failure"]);

/**
 * Permitted transitions for W2.0 (create-paused flow).
 * Activate/deliver transitions are intentionally omitted until later PRs.
 */
export const META_ADS_DRAFT_TRANSITIONS: Readonly<
  Record<MetaAdsDraftStatus, readonly MetaAdsDraftStatus[]>
> = {
  draft: ["validating", "creating", "archived"],
  validating: ["draft", "creating", "failed", "archived"],
  creating: ["created_paused", "partial_failure", "failed"],
  created_paused: ["archived"],
  partial_failure: ["creating", "failed", "archived"],
  failed: ["draft", "creating", "archived"],
  archived: [],
};

export function isMetaAdsDraftStatus(value: unknown): value is MetaAdsDraftStatus {
  return (
    typeof value === "string" &&
    (META_ADS_DRAFT_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransitionMetaAdsDraftStatus(
  from: MetaAdsDraftStatus,
  to: MetaAdsDraftStatus
): boolean {
  if (from === to) return true;
  return META_ADS_DRAFT_TRANSITIONS[from].includes(to);
}

export function metaAdsDraftStatusAllowsMetaIds(
  status: MetaAdsDraftStatus
): boolean {
  return META_ADS_DRAFT_STATUSES_ALLOWING_META_IDS.has(status);
}
