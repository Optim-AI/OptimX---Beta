import { defineConfig } from '@trigger.dev/sdk';
import { additionalFiles } from '@trigger.dev/build/extensions/core';
// Same path as FALLBACK_FONT_PATH in lib/creative-studio/poster-templates/fonts.ts (kept literal so the config loads nothing else).
const FALLBACK_FONT_PATH = 'node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf';

/**
 * Trigger.dev (v4) — background jobs for Meta Intelligence.
 * Set TRIGGER_PROJECT_REF (proj_…) locally and in CI; deploy with `npm run trigger:deploy`.
 * Env vars the tasks need must also be set in the Trigger.dev project (see docs in the PR notes).
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_set_TRIGGER_PROJECT_REF',
  dirs: ['./trigger'],
  runtime: 'node',
  logLevel: 'info',
  maxDuration: 3600,
  build: {
    // sharp has native binaries: install it on the worker instead of bundling it.
    external: ['sharp'],
    // Poster rendering falls back to this font (read from disk) when a brand font can't load.
    extensions: [additionalFiles({ files: [FALLBACK_FONT_PATH] })],
  },
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 30_000, maxTimeoutInMs: 300_000, factor: 2, randomize: true },
  },
});
