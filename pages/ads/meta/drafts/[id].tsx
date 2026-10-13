"use client";

import type { JSX } from "react";
import { useRouter } from "next/router";
import { MetaAdsDraftWizard } from "@/app/web/src/components/ads/meta/MetaAdsDraftWizard";

/** Open / edit an existing local Meta Ads draft. */
export default function MetaAdsDraftDetailPage(): JSX.Element {
  const router = useRouter();
  const id =
    typeof router.query.id === "string" ? router.query.id : null;

  if (!router.isReady || !id) {
    return (
      <div className="min-h-screen flex app-page items-center justify-center text-sm opacity-70">
        Loading draft…
      </div>
    );
  }

  return <MetaAdsDraftWizard draftId={id} />;
}
