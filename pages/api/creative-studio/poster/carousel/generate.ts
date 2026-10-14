// pages/api/creative-studio/poster/carousel/generate.ts
// Start or resume carousel generation. 1 image credit per successful slide.

import { createCarouselGenerateHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    bodyParser: { sizeLimit: "64kb" },
  },
  maxDuration: 300,
};

export default createCarouselGenerateHandler();
