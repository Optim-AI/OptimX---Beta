"use client";

import type { JSX } from "react";
import { MetaAdsDraftWizard } from "@/app/web/src/components/ads/meta/MetaAdsDraftWizard";

/** Create a new local Meta Ads draft — does not create a Meta campaign. */
export default function MetaAdsDraftNewPage(): JSX.Element {
  return <MetaAdsDraftWizard />;
}
