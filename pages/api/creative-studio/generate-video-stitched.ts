// pages/api/creative-studio/generate-video-stitched.ts
// Legacy route: 15s/30s Seedance commercials are generated in one request.
// Kept so older clients still work; no Veo stitching.
export { config, default } from "./generate-video";
