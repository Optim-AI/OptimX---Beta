// pages/api/creative-studio/poster/carousel/index.ts
// GET ?sessionId= — latest carousel for a poster session (restore after refresh).

import { createCarouselLatestHandler } from "@/lib/creative-studio/poster-generation/carousel/api";

export default createCarouselLatestHandler();
