// pages/api/creative-studio/poster/carousel/plan.ts
// Plan (or re-plan) a carousel story from the session's strategy. 0 image credits.

import { createCarouselPlanHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    bodyParser: { sizeLimit: "64kb" },
  },
  maxDuration: 300,
};

export default createCarouselPlanHandler();
