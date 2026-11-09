/**
 * Generate the website showcase with SkalX's own models (Nano Banana for images, Gemini Omni
 * for video via the Interactions API), for the FICTIONAL brands in content/showcase-inputs.ts.
 * Video limits on this account: one reference image, 8 seconds, ~10 videos per day.
 *
 *   npx tsx scripts/generate-showcase.ts                 # dry run: plan + cost estimate, no spend
 *   npx tsx scripts/generate-showcase.ts --run --max-usd=20
 *   npx tsx scripts/generate-showcase.ts --run --brand=saffra-skin --only=posters,photo
 *
 * Flags
 *   --run              actually call the models (default is a dry run)
 *   --max-usd=N        hard budget cap on ESTIMATED spend (default 15); stops before exceeding it
 *   --brand=id         one brand only
 *   --only=a,b         subset of: packshot,posters,carousel,photo,video,ugc
 *   --force            regenerate assets that already exist
 *   --max-videos=N     stop after N videos this run (default 9; the account allows ~10/day)
 *   --ids=a/b,c/d      only these assets (e.g. crunchwell/poster-1); the cached packshot is reused
 *   --allow-unapproved generate brands whose `approved` flag is false (never for real brands)
 *
 * Output
 *   .showcase-cache/{brand}/...        raw model output (not served, safe to delete)
 *   public/showcase/{brand}/...        compressed site assets (WebP; MP4 H.264 + WebM; poster < 150 KB)
 *   content/showcase.generated.ts      metadata for every asset (brand, input link, finding, angle, format)
 *   showcase-review/contact-sheet.html open locally to review everything before it goes on the site
 *
 * Costs are estimates (override with SHOWCASE_IMAGE_USD and SHOWCASE_VIDEO_USD).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { SHOWCASE_BRANDS, type ShowcaseAngle, type ShowcaseBrandInput } from '../content/showcase-inputs';

loadEnv({ path: '.env.local' });
loadEnv();

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = new Map<string, string | true>();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  args.set(k, v ?? true);
}
const RUN = args.has('run');
const MAX_USD = Number(args.get('max-usd') ?? 15);
const ONLY = new Set(String(args.get('only') ?? 'packshot,posters,carousel,photo,video,ugc').split(','));
const FORCE = args.has('force');
const ALLOW_UNAPPROVED = args.has('allow-unapproved');
const BRAND_FILTER = typeof args.get('brand') === 'string' ? String(args.get('brand')) : null;
const IDS = typeof args.get('ids') === 'string' ? new Set(String(args.get('ids')).split(',')) : null;

const IMAGE_USD = Number(process.env.SHOWCASE_IMAGE_USD ?? 0.07);
const VIDEO_USD = Number(process.env.SHOWCASE_VIDEO_USD ?? 1.2);
const VIDEO_MODEL = process.env.SHOWCASE_VIDEO_MODEL || 'gemini-omni-1.1-flash';
const VIDEO_SECONDS = 8;
const MAX_VIDEOS = Number(args.get('max-videos') ?? 9);
let videosThisRun = 0;

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.showcase-cache');
const PUBLIC = path.join(ROOT, 'public', 'showcase');
const REVIEW = path.join(ROOT, 'showcase-review');

let spentUsd = 0;
const log = (...m: unknown[]) => console.log('[showcase]', ...m);

class BudgetExceeded extends Error {}

/** Reserve estimated spend before a paid call; throws when the cap would be exceeded. */
function reserve(usd: number, what: string) {
  if (spentUsd + usd > MAX_USD) throw new BudgetExceeded(`Budget cap $${MAX_USD} reached before: ${what} (est. spent $${spentUsd.toFixed(2)})`);
  spentUsd += usd;
}

// ── Plan ─────────────────────────────────────────────────────────────────────
type Job =
  | { kind: 'image'; id: string; brand: ShowcaseBrandInput; aspect: '4:5' | '1:1' | '9:16'; prompt: string; usePackshot: boolean; meta?: AssetMeta }
  | { kind: 'video'; id: string; brand: ShowcaseBrandInput; prompts: string[]; withAudio: boolean; usePackshot: boolean; meta: AssetMeta };

type AssetMeta = { format: string; angle: ShowcaseAngle; aspect: '4:5' | '1:1' | '9:16' };

