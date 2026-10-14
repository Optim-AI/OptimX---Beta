# Free Marketing Audit — Implementation Guide (port to `main`)

Branch of record: `feat/free-marketing-audit-main` (from `main`).  
Originally developed on `staging` / `feat/free-marketing-audit`; ported to `main` with guest-session prerequisites included.  
Status: local only — not committed, pushed, or deployed unless you explicitly do so.

---

## 1. Product goal

Make the free marketing audit the front door to SkalX AI:

1. Visitor pastes a website (no signup).
2. System researches brand + competitors + recent public activity.
3. Results show evidence-grounded insights and **exactly 3** content ideas.
4. Visitor picks an idea → auth → pricing/plans → home (or checkout).
5. Guest audit is claimed into the authenticated account. Completing an audit **does not** grant paid entitlements.

The audit is an acquisition layer feeding the existing campaign/creative engine — not a separate product.

---

## 2. User journey (current funnel)

```
Home (/)
  → Hero URL form → POST /api/audit → /audit/:id (research + results)
  → Select idea → Auth (signup/signin?next=/pricing?from=audit)
  → /pricing?from=audit (claims guest audit; plan UI)
  → Home (/) via “Back to home”, or /subscribe if they pick a plan

Secondary: “Don't have a website? Explore plans” → /pricing (no audit)
Header “Get free audit” → scroll/focus hero input + “Paste your website here” tip
```

`/try` still exists for post-login routing. Audit CTAs on the landing page no longer send people there as the primary path.

---

## 3. Prerequisites on target branch

Before porting to `main`, confirm these exist (they live on `staging` / this feature branch):

| Dependency | Why |
|---|---|
| Guest cookie `skalx_try` + `lib/onboarding/guest-session.ts` | Anonymous ownership + claim |
| `profiles` + shadow guest profiles | `marketing_audits.user_id` FK |
| `creative_studio_sessions` | Optional campaign session link |
| Existing AI orchestration used by audit (`lib/audit/ai.ts`) | Brand/ideas generation |
| Meta Graph token (optional) | Meta Ad Library ads |
| SerpApi key as `SEARCH_API_KEY` and/or `SERPAPI_KEY` | Google search + Ads Transparency |
| Vercel Analytics (`@vercel/analytics`) | Funnel events |
| `getSafeNextPath` / post-auth destination helpers | Safe `next=` after login |

**Env (server-only):**

```bash
# SerpApi (serpapi.com) — NOT SearchApi.io
SEARCH_API_KEY=...          # or SERPAPI_KEY=...
# Optional Meta Ad Library
META_ACCESS_TOKEN=...       # existing Graph token naming in repo
# Optional IP hash salt
AUDIT_IP_SALT=...
```

