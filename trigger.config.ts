import { defineConfig } from '@trigger.dev/sdk';

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
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 30_000, maxTimeoutInMs: 300_000, factor: 2, randomize: true },
  },
});