const STYLE = 'Premium Indian D2C advertising. Clean composition, legible typography. Keep all text fully visible and clear of the product. Do not add any text that is not quoted above (no ingredient lists, slide numbers, page dots or taglines). No watermarks, no third-party logos or brands.';

function adPrompt(b: ShowcaseBrandInput, a: ShowcaseAngle, format: string) {
  return [
    `Design a finished ${format} social ad for the fictional brand "${b.name}" (${b.category}).`,
    `Product: ${b.product}, which looks like ${b.productLook}. Keep the product exactly as in the reference image.`,
    `Brand palette: ${b.palette}.`,
    `Angle: ${a.angle}`,
    `Headline text, exactly: "${a.headline}". Call-to-action button text, exactly: "${a.cta}". Small brand name "${b.name}". No other text.`,
    STYLE,
  ].join(' ');
}

function plan(): Job[] {
  const jobs: Job[] = [];
  for (const b of SHOWCASE_BRANDS) {
    if (BRAND_FILTER && b.id !== BRAND_FILTER) continue;
    if (!b.approved && !ALLOW_UNAPPROVED) {
      log(`skip ${b.id}: not approved (set approved: true in content/showcase-inputs.ts)`);
      continue;
    }
    // The packshot is the product reference for every other asset (cached after the first run).
    {
      jobs.push({
        kind: 'image',
        id: `${b.id}/packshot`,
        brand: b,
        aspect: '1:1',
        usePackshot: false,
        prompt: `Studio product photograph of ${b.productLook}, for the fictional brand "${b.name}". Centered, soft shadow, plain light background, photorealistic, no other text than the label.`,
      });
    }
    if (ONLY.has('posters')) {
      b.posters.forEach((p, i) =>
        jobs.push({ kind: 'image', id: `${b.id}/poster-${i + 1}`, brand: b, aspect: '4:5', usePackshot: true, prompt: adPrompt(b, p, '4:5 feed poster'), meta: { format: 'Feed poster', angle: p, aspect: '4:5' } })
      );
    }
    if (ONLY.has('carousel')) {
      b.carousel.slides.forEach((slide, i) =>
        jobs.push({
          kind: 'image',
          id: `${b.id}/carousel-${i + 1}`,
          brand: b,
          aspect: '1:1',
          usePackshot: true,
          prompt: [
            `Slide ${i + 1} of 3 of a square Instagram carousel for the fictional brand "${b.name}".`,
            `Carousel headline (slide 1 only): "${b.carousel.headline}". This slide's text, exactly: "${slide}".`,
            `Product: ${b.productLook}. Palette: ${b.palette}. Consistent layout across slides.`,
            STYLE,
          ].join(' '),
          meta: i === 0 ? { format: 'Carousel', angle: b.carousel, aspect: '1:1' } : undefined,
        })
      );
    }
    if (ONLY.has('photo')) {
      jobs.push({
        kind: 'image',
        id: `${b.id}/photoshoot`,
        brand: b,
        aspect: '4:5',
        usePackshot: true,
        prompt: `Lifestyle product photograph of ${b.productLook} ${b.photoshoot.scene}. Photorealistic, editorial, no text, no watermark. Keep the product identical to the reference.`,
        meta: { format: 'Product photoshoot', angle: b.photoshoot.angle, aspect: '4:5' },
      });
    }
    if (ONLY.has('video')) {
      jobs.push({
        kind: 'video',
        id: `${b.id}/product-video`,
        brand: b,
        withAudio: false,
        usePackshot: true,
        // One 8-second Veo clip (Veo's maximum): both scenes in a single shot, no joins.
        prompts: [
          `An 8-second cinematic product commercial for the fictional brand "${b.name}". Opens on: ${b.productVideo.scenes[0]}. Ends on: ${b.productVideo.scenes[1]}. The product is ${b.productLook}. Vertical 9:16, no on-screen text, no logos other than the product label.`,
        ],
        meta: { format: 'Product video, 8s', angle: b.productVideo, aspect: '9:16' },
      });
    }
    if (ONLY.has('ugc')) {
      jobs.push({
        kind: 'video',
        id: `${b.id}/ugc`,
        brand: b,
        withAudio: true,
        usePackshot: true,
        prompts: [
          `UGC-style vertical selfie video: ${b.ugc.creator}, holding this exact product (from the reference image: ${b.productLook}) and talking naturally to the camera in English with an Indian accent. She or he says: "${b.ugc.script}". Handheld phone footage, natural light, authentic. The person wears plain, unbranded clothing with no logos, prints or brand marks of any kind. No on-screen text, no subtitles.`,
        ],
        meta: { format: 'UGC video', angle: b.ugc, aspect: '9:16' },
      });
    }
  }
  return IDS ? jobs.filter((j) => IDS.has(j.id)) : jobs;
}

