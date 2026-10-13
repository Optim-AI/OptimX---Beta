/**
 * Local Postgres RLS isolation for integrations / ad_accounts / oauth_sessions.
 * Run: npx --yes tsx lib/ads/security/rls-credential-tables.test.ts
 *
 * Requires local DATABASE_URL (Supabase local). Does not mutate production.
 * Proves policy behavior; does not claim full production security by itself.
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:54322/postgres";

async function main() {
  const admin = new Client({ connectionString: DATABASE_URL });
  await admin.connect();

  const userA = randomUUID();
  const userB = randomUUID();
  const integA = randomUUID();
  const integB = randomUUID();
  const acctA = randomUUID();
  const acctB = randomUUID();
  const sessionA = `oauth_test_${randomUUID()}`;
  const sessionB = `oauth_test_${randomUUID()}`;

  try {
    // Preconditions: RLS enabled
    const rls = await admin.query(
      `SELECT c.relname, c.relrowsecurity AS on
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])
       ORDER BY 1`,
      [["integrations", "ad_accounts", "oauth_sessions"]]
    );
    for (const row of rls.rows) {
      assert.strictEqual(
        row.on,
        true,
        `RLS must be enabled on ${row.relname} (apply migration 20261013120000 first)`
      );
    }

    // Seed as table owner (bypasses RLS) — mirrors server DAO / DATABASE_URL
    await admin.query(
      `INSERT INTO public.integrations (id, user_id, provider, access_token, refresh_token)
       VALUES ($1, $2, 'meta', 'tok_a_secret', 'ref_a'),
              ($3, $4, 'meta', 'tok_b_secret', 'ref_b')`,
      [integA, userA, integB, userB]
    );
    await admin.query(
      `INSERT INTO public.ad_accounts (id, integration_id, account_id, provider, is_selected)
       VALUES ($1, $2, '111', 'meta', true),
              ($3, $4, '222', 'meta', false)`,
      [acctA, integA, acctB, integB]
    );
    await admin.query(
      `INSERT INTO public.oauth_sessions (id, user_id, provider, data, expires_at)
       VALUES ($1, $2, 'meta', '{"userAccessToken":"sess_a"}'::jsonb, now() + interval '1 hour'),
              ($3, $4, 'meta', '{"userAccessToken":"sess_b"}'::jsonb, now() + interval '1 hour')`,
      [sessionA, userA, sessionB, userB]
    );

    // Owner path still works as postgres (server DAO)
    const ownerSee = await admin.query(
      `SELECT count(*)::int AS n FROM public.integrations WHERE id = ANY($1::uuid[])`,
      [[integA, integB]]
    );
    assert.strictEqual(ownerSee.rows[0].n, 2, "server role must still read all rows");

    // Authenticated as user A
    await admin.query("BEGIN");
    await admin.query("SET LOCAL ROLE authenticated");
    await admin.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
      userA,
    ]);
    await admin.query(
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
    );

    const ownIntegrations = await admin.query(
      `SELECT id::text AS id, access_token FROM public.integrations`
    );
    assert.strictEqual(ownIntegrations.rows.length, 1);
    assert.strictEqual(ownIntegrations.rows[0].id, integA);
    assert.ok(
      !ownIntegrations.rows.some((r: any) => r.id === integB),
      "cross-user integrations must be hidden"
    );

    const ownAccounts = await admin.query(
      `SELECT id::text AS id FROM public.ad_accounts`
    );
    assert.strictEqual(ownAccounts.rows.length, 1);
    assert.strictEqual(ownAccounts.rows[0].id, acctA);

    const oauthAsUser = await admin.query(
      `SELECT id FROM public.oauth_sessions`
    );
    assert.strictEqual(
      oauthAsUser.rows.length,
      0,
      "authenticated must not read oauth_sessions (token JSON)"
    );

    // Writes as authenticated should fail (no INSERT policy)
    let insertBlocked = false;
    try {
      await admin.query(
        `INSERT INTO public.integrations (id, user_id, provider)
         VALUES ($1, $2, 'meta')`,
        [randomUUID(), userA]
      );
    } catch {
      insertBlocked = true;
    }
    assert.ok(insertBlocked, "authenticated INSERT into integrations must be denied");

    await admin.query("ROLLBACK");

    // Anonymous role
    await admin.query("BEGIN");
    await admin.query("SET LOCAL ROLE anon");
    const anonIntegrations = await admin.query(
      `SELECT count(*)::int AS n FROM public.integrations`
    );
    assert.strictEqual(anonIntegrations.rows[0].n, 0, "anon cannot read integrations");
    const anonOauth = await admin.query(
      `SELECT count(*)::int AS n FROM public.oauth_sessions`
    );
    assert.strictEqual(anonOauth.rows[0].n, 0, "anon cannot read oauth_sessions");
    await admin.query("ROLLBACK");

    // User B isolation
    await admin.query("BEGIN");
    await admin.query("SET LOCAL ROLE authenticated");
    await admin.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
      userB,
    ]);
    await admin.query(
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
    );
    const bOnly = await admin.query(
      `SELECT id::text AS id FROM public.integrations`
    );
    assert.strictEqual(bOnly.rows.length, 1);
    assert.strictEqual(bOnly.rows[0].id, integB);
    await admin.query("ROLLBACK");

    console.log("rls-credential-tables.test: PASS");
  } finally {
    try {
      await admin.query(`DELETE FROM public.oauth_sessions WHERE id = ANY($1::text[])`, [
        [sessionA, sessionB],
      ]);
      await admin.query(`DELETE FROM public.ad_accounts WHERE id = ANY($1::uuid[])`, [
        [acctA, acctB],
      ]);
      await admin.query(`DELETE FROM public.integrations WHERE id = ANY($1::uuid[])`, [
        [integA, integB],
      ]);
    } catch (e) {
      console.warn("cleanup warning:", (e as Error).message);
    }
    await admin.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
