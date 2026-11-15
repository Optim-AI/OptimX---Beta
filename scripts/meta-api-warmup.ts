/**
 * Makes ~500 read-only Marketing API calls with the connected Meta account, for App Review's
 * "Marketing API Access Tier: at least 500 calls, 85% success" requirement.
 * Read-only (GET): never changes anything in the ad accounts. Paces itself on Meta's usage headers
 * so calls don't get throttled (throttled calls count as errors).
 *
 *   npx tsx scripts/meta-api-warmup.ts            # 520 successful calls
 *   npx tsx scripts/meta-api-warmup.ts --calls 20 # short trial
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { Client } from 'pg';

const arg = process.argv.indexOf('--calls');
const TARGET = arg > -1 ? Number(process.argv[arg + 1]) : 520;
const BASE_GAP_MS = 5_000; // ~12 calls a minute: inside the development tier's budget

(async () => {
  const { graphCall, MetaGraphError } = await import('../lib/meta/graph');
  const { decryptToken } = await import('../lib/meta/crypto');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const conn = (await db.query(`select id, token_enc from meta_connections where status = 'active' order by created_at desc limit 1`)).rows[0];
  if (!conn) throw new Error('No active Meta connection');
  const accounts = (await db.query(`select meta_id from meta_assets where connection_id = $1 and kind = 'ad_account' and selected`, [conn.id])).rows.map((r) => String(r.meta_id));
  await db.end();
  if (!accounts.length) throw new Error('No ad account selected');
  const token = decryptToken(conn.token_enc);
  const act = (id: string) => (id.startsWith('act_') ? id : `act_${id}`);

  // Simple, cheap Marketing API reads on the owner's own ad accounts.
  const calls: [string, Record<string, string | number>][] = accounts.flatMap((id) => [
    [act(id), { fields: 'name,account_status,currency,timezone_name' }],
    [`${act(id)}/campaigns`, { fields: 'id,name,status', limit: 25 }],
    [`${act(id)}/adsets`, { fields: 'id,name,status', limit: 25 }],
    [`${act(id)}/ads`, { fields: 'id,name,status', limit: 25 }],
    [`${act(id)}/insights`, { fields: 'spend,impressions,clicks', date_preset: 'last_30d', level: 'account' }],
  ] as [string, Record<string, string | number>][]);

  let ok = 0, failed = 0, i = 0, gap = BASE_GAP_MS;
  const started = Date.now();
  while (ok < TARGET) {
    const [path, params] = calls[i++ % calls.length];
    let maxPct = 0;
    try {
      await graphCall(path, token, params, { attempts: 1, onUsage: (u) => { maxPct = u.maxPct ?? 0; } });
      ok++;
    } catch (err) {
      failed++;
      const e = err as InstanceType<typeof MetaGraphError>;
      console.log(`call failed (${e?.code ?? '?'}): ${(e?.message ?? '').slice(0, 120)}`);
      if (e?.isAuthError) throw new Error('Meta login expired: reconnect in Settings → Integrations, then run again.');
      if (e?.isThrottle) { console.log('Meta asked us to slow down: pausing 5 minutes'); await new Promise((r) => setTimeout(r, 300_000)); }
      if (failed > 20 && failed / (ok + failed) > 0.1) throw new Error(`Too many errors (${failed}); stopping to protect the success rate.`);
    }
    // Slow down as Meta's usage climbs, speed back up when it falls.
    gap = maxPct >= 75 ? 60_000 : maxPct >= 50 ? 20_000 : maxPct >= 25 ? 10_000 : BASE_GAP_MS;
    if ((ok + failed) % 25 === 0) console.log(`${ok} ok, ${failed} failed · usage ${maxPct}% · ${Math.round((Date.now() - started) / 60_000)} min`);
    await new Promise((r) => setTimeout(r, gap));
  }
  console.log(`Done: ${ok} successful, ${failed} failed (${((ok / (ok + failed)) * 100).toFixed(1)}% success) in ${Math.round((Date.now() - started) / 60_000)} min.`);
  process.exit(0);
})().catch((e) => { console.error((e as Error).message); process.exit(1); });