function estimate(jobs: Job[]) {
  return jobs.reduce((usd, j) => usd + (j.kind === 'image' ? IMAGE_USD : j.prompts.length * VIDEO_USD), 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

async function ffmpeg(argsList: string[]) {
  const bin = (await import('ffmpeg-static')).default as unknown as string;
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, ['-y', '-loglevel', 'error', ...argsList], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

async function toWebp(src: string, dest: string, width: number, maxBytes?: number) {
  const sharp = (await import('sharp')).default;
  let quality = 82;
  for (;;) {
    await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(dest);
    if (!maxBytes || statSync(dest).size <= maxBytes || quality <= 40) return;
    quality -= 8;
  }
}

// ── Model calls ──────────────────────────────────────────────────────────────
async function generateImage(job: Extract<Job, { kind: 'image' }>, out: string) {
  const { generateGeminiImage, getPosterImageModel } = await import('../lib/creative-studio/nano-banana');
  const packshot = path.join(CACHE, job.brand.id, 'packshot.png');
  const references =
    job.usePackshot && existsSync(packshot)
      ? [{ dataUrlOrHttp: `data:image/png;base64,${readFileSync(packshot).toString('base64')}`, instruction: 'This is the exact product. Keep its shape, colour and label.' }]
      : [];
  reserve(IMAGE_USD, job.id);
  const result = await generateGeminiImage({ prompt: job.prompt, aspectRatio: job.aspect, references, model: getPosterImageModel(), operationLabel: `showcase:${job.id}` });
  writeFileSync(out, result.buffer);
}

/**
 * One 8-second video from Gemini Omni (Interactions API, background job), with at most one
 * reference image. The finished video comes back inline in the model_output step.
 */
async function generateVideoClip(prompt: string, out: string, imagePath: string | null, withAudio: boolean) {
  const apiKey = process.env.GEMINI_VEO_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Set GEMINI_VEO_API_KEY (Gemini key with video access).');
  if (videosThisRun >= MAX_VIDEOS) throw new BudgetExceeded(`Video limit for this run reached (${MAX_VIDEOS}); the account allows ~10 videos per day.`);
  reserve(VIDEO_USD, `video → ${path.basename(out)}`);
  videosThisRun += 1;
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
  const input: unknown[] = [];
  if (imagePath) input.push({ type: 'image', data: readFileSync(imagePath).toString('base64'), mime_type: 'image/png' });
  input.push({
    type: 'text',
    text: `Generate an ${VIDEO_SECONDS}-second vertical 9:16 video. ${prompt}${withAudio ? '' : ' Ambient sound only, no speech, no music with lyrics.'}`,
  });
  let res = await fetch(`${BASE}/interactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: VIDEO_MODEL, input, response_modalities: ['video'], background: true }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let job: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Video request failed (${res.status}): ${JSON.stringify(job.error ?? job).slice(0, 300)}`);
  const started = Date.now();
  while (!['completed', 'failed', 'cancelled'].includes(job.status)) {
    if (Date.now() - started > 10 * 60_000) throw new Error('Video timed out after 10 minutes');
    await new Promise((r) => setTimeout(r, 10_000));
    res = await fetch(`${BASE}/interactions/${job.id}`, { headers });
    job = await res.json().catch(() => ({}));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = (job.steps ?? []).filter((s: any) => s.type === 'model_output').flatMap((s: any) => s.content ?? []).find((c: any) => c.type === 'video');
  if (job.status !== 'completed' || !video) throw new Error(`Video ${job.status}: ${JSON.stringify(job.error ?? {}).slice(0, 300)}`);
  if (video.data) {
    writeFileSync(out, Buffer.from(video.data, 'base64'));
  } else if (video.uri) {
    const dl = await fetch(video.uri, { headers: { 'x-goog-api-key': apiKey } });
    if (!dl.ok) throw new Error(`Video download failed (${dl.status})`);
    writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
  } else {
    throw new Error('Video response had no data');
  }
}

async function generateVideo(job: Extract<Job, { kind: 'video' }>, outMp4: string) {
  const dir = path.dirname(outMp4);
  const packshot = path.join(CACHE, job.brand.id, 'packshot.png');
  const clips: string[] = [];
  for (const [i, prompt] of job.prompts.entries()) {
    const clip = path.join(dir, `${path.basename(outMp4, '.mp4')}-clip${i + 1}.mp4`);
    if (FORCE || !existsSync(clip)) await generateVideoClip(prompt, clip, job.usePackshot && i === 0 && existsSync(packshot) ? packshot : null, job.withAudio);
    clips.push(clip);
  }
  if (clips.length === 1) {
    writeFileSync(outMp4, readFileSync(clips[0]));
    return;
  }
  // Join the clips and trim to 15s.
  const list = path.join(dir, `${path.basename(outMp4, '.mp4')}-list.txt`);
  writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n'));
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-t', '15', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', outMp4]);
}

// ── Compress + metadata ──────────────────────────────────────────────────────
type GeneratedItem = {
  id: string;
  brand: string;
  inputLink: string;
  format: string;
  aspect: '4:5' | '1:1' | '9:16';
  finding: string;
  angle: string;
  headline: string;
  image: string;
  video?: { mp4: string; webm: string };
  extraImages?: string[];
};

async function compressImage(raw: string, publicPath: string, width: number) {
  ensureDir(path.dirname(publicPath));
  await toWebp(raw, publicPath, width);
}

async function compressVideo(rawMp4: string, publicBase: string) {
  ensureDir(path.dirname(publicBase));
  await ffmpeg(['-i', rawMp4, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', `${publicBase}.mp4`]);
  await ffmpeg(['-i', rawMp4, '-vf', 'scale=720:-2', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-c:a', 'libopus', '-b:a', '64k', `${publicBase}.webm`]);
  const frame = `${publicBase}-poster.png`;
  await ffmpeg(['-ss', '0.5', '-i', rawMp4, '-frames:v', '1', frame]);
  await toWebp(frame, `${publicBase}-poster.webp`, 540, 150_000);
  unlinkSync(frame); // keep only the WebP poster in /public
}

/** Merge this run's items into the manifest so partial runs (e.g. --only=video) never drop earlier assets. */
function mergeManifest(items: GeneratedItem[]): GeneratedItem[] {
  const manifest = path.join(CACHE, 'manifest.json');
  const prior: GeneratedItem[] = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : [];
  const byId = new Map(prior.map((it) => [it.id, it]));
  for (const it of items) byId.set(it.id, it);
  const order = SHOWCASE_BRANDS.map((b) => b.id);
  const merged = [...byId.values()].sort((x, y) => order.indexOf(x.id.split('/')[0]) - order.indexOf(y.id.split('/')[0]) || x.id.localeCompare(y.id));
  ensureDir(CACHE);
  writeFileSync(manifest, JSON.stringify(merged, null, 2));
  return merged;
}

function writeGenerated(items: GeneratedItem[]) {
  const file = path.join(ROOT, 'content', 'showcase.generated.ts');
  // Keep the approval decision across re-runs.
  const approved = existsSync(file) && /SHOWCASE_GENERATED_APPROVED = true/.test(readFileSync(file, 'utf8'));
  writeFileSync(
    file,
    `/**\n * Written by scripts/generate-showcase.ts. Do not edit by hand; edit content/showcase-inputs.ts and re-run.\n * Not shown on the site until SHOWCASE_GENERATED_APPROVED is true (after reviewing the contact sheet).\n */\nimport type { GeneratedShowcaseItem } from './showcase';\n\nexport const SHOWCASE_GENERATED_APPROVED = ${approved};\n\nexport const GENERATED_SHOWCASE: GeneratedShowcaseItem[] = ${JSON.stringify(items, null, 2)};\n`
  );
  log(`wrote ${path.relative(ROOT, file)} (${items.length} items)`);
}

function writeContactSheet(items: GeneratedItem[]) {
  ensureDir(REVIEW);
  const rel = (p: string) => `../public${p}`;
  const cards = items
    .map(
      (it) => `<figure>
  ${it.video ? `<video controls muted playsinline poster="${rel(it.image)}" src="${rel(it.video.mp4)}"></video>` : `<img src="${rel(it.image)}" alt="">`}
  ${(it.extraImages ?? []).map((x) => `<img class="extra" src="${rel(x)}" alt="">`).join('')}
  <figcaption><b>${it.brand}</b> · ${it.format}<br><i>Finding:</i> ${it.finding}<br><i>Angle:</i> ${it.angle}<br><i>Headline:</i> “${it.headline}”</figcaption>
</figure>`
    )
    .join('\n');
  writeFileSync(
    path.join(REVIEW, 'contact-sheet.html'),
    `<!doctype html><meta charset="utf-8"><title>SkalX showcase contact sheet</title>
<style>body{font:14px system-ui;background:#f6f1e8;color:#17140f;margin:24px}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}figure{margin:0;background:#fffcf6;border:1px solid #e0d6c5;border-radius:14px;padding:10px}img,video{width:100%;border-radius:8px;display:block}.extra{margin-top:6px}figcaption{margin-top:8px;line-height:1.4}</style>
<h1>SkalX showcase — review before publishing (${items.length} items, est. spend $${spentUsd.toFixed(2)})</h1>
<main>${cards}</main>`
  );
  log(`contact sheet: ${path.relative(ROOT, path.join(REVIEW, 'contact-sheet.html'))}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const jobs = plan();
  const est = estimate(jobs);
  log(`${jobs.length} jobs · est. cost $${est.toFixed(2)} (images $${IMAGE_USD}/each, videos $${VIDEO_USD}/each via ${VIDEO_MODEL}) · cap $${MAX_USD} · max ${MAX_VIDEOS} videos`);
  if (!RUN) {
    for (const j of jobs) log(`  [dry] ${j.id} ${j.kind === 'image' ? `image ${j.aspect}` : `video ${j.prompts.length}×${VIDEO_SECONDS}s${j.withAudio ? ' +voice' : ''}`}`);
    log('Dry run only. Re-run with --run to generate.');
    return;
  }

  const items: GeneratedItem[] = [];
  try {
    for (const job of jobs) {
      const brandDir = path.join(CACHE, job.brand.id);
      ensureDir(brandDir);
      const name = job.id.split('/')[1];
      if (job.kind === 'image') {
        const raw = path.join(brandDir, `${name}.png`);
        if (FORCE || !existsSync(raw)) {
          log(`image ${job.id}…`);
          await generateImage(job, raw);
        }
        if (name === 'packshot') continue;
        const pub = `/showcase/${job.brand.id}/${name}.webp`;
        await compressImage(raw, path.join(ROOT, 'public', pub), job.aspect === '1:1' ? 1080 : 1080);
        if (job.meta) {
          items.push({
            id: job.id,
            brand: `${job.brand.name} (fictional)`,
            inputLink: job.brand.inputLink,
            format: job.meta.format,
            aspect: job.meta.aspect,
            finding: job.meta.angle.finding,
            angle: job.meta.angle.angle,
            headline: job.meta.angle.headline,
            image: pub,
          });
        } else {
          // Carousel slides 2–3 attach to slide 1.
          const first = items.find((it) => it.id === `${job.brand.id}/carousel-1`);
          if (first) first.extraImages = [...(first.extraImages ?? []), pub];
        }
      } else {
        const raw = path.join(brandDir, `${name}.mp4`);
        if (FORCE || !existsSync(raw)) {
          log(`video ${job.id}… (Gemini Omni, ~1 minute)`);
          await generateVideo(job, raw);
        }
        const base = `/showcase/${job.brand.id}/${name}`;
        await compressVideo(raw, path.join(ROOT, 'public', base));
        items.push({
          id: job.id,
          brand: `${job.brand.name} (fictional)`,
          inputLink: job.brand.inputLink,
          format: job.meta.format,
          aspect: job.meta.aspect,
          finding: job.meta.angle.finding,
          angle: job.meta.angle.angle,
          headline: job.meta.angle.headline,
          image: `${base}-poster.webp`,
          video: { mp4: `${base}.mp4`, webm: `${base}.webm` },
        });
      }
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) log(e.message);
    else throw e;
  } finally {
    if (items.length) {
      const all = mergeManifest(items);
      writeGenerated(all);
      writeContactSheet(all);
    }
    log(`done · est. spend $${spentUsd.toFixed(2)} of $${MAX_USD}`);
  }
}

main().catch((e) => {
  console.error('[showcase] failed:', e);
  process.exit(1);
});
