# Social Studio — Facebook Page Publishing (Milestone 1)

Organic Facebook Page photo publishing from generated posters in SkalX.
Separate from Meta Ads (`provider = meta`). Publishing uses `provider = meta-publish`.

## Architecture reused

- Supabase Auth + `getUserIdFromRequest`
- Integration token encryption (`prepareTokensForStorage` / `revealTokens`) and `integrations` table (second provider row)
- OAuth session store (`oauth_sessions`) with provider `meta-publish`
- `createFacebookPost` → Graph `/{page-id}/photos`
- Public `campaign-assets` URLs for Meta-fetchable media
- Image Library publish panel UI patterns

## Permissions

| Permission | Purpose | Finalize hard-required? |
|---|---|---|
| `pages_show_list` | `GET me/accounts` Page discovery | Yes |
| `pages_manage_posts` | `POST /{page-id}/photos` | Yes |
| `pages_read_engagement` | Meta-documented dependency of `pages_manage_posts` (App Review / Pages API). Not used by our discovery/publish calls. | No (recommended in FLB config) |

`pages_read_user_content` is **not** requested.

Instagram permissions are **not** requested in this flow.

### Permission inspection notes

Finalize inspects grants via `debug_token` **and** merges `granular_scopes` / `/me/permissions`. Using only `data.scopes` falsely reports `pages_manage_posts` missing on many FLB tokens.

On finalize failure, server logs a **sanitized** diagnostics object: `debug_token.data.scopes` names, `granular_scopes` names with `targetIdCount` (never Page IDs), `/me/permissions` name+status, and whether required permissions were detected. The Login configuration ID is never logged.

If Meta returns 11+ other grants (including `pages_read_engagement`) but not `pages_manage_posts`, that is a **Meta non-grant** (Login config omission, declined permission, or access-level/availability) — not a SkalX parse bug. Confirm `FACEBOOK_PUBLISH_LOGIN_CONFIG_ID` points at the SkalX Publish configuration that includes `pages_manage_posts` (do not reuse the Ads configuration).

### (#200) pages_manage_posts are not available

OAuth/connect can succeed while publish still fails if Meta did not actually grant `pages_manage_posts` (config omission, declined grant, access-level restriction, or non-role user in Development). Changing access level alone is not proven sufficient without reconnecting and confirming the permission appears on the new token.

### Why classic `scope=` can show “Invalid Scopes”

This app uses **Facebook Login for Business**. Permissions that are not part of a Login Configuration (and not available on the Ads configuration) are rejected as Invalid Scopes when requested via `scope=` — including `pages_manage_posts`. The working Ads flow only requests permissions already allowed for “SkalX Ads”.

**Fix:** create a separate FLB configuration for publishing and set `FACEBOOK_PUBLISH_LOGIN_CONFIG_ID`. Do **not** reuse `FACEBOOK_LOGIN_CONFIG_ID` (Ads).

### Meta App Dashboard

1. Add Valid OAuth Redirect URI:  
   `{NEXT_PUBLIC_APP_URL}/api/social/facebook/oauth/callback`  
   (keep the existing Ads callback URI as well).
2. App Domains: include `localhost` for local dev.
3. **Facebook Login for Business → Configurations → Create/Edit:**
   - Name: `SkalX Publish` (or similar)
   - Permissions: at least `pages_show_list` + `pages_manage_posts`; include `pages_read_engagement` when Meta requires it for the configuration
   - Copy the Configuration ID into `.env.local` as `FACEBOOK_PUBLISH_LOGIN_CONFIG_ID`
4. Confirm in App Dashboard that `pages_manage_posts` is available to request for this app/use case (access level depends on app type and roles).
5. **Development mode:** only users with an app role (Admin / Developer / Tester) can typically use restricted permissions until Advanced Access / App Review for Live non-role users.
6. After changing the Login configuration, click **Reconnect** in SkalX so a new token is issued.

## Manual E2E test (one real Page post)

