// pages/api/creative-studio/poster/carousel/[id]/slides/[slideId]/image.ts
// Authenticated, ownership-checked PNG for one slide (?download=1 for attachment).

import { createCarouselSlideImageHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    responseLimit: "20mb",
  },
};

export default createCarouselSlideImageHandler();
