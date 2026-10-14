/**
 * Free marketing audit — local DB integration: guest ownership, duplicate-job
 * protection, rate-limit counting, lease exclusivity, refresh persistence, and
 * idempotent claim. Local Supabase only; cleans up its own rows.
 * Run: npx tsx lib/audit/audit-db.test.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

type FakeRes = { headers: Record<string, unknown>; getHeader(n: string): unknown; setHeader(n: string, v: unknown): void };
function fakeRes(): FakeRes {
  const headers: Record<string, unknown> = {};
  return {
    headers,
    getHeader: (n) => headers[n.toLowerCase()],
    setHeader: (n, v) => {
      headers[n.toLowerCase()] = v;
    },
  };
}
function cookieFrom(res: FakeRes): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
  return list.map((c) => c.split(';')[0]).join('; ');
}
const req = (cookie = '', auth?: string) =>
  ({ headers: { cookie, ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, socket: {}, query: {} }) as any;

let failed = 0;
async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n  ${(e as Error).stack?.split('\n').slice(0, 3).join('\n  ')}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) return console.log('audit-db.test: SKIP (no DATABASE_URL)');
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return console.log('audit-db.test: SKIP (non-local DB)');

  const { db } = await import('@/database/client');
  const { sql, eq, inArray } = await import('drizzle-orm');
  const schema = await import('@/database/schema');
  const { ensureGuestSession, readGuestSession, claimGuestSession } = await import('@/lib/onboarding/guest-session');
  const { ensureProfile } = await import('@/lib/auth/ensure-profile');
  const store = await import('./store');
  const { canAccessAudit, toPublicAudit } = await import('./access');

  const realUserId = randomUUID();
  const profileIds: string[] = [];
  const auditIds: string[] = [];

  try {
    await db.execute(sql`
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous)
      VALUES (${realUserId}::uuid, 'authenticated', 'authenticated', ${`audit-test-${realUserId}@example.com`}, '', now(), now(), now(),
        '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false, false)
      ON CONFLICT (id) DO NOTHING`);
    await ensureProfile(realUserId);
    profileIds.push(realUserId);

    const resA = fakeRes();
    const guestA = await ensureGuestSession(req(), resA as any);
    const cookieA = cookieFrom(resA);
    const resB = fakeRes();
    const guestB = await ensureGuestSession(req(), resB as any);
    const cookieB = cookieFrom(resB);
    profileIds.push(guestA.profileId, guestB.profileId);

    const ipHash = `test-${randomUUID()}`;
    const create = (ownerId: string, h = 'glowlabs-test.com') =>
      store.createOrReuseAudit({
        ownerIds: [ownerId],
        actorId: ownerId,
        websiteUrl: `https://${h}/`,
        host: h,
        ipHash,
        beforeInsert: async () => ({ allowed: true }),
      });

    let auditId = '';
    await run('duplicate-job protection: concurrent submits for one site create one audit', async () => {
      const results = await Promise.all([create(guestA.profileId), create(guestA.profileId), create(guestA.profileId)]);
      const ids = new Set(results.map((r) => ('row' in r ? r.row.id : 'limited')));
      assert.equal(ids.size, 1);
      auditId = [...ids][0];
      auditIds.push(auditId);
      assert.equal(results.filter((r) => 'reused' in r && !r.reused).length, 1);
    });

    await run('rate-limit counting sees this actor and IP', async () => {
      const counts = await store.countRecentAudits(guestA.profileId, ipHash);
      assert.equal(counts.actorHour, 1);
      assert.equal(counts.ipHour, 1);
      const limited = await store.createOrReuseAudit({
        ownerIds: [guestA.profileId],
        actorId: guestA.profileId,
        websiteUrl: 'https://other-test.com/',
        host: 'other-test.com',
        ipHash,
        beforeInsert: async () => ({ allowed: false }),
      });
      assert.ok('limited' in limited);
    });

    await run('guest ownership: other visitors cannot read or run the audit', async () => {
      const row = (await store.getAudit(auditId))!;
      const viewerA = await store.getAuditViewer(req(cookieA));
      const viewerB = await store.getAuditViewer(req(cookieB));
      const anon = await store.getAuditViewer(req());
      assert.equal(canAccessAudit(row.userId, viewerA), true);
      assert.equal(canAccessAudit(row.userId, viewerB), false);
      assert.equal(canAccessAudit(row.userId, anon), false);
      assert.equal(await store.acquireAuditLease(auditId, store.viewerOwnerIds(viewerB)), null);
      assert.equal(await store.selectAuditIdea(auditId, store.viewerOwnerIds(viewerB), 0), null);
    });

    await run('lease is exclusive: a second worker cannot run the same audit', async () => {
      const owners = [guestA.profileId];
      const [a, b] = await Promise.all([store.acquireAuditLease(auditId, owners), store.acquireAuditLease(auditId, owners)]);
      assert.equal([a, b].filter(Boolean).length, 1);
    });

    await run('refresh persistence: saved stage output is reloaded on the next request', async () => {
      const row = (await store.getAudit(auditId))!;
      const state = store.rowToWorkState(row);
      state.stage = 'competitors';
      state.competitors = [{ id: 'c1', name: 'Dewy Co', domain: 'dewyco.com', url: 'https://dewyco.com/', snippet: '', sourceId: 'c1', selectedBy: 'search_heuristic' }];
      await store.saveAuditProgress(auditId, state);
      const reloaded = store.rowToWorkState((await store.getAudit(auditId))!);
      assert.equal(reloaded.stage, 'competitors');
      assert.equal(reloaded.competitors[0].name, 'Dewy Co');
      state.stage = 'analysis';
      state.ideas = [0, 1, 2].map((i) => ({ title: `Idea ${i}`, hook: 'h', brief: 'b', format: 'Static post', audience: 'a', rationale: 'r', cta: 'c', evidenceIds: [], studio: 'poster' as const }));
      await store.saveAuditProgress(auditId, state);
      await store.finishAudit(auditId, 'partial');
      const sel = await store.selectAuditIdea(auditId, [guestA.profileId], 1);
      assert.equal(sel?.selectedIdeaIndex, 1);
    });

    await run('claim moves the audit to the account exactly once and grants no entitlement', async () => {
      const resClaim = fakeRes();
      const first = await claimGuestSession(req(cookieA), resClaim as any, realUserId);
      assert.equal(first.claimed, true);
      const row = (await store.getAudit(auditId))!;
      assert.equal(row.userId, realUserId);
      assert.ok(row.claimedAt);
      assert.equal(row.selectedIdeaIndex, 1);
      assert.equal(await readGuestSession(req(cookieA)), null);
      const again = await claimGuestSession(req(cookieA), fakeRes() as any, realUserId);
      assert.equal(again.claimed, false);
      const viewerReal = { authUserId: realUserId, guestProfileId: null };
      assert.equal(toPublicAudit(row, viewerReal).ownedByGuest, false);
      const [prof] = await db
        .select({ ui: schema.profiles.uiPreferences })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, realUserId));
      assert.ok(!JSON.stringify(prof?.ui ?? {}).includes('subscribed'));
      const subs = await db.execute(sql`select count(*)::int as n from public.subscriptions where user_id = ${realUserId}::uuid`).catch(() => ({ rows: [{ n: 0 }] }) as any);
      assert.equal(Number((subs as any).rows?.[0]?.n ?? 0), 0);
    });

    await run('campaign lock is single-use per audit', async () => {
      const [l1, l2] = await Promise.all([store.lockAuditCampaign(auditId, realUserId), store.lockAuditCampaign(auditId, realUserId)]);
      assert.equal([l1, l2].filter(Boolean).length, 1);
      assert.equal(await store.lockAuditCampaign(auditId, guestB.profileId), false);
      await store.setAuditCampaign(auditId, null);
    });
  } finally {
    if (auditIds.length) await db.delete(schema.marketingAudits).where(inArray(schema.marketingAudits.id, auditIds));
    const guests = profileIds.filter((p) => p !== realUserId);
    if (guests.length) {
      await db.delete(schema.onboardingGuestSessions).where(inArray(schema.onboardingGuestSessions.profileId, guests));
      await db.delete(schema.profiles).where(inArray(schema.profiles.id, guests));
    }
    await db.delete(schema.profiles).where(eq(schema.profiles.id, realUserId));
    await db.execute(sql`delete from auth.users where id = ${realUserId}::uuid`);
  }

  if (failed) {
    console.log(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nall audit DB tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