Docs used: [Search API](https://serpapi.com/search-api), [Google Ads Transparency](https://serpapi.com/google-ads-transparency-center-api). SerpApi has no Meta Ad Library engine; Meta still uses Graph.

---

## 4. Database

### Migration

File: `supabase/migrations/20261014120000_marketing_audits.sql`

- Table `public.marketing_audits`
- Columns: ownership (`user_id`), URL/host, `status`/`stage`, lease + attempts, JSON payloads (`site`, `brand`, `competitors`, `competitor_posts`, `insights`, `ideas`, `sources`, `limitations`, `error`), `selected_idea_index`, optional `campaign_session_id`, `client_ip_hash`, claim/complete timestamps
- Indexes: `(user_id, created_at)`, `(client_ip_hash, created_at)`, `(user_id, normalized_host)`
- RLS enabled with **no policies** (server/Drizzle only — same pattern as `onboarding_guest_sessions`)

Apply **locally** when porting; do not run destructive SQL against production without a deliberate release process.

### Drizzle

`database/schema.ts` — table `marketingAudits` mirroring the migration.

### Claim path

`lib/onboarding/guest-session.ts` → `claimGuestSession` also reassigns:

```ts
db.update(marketingAudits)
  .set({ userId: realUserId, claimedAt: ..., updatedAt: ... })
  .where(eq(marketingAudits.userId, guest.profileId))
```

alongside existing creative/studio reassignments. Idempotent: already-claimed / same-user returns `{ claimed: false }`.

---

## 5. File map

### New (copy as-is)

```
lib/audit/
  types.ts              # Shared shapes (observed vs interpretation)
  url-safety.ts         # Normalize URL + SSRF guards (DNS pin, private IPs, metadata)
  evidence.ts           # Strip fabricated numbers / ungrounded claims
  ai.ts                 # Brand + analysis + ideas prompts
  store.ts              # Create/reuse, lease, stage writes
  access.ts             # Ownership checks + public DTO
  rate-limit.ts         # 5/h & 15/d per actor; 10/h & 30/d per IP hash
  pipeline.ts           # Stages: site → brand → competitors → posts → analysis
  campaign.ts           # Idea → draft studio session (no image/video gen)
  analytics.ts          # Funnel events + audit next-path helpers
  audit.test.ts         # Unit/integration (mocked providers) — 29 checks
  audit-db.test.ts      # Local DB ownership/claim — 7 checks

lib/research/
  serp-search.ts        # SerpApi Google + Ads Transparency helpers
  competitor-research.ts # Shared queries / Meta helpers (also used by CI analyze)

pages/api/audit/
  index.ts              # POST create/reuse
  [id]/index.ts         # GET audit (owner only)
  [id]/run.ts           # POST advance pipeline
  [id]/select.ts        # POST select idea index 0–2
  [id]/campaign.ts      # POST start campaign (auth required; claims guest)

pages/audit/[id].tsx    # Results UI (progress, partial, retry, select idea)
pages/pricing.tsx       # Public pricing; ?from=audit claims + copy

app/web/src/components/creative-studio/ad-builder-defaults.ts
supabase/migrations/20261014120000_marketing_audits.sql
```

### Modified (port carefully)

| File | Change |
|---|---|
| `Hero.tsx` | Audit copy, URL form, submit → `/api/audit`, paste-hint listener |
| `Header.tsx` | CTAs → hero; “Get free audit” scrolls + `skalx:focus-audit` tip |
| `Footer.tsx`, `BuiltFor.tsx`, `ProductSection.tsx`, `FinalCTA.tsx` | Primary CTAs → `/#home` (audit form) |
| `TryPricingExperience.tsx` | Optional back-label / intro when used from `/pricing?from=audit` |
| `guest-session.ts` | Claim moves `marketing_audits` |
| `schema.ts` | `marketingAudits` table |
| `client-post-auth.ts` | Re-export `auditReturnPath` / `resolvePostAuthPath` |
| `pages/auth/{signin,signup,callback}.tsx` | Honor audit `next=` over default post-login path |
| `pages/subscribe.tsx` | Audit paid-conversion attribution when applicable |
| `pages/api/creative-intelligence/analyze.ts` | Uses shared `lib/research/competitor-research` (behavior preserved) |
| `creative-studio/utils.ts` | Small helpers for ad-builder defaults wiring |

---

## 6. API contract

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/api/audit` | Guest or user | Validate URL + SSRF; rate-limit; create or reuse by host (24h); return public audit |
| `GET` | `/api/audit/:id` | Owner only | 404 if wrong visitor |
| `POST` | `/api/audit/:id/run` | Owner | Advance one/more pipeline stages under lease; retry ≤ 3 |
| `POST` | `/api/audit/:id/select` | Owner | Persist `selected_idea_index` 0–2 |
| `POST` | `/api/audit/:id/campaign` | Authenticated | Claim guest if needed; create/reuse draft studio session; **no** creative generation |

Statuses: `queued` | `running` | `completed` | `partial` | `failed`  
Stages: `queued` → `site` → `brand` → `competitors` → `posts` → `analysis`

---

## 7. Research pipeline (rules that matter)

1. **Site** — Safe fetch (HTTP/S only, block localhost/private/reserved/metadata, pin DNS to checked IP, timeout, 2 MB, HTML content-type).
2. **Brand** — Observed facts from page + AI interpretation labeled separately.
3. **Competitors** — Only from real SerpApi organic results.
   - Reject blog/listicle/editorial paths as “brands”.
   - From listicles, extract `named_brands` and resolve official homepages (small budget).
   - Cap Serp queries (~3) to conserve free credits.
4. **Posts / ads**
   - Meta Ad Library via Graph when token present; advertiser name must match competitor.
   - Google Ads Transparency via SerpApi; UI label = **Google ad** (not Meta).
   - Instagram: search snippets (`site:instagram.com`); must mention competitor; recent.
   - Max **1 ad + 1 organic per competitor**, interleaved across brands (avoids one brand repeating).
   - Drop ads older than ~540 days.
5. **Analysis** — Themes/opportunities cite evidence IDs; strip sentences with numbers not in evidence; always emit 3 ideas (AI or fallback from site copy + limitation note).

Never fabricate competitors, posts, dates, or engagement. If research fails → `partial` + clear limitations, still useful brand/ideas.

---

## 8. Auth & entitlements

- Guest owns audit via shadow profile id until claim.
- Allowed `next=` overrides after login: `/pricing?from=audit` (preferred) or legacy `/audit/:uuid`.
- Helpers: `auditPricingPath()`, `auditReturnPath()`, `resolvePostAuthPath()` in `lib/audit/analytics.ts`.
- Pricing with `from=audit` calls `POST /api/onboarding/claim`.
- Audit completion does **not** skip subscription checks; signed-in free users still go through plans/`/try` rules as before.

---

## 9. Landing UX details

### Hero

- Headline: “Your competitors are marketing. Are you learning from them?”
- Supporting copy + primary CTA “Get my free audit”
- Secondary link → `/pricing` without starting an audit
- Input id: `hero-brand-input`

### Header tip

On “Get free audit”:

1. If not on `/`, set `sessionStorage['skalx:focus-audit']=1` and `router.push('/#home')`.
2. If on `/`, scroll `#hero-brand-input` into view, dispatch `CustomEvent('skalx:focus-audit')`, focus input.
3. Hero shows a short callout: **“Paste your website here”** (~5s, clears on type / Escape), with a light pulse on the input.

---

## 10. Analytics events

Via existing Vercel Analytics (`trackAuditEvent`):

`audit_started` · `audit_completed` · `audit_results_viewed` · `audit_idea_selected` · `audit_campaign_started` · `signup_completed` · `audit_claimed` · `audit_paid_conversion`

Attribution for paid conversion: `rememberAuditAttribution` / `consumeAuditAttribution` (localStorage, 30-day window).

---

## 11. Security checklist

- [x] SSRF: private IPs, metadata (`169.254.169.254`), non-HTTP, unsafe redirects, DNS rebinding pin
- [x] Rate limits (actor + hashed IP)
- [x] Duplicate job lease; host reuse window
- [x] Owner-only GET (cross-guest → 404)
- [x] Untrusted page content in AI prompts; do not persist Meta tokenised snapshot URLs in audit sources
- [x] API keys server-side only
- [ ] Known pre-existing: Creative Intelligence may still store Meta `ad_snapshot_url` tokens — out of audit scope; do not copy that pattern into audit

---

## 12. Tests & commands

```bash
# Unit + evidence/SSRF/funnel path checks
npx tsx lib/audit/audit.test.ts

# Requires local DB + applied migration
npx tsx lib/audit/audit-db.test.ts

# Broader
npx tsc --noEmit
# lint / next build as available in package.json
```

Covered: URL validation, SSRF rejection, fabricated-data scrubbing, guest ownership, reuse, claim, entitlement unchanged, pricing navigation, listicle-not-as-brand, rate-limit decisions.

---

## 13. Porting to `main` — recommended order

1. Confirm guest-session + profiles exist on `main` (or merge `staging` prerequisites first).
2. Add migration + `schema.ts` table; apply to local Supabase.
3. Copy `lib/audit/*`, `lib/research/*`, `pages/api/audit/*`, `pages/audit/[id].tsx`, `pages/pricing.tsx`, `ad-builder-defaults.ts`.
4. Patch `guest-session` claim, auth callback/signin/signup, `client-post-auth`, `subscribe`.
5. Replace Hero + landing CTAs + Header tip behavior.
6. Refactor CI `analyze.ts` to shared research module (or keep dual path temporarily).
7. Set SerpApi key; restart dev server.
8. Smoke: SSRF rejects, live audit on a public brand, ownership 404, reuse, auth → pricing claim, no paid unlock.
9. Run test files + `tsc` + production build.

Do **not**: reset prod data, deploy, push, or grant entitlements from audit completion.

---

## 14. Known limitations

| Item | Notes |
|---|---|
| SerpApi free tier | ~100 searches/mo; ~3–8 searches per audit |
| Instagram | Public search snippets only; not full organic feed |
| Email confirm | Claim needs same browser (guest cookie); Google OAuth fine |
| Branch base | Built on `staging` guest system |
| Cache | Same visitor + host reuses audit ~24h — force new host or wait for re-test |

---

## 15. Definition of done (acceptance)

- [ ] Visitor enters real URL without signup and gets evidence-grounded results + 3 ideas
- [ ] Competitors are real brands (not one listicle domain repeating)
- [ ] Observed vs AI interpretation is clear; sources/dates when available
- [ ] Idea → auth → `/pricing?from=audit` → home/checkout; audit claimed
- [ ] No website → `/pricing` directly
- [ ] Header free-audit tip points at hero input
- [ ] SSRF, rate limits, ownership, entitlement rules hold
- [ ] Tests + TypeScript + build pass on the port branch
