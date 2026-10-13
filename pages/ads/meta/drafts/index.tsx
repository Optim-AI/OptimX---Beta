"use client";

import type { JSX } from "react";
import { MetaAdsDraftsList } from "@/app/web/src/components/ads/meta/MetaAdsDraftsList";

/**
 * Meta Ads local draft list (PR W2.2).
 * Separate from Campaign Library and organic publishing.
 */
export default function MetaAdsDraftsPage(): JSX.Element {
  return <MetaAdsDraftsList />;
}
