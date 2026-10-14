// pages/api/creative-studio/poster/carousel/[id]/slides/[slideId]/retry.ts
// Retry a failed slide, settle an unbilled slide, or regenerate a finished slide.

import { createCarouselRetryHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    bodyParser: { sizeLimit: "16kb" },
  },
  maxDuration: 300,
};

export default createCarouselRetryHandler();
