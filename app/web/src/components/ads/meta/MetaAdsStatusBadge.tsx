"use client";

import colors from "@/lib/ui/colors";
import { metaAdsDraftStatusLabel } from "@/lib/ads/meta/draft-contract";

export function MetaAdsStatusBadge(props: {
  status: string;
  onMeta?: boolean;
  metaCampaignId?: string | null;
}) {
  const label = metaAdsDraftStatusLabel(props.status, {
    onMeta: props.onMeta,
    metaCampaignId: props.metaCampaignId,
  });
  const tone =
    props.status === "failed" || props.status === "partial_failure"
      ? { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" }
      : props.status === "archived"
        ? { bg: colors.muted, fg: colors.mutedForeground }
        : props.status === "created_paused" && props.onMeta
          ? { bg: colors.green100, fg: colors.green600 }
          : { bg: "rgba(148,163,184,0.2)", fg: "#94a3b8" };

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ background: tone.bg, color: tone.fg }}
      data-testid="meta-ads-status-badge"
      data-status={props.status}
    >
      {label}
    </span>
  );
}
