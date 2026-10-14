// pages/api/creative-studio/poster/carousel/[id]/export.ts
// Authenticated ZIP of successful slides (ordered) + manifest.json.

import { createCarouselExportHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export const config = {
  api: {
    responseLimit: "60mb",
  },
  maxDuration: 120,
};

export default createCarouselExportHandler();