1. Apply migration `supabase/migrations/20261009180000_social_posts_publishing.sql` (local: `supabase db reset` or migrate).
2. Ensure `.env.local` has `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
3. In Meta App → Facebook Login → Valid OAuth Redirect URIs, add the publish callback above.
4. Sign in to SkalX as an app-role user who manages the target Page.
5. Open **Generated contents**, select a poster you own (library row with storage path).
6. Set `FACEBOOK_PUBLISH_LOGIN_CONFIG_ID` from the SkalX Publish FLB configuration.
7. Click **Publish** → **Connect Facebook Page** → approve → select Page.
8. Preview image, edit caption, **Publish to Facebook** (or **Save draft**).
9. Confirm success UI and that the photo appears on the Page. Check `social_posts` for `status=published` and `meta_post_id`. Local Supabase images are uploaded via multipart `source` (Meta never receives `localhost` `url=`). Hosted public HTTPS URLs still use Meta’s `url` fetch.
10. Confirm Meta Ads connection (`provider=meta`) is unchanged.

### Image upload modes

| Source | Mode |
|---|---|
| Public HTTPS image URL (non-private host) | Meta `url` parameter |
| Local / loopback Supabase Storage (owned creative) | Server download → multipart `source` |
| Data URLs, unowned localhost, private SSRF targets | Rejected with a clear error |

## Instagram extension (Milestone 2 — not implemented)

Do **not** add these scopes to the Facebook-only OAuth until Instagram work begins.

### Discover linked Instagram professional account

- After Page selection, call Graph `/{page-id}?fields=instagram_business_account` with the Page token.
- Require a linked Instagram Business/Creator account; surface a clear eligibility error if missing.

### Authorization & permissions

- Additional scopes typically required (confirm against current Graph docs at implementation time):
  - `instagram_basic` (or successor)
  - `instagram_content_publish`
  - optionally `instagram_manage_comments` / `pages_read_engagement` as needed
- Prefer a dedicated `meta-instagram-publish` integration provider (or extend `meta-publish` metadata) so Ads tokens stay untouched.
- App Review / Advanced Access applies for Live users.

### Media requirements

- Public HTTPS image/video URLs Meta can fetch (same storage constraints as Facebook).
- Image: JPEG/PNG size limits per IG Content Publishing API.
- Video/Reels: format, duration, aspect ratio, and container status polling.

### Publish flows

1. **Image:** create media container (`/{ig-user-id}/media`) → poll `status_code` until `FINISHED` → `/{ig-user-id}/media_publish`.
2. **Video / Reels:** create container with `media_type=REELS` (or VIDEO) → poll until finished → publish.
3. Never report success until `media_publish` returns an IG media id.
4. Do not auto-retry ambiguous publish responses (duplicate risk).

### Errors & eligibility

- Handle unpublished Page, missing IG link, permission denied, rate limits, and container `ERROR` statuses with user-readable messages.
- Persist results in `social_posts` (or a sibling table) with `provider` distinguishing Facebook vs Instagram destinations.

## API surface (this milestone)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/social/facebook/oauth/start` | Start publishing OAuth |
| GET | `/api/social/facebook/oauth/callback` | OAuth callback |
| GET | `/api/social/facebook/oauth/session` | Sanitized Page list |
| POST | `/api/social/facebook/oauth/finalize` | Save `meta-publish` integration |
| GET | `/api/social/facebook/status` | Connection status |
| POST | `/api/social/facebook/publish` | Draft or publish photo |
| GET | `/api/social/facebook/posts` | Publishing history |

## Known limitations

- Scheduling is not implemented.
- Localhost image URLs are not fetchable by Meta Graph in production.
- Bucket is not made fully private; existing public `campaign-assets` URLs are reused.
- Instagram is shown in the Publish composer but **not** markable as connected (`/api/social/instagram/status` returns `available: false`). Selecting Instagram never calls the Facebook publish endpoint.
- Facebook video publishing is blocked in the UI (photo endpoint only).
- Existing `/api/facebook/posts/create` still uses Ads Meta integration and may lack `pages_manage_posts`.

## Generated Contents UX

- Nav: **Generated Contents** → `/generated-contents` (legacy `/image-library` kept).
- Library API: `GET /api/generated-contents/list` (owner-scoped + publish status from `social_posts`).
- Auto-record: poster storage + `save-poster` + video uploads when `userId` is available.
