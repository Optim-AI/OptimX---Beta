// pages/api/creative-studio/poster-creative-director.ts
// Poster Engine V1 — plan + compile prompts (no image credits)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  normalizePosterInput,
  planPosterCreative,
} from "@/lib/creative-studio/poster-engine";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const body = req.body || {};
    const input = normalizePosterInput(body);

    console.log("[posterEngine] api.request", {
      userId,
      brand: input.brand?.name || null,
      product: input.product?.name || null,
      variantCount: input.variantCount,
      theme: input.theme || null,
      aspectRatio: input.aspectRatio,
      hasReferencePoster: !!input.referencePoster,
    });

    const plan = await planPosterCreative(input);

    console.log("[posterEngine] api.success", {
      usedFallback: plan.usedFallback,
      selectedConcept: plan.selectedConcept.slice(0, 120),
      variantCount: plan.variants.length,
      mechanisms: plan.variants.map((v) => v.spec.mechanism),
    });

    return res.status(200).json({
      ok: true,
      usedDirector: true,
      usedPlanner: true,
      usedFallback: plan.usedFallback,
      selectedConcept: plan.selectedConcept,
      selectedMechanisms: plan.variants.map((v) => v.spec.mechanism),
      model: plan.model || null,
      variants: plan.variants.map((v, i) => ({
        routeId: `v${i + 1}`,
        routeLabel: v.spec.variantLabel || v.spec.mechanism,
        mechanism: v.spec.mechanism,
        bigIdeaTitle: v.spec.concept.slice(0, 80),
        proposition: v.spec.message,
        spec: v.spec,
        // blueprint kept null — legacy clients may check for it
        blueprint: null,
        prompt: v.prompt,
      })),
      prompts: plan.variants.map((v) => v.prompt),
    });
  } catch (err: any) {
    console.error("[posterEngine] api.error", err?.message || err);
    return res.status(200).json({
      ok: false,
      usedDirector: false,
      usedPlanner: false,
      error: err?.message || "Poster creative planning failed",
      variants: [],
      prompts: [],
    });
  }
}
