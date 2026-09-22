/**
 * FFmpeg compositor interface only.
 *
 * Existing ffmpeg binary resolution lives in `lib/creative-studio/ffmpeg-server.ts`
 * and must be reused in Phase 8. This file must not spawn ffmpeg or produce MP4s.
 */

import type { TimelineCompositor } from "./types";

export type { TimelineCompositor };
