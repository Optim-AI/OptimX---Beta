/**
 * Draw the ready-made UGC creator faces into public/images/ugc-creators/<id>.jpg.
 * Skips pictures that already exist unless --force. One image call per creator.
 *
 * Run: npx tsx --env-file=.env.local scripts/generate-ugc-creators.ts [--force] [id ...]
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UGC_CREATOR_PRESETS } from "@/lib/creative-studio/commercial-production/campaign/ugc-presets";
import { generateCreatorPortrait } from "@/lib/creative-studio/commercial-production/ugc/creator";

const OUT_DIR = join(process.cwd(), "public/images/ugc-creators");
const CONCURRENCY = 4;

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  mkdirSync(OUT_DIR, { recursive: true });

  const todo = UGC_CREATOR_PRESETS.filter(
    (p) => (!only.length || only.includes(p.id)) && (force || !existsSync(join(OUT_DIR, `${p.id}.jpg`)))
  );
  console.log(`Drawing ${todo.length} creator(s)…`);

  let next = 0;
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const preset = todo[next++];
        try {
          const jpeg = await generateCreatorPortrait({ kind: preset.kind, description: preset.description });
          writeFileSync(join(OUT_DIR, `${preset.id}.jpg`), jpeg);
          console.log(`  ✓ ${preset.id}`);
        } catch (err) {
          failed.push(preset.id);
          console.error(`  ✗ ${preset.id}: ${err instanceof Error ? err.message : err}`);
        }
      }
    })
  );
  if (failed.length) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
