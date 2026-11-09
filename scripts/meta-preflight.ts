/**
 * Pre-launch check for Meta Intelligence + Ad Studio posters. Read-only: it never writes data
 * and never prints a secret value — only whether each setting is there and works.
 *
 *   npm run meta:preflight                       # uses .env.local
 *   npm run meta:preflight -- --env .env.production.local
 */
import { config } from 'dotenv';
import { Client } from 'pg';

const envArg = process.argv.indexOf('--env');
const envFile = envArg > -1 ? process.argv[envArg + 1] : '.env.local';
config({ path: envFile, quiet: true });

let fails = 0, warns = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails++; console.log(`  ✗ ${m}`); };
const warn = (m: string) => { warns++; console.log(`  ! ${m}`); };
const has = (k: string) => !!process.env[k]?.trim();

const TABLES: Record<string, string[]> = {
  meta_connections: ['token_enc', 'brief_email_enabled'],
  meta_assets: [], meta_deletion_requests: [],
  meta_campaigns: [], meta_adsets: [], meta_creatives: [], meta_ads: [], meta_ad_insights_daily: [],
  meta_organic_posts: [], meta_organic_post_insights_daily: [], sync_runs: [], skalx_asset_hashes: [],
  ai_insights: [], test_packs: ['formats'], test_pack_variants: [],
  weekly_briefs: ['poster_project_id'],
  ad_studio_projects: [], ad_studio_drafts: ['final_url', 'ad_name', 'image_md5'],
  trend_snapshots: [], brand_trend_ideas: [],
  ig_watch_items: [], ig_hashtag_queries: [], ig_style_reads: [],
};
const PRIVATE_BUCKETS = ['meta-creatives', 'test-packs', 'ad-drafts'];

(async () => {
  console.log(`Meta Intelligence pre-launch check (${envFile})\n`);

  console.log('Settings');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ?? '';
  const local = /localhost|127\.0\.0\.1/.test(appUrl);
  for (const k of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'META_LOGIN_CONFIG_ID', 'SESSION_SECRET', 'NEXT_PUBLIC_APP_URL', 'GEMINI_API_KEY']) {
    if (has(k)) ok(k); else bad(`${k} is missing`);
  }
  const key = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim() ?? '';
  const keyLen = /^[0-9a-f]{64}$/i.test(key) ? 32 : Buffer.from(key.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length;
  if (!key) bad('INTEGRATION_TOKEN_ENCRYPTION_KEY is missing');
  else if (keyLen !== 32) bad('INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  else ok('INTEGRATION_TOKEN_ENCRYPTION_KEY (32 bytes). Use the SAME key everywhere, or saved Meta logins stop working');
  if (appUrl && !local && !appUrl.startsWith('https://')) bad('NEXT_PUBLIC_APP_URL must start with https:// outside localhost');
  if (!has('CRON_SECRET')) {
    if (local) warn('CRON_SECRET missing: fine locally; in production the daily Meta sync and Monday brief crons are refused without it');
    else bad('CRON_SECRET is missing: Vercel Cron can’t run the daily Meta sync or the Monday brief');
  } else ok('CRON_SECRET');
  if (!has('RESEND_API_KEY')) warn('RESEND_API_KEY missing: the Monday brief email will not send');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    if (local) warn('NODE_TLS_REJECT_UNAUTHORIZED=0 turns off HTTPS certificate checks: never set it in production');
    else bad('NODE_TLS_REJECT_UNAUTHORIZED=0 turns off HTTPS certificate checks: remove it');
  }

  console.log('\nDatabase');
  if (has('DATABASE_URL')) {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await db.connect();
      const cols = await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1)`, [Object.keys(TABLES)]);
      const seen = new Map<string, Set<string>>();
      for (const r of cols.rows) (seen.get(r.table_name) ?? seen.set(r.table_name, new Set()).get(r.table_name)!).add(r.column_name);
      const missing = Object.entries(TABLES).flatMap(([t, cs]) => (!seen.has(t) ? [t] : cs.filter((c) => !seen.get(t)!.has(c)).map((c) => `${t}.${c}`)));
      if (missing.length) bad(`Missing: ${missing.join(', ')}. Run the migrations 20261108120000 … 20261109130000`);
      else ok(`All ${Object.keys(TABLES).length} tables and new columns are there`);
      const b = await db.query(`select id, public from storage.buckets where id = any($1)`, [PRIVATE_BUCKETS]);
      for (const id of PRIVATE_BUCKETS) {
        const row = b.rows.find((r) => r.id === id);
        if (!row) bad(`Storage bucket "${id}" is missing`);
        else if (row.public) bad(`Storage bucket "${id}" must be PRIVATE`);
        else ok(`Storage bucket "${id}" (private)`);
      }
    } catch (e) {
      bad(`Could not check the database: ${(e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, '<db url>')}`);
    } finally {
      await db.end().catch(() => {});
    }
  }

  console.log('\nMeta app');
  if (has('FACEBOOK_APP_ID') && has('FACEBOOK_APP_SECRET')) {
    try {
      const { META_GRAPH_VERSION } = await import('../lib/meta/version');
      const token = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
      const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${process.env.FACEBOOK_APP_ID}?fields=name`, { headers: { Authorization: `OAuth ${token}` } });
      const j = (await r.json()) as { name?: string; error?: { message?: string } };
      if (r.ok && j.name) ok(`App ID and secret work (app "${j.name}")`);
      else bad(`Meta rejected the app ID/secret: ${j.error?.message ?? r.status}`);
    } catch (e) {
      warn(`Could not reach Meta: ${(e as Error).message}`);
    }
  }
  if (appUrl) {
    console.log('  Paste these into the Meta app dashboard:');
    console.log(`    Valid OAuth redirect URI ......... ${appUrl}/api/meta-intel/callback`);
    console.log(`    Data deletion request URL ........ ${appUrl}/api/meta-intel/data-deletion`);
    console.log(`    Deauthorize callback URL ......... ${appUrl}/api/meta-intel/deauthorize`);
    console.log(`    Privacy policy URL ............... ${appUrl}/privacy-policy`);
    console.log(`    Terms of service URL ............. ${appUrl}/terms-and-conditions`);
  }

  console.log('\nGemini (AI insights, poster chat, ad copy, test-pack angles)');
  if (has('GEMINI_API_KEY')) {
    const model = process.env.AI_TEXT_MODEL?.trim() || 'gemini-3.8-flash';
    try {
      // Model lookup is free: it confirms the key works and the model is available to it.
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim() } });
      if (r.ok) ok(`API key works and can use ${model}`);
      else bad(`Gemini key/model check failed (${r.status}) for ${model}`);
    } catch (e) {
      warn(`Could not reach Gemini: ${(e as Error).message}`);
    }
  }

  console.log(`\n${fails ? `${fails} problem(s) to fix` : 'Ready'}${warns ? `, ${warns} warning(s)` : ''}.`);
  process.exit(fails ? 1 : 0);
})();
