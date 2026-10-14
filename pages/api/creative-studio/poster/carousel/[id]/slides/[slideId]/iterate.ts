// pages/api/creative-studio/poster/carousel/[id]/slides/[slideId]/iterate.ts
// Edit one slide via the Phase 8 iteration engine. 1 credit on success.

import { createCarouselIterateHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    bodyParser: { sizeLimit: "16kb" },
  },
  maxDuration: 300,
};

export default createCarouselIterateHandler();
