# Social Studio — Instagram (organic)

Instagram professional account publishing, comments, and engagement insights.
Separate from Meta Ads (`provider = meta`) and Facebook Page publishing (`provider = meta-publish`).
Instagram uses `provider = meta-instagram`.

## Capabilities

| Feature | Status |
|---|---|
| Connect IG Business/Creator linked to a Facebook Page | Implemented |
| Explicit account selection (never auto-picks first) | Implemented |
| Single-image feed publish (container → poll → publish) | Implemented |
| Video / Reels publish via `video_url` | Implemented (requires public HTTPS) |
| Stories / carousels | Not implemented |
| Comment list, reply, hide/unhide | Implemented (needs `instagram_manage_comments`) |
| Like counts + insights (reach/saved/etc.) | Read-only; unavailable ≠ zero |
| Liking/unliking media as an action | Not implemented (not required for this milestone) |
| Webhooks | Not implemented (polling via engagement UI) |

## Permissions (Facebook Login Instagram API)

SkalX uses **Instagram API with Facebook Login** via **Facebook Login for Business**:

- Authorization host: `www.facebook.com/.../dialog/oauth`
- Graph host: `graph.facebook.com`
- Permission names: `instagram_basic`, `instagram_content_publish`, …
- **Not** Instagram Login (`www.instagram.com/oauth/authorize` + `instagram_business_*`)

### Invalid Scopes error

If Meta shows `Invalid Scopes: instagram_basic, instagram_content_publish, …`, the OAuth request used classic `scope=` on an FLB app. FLB only grants permissions that are part of a saved Login Configuration when invoked with `config_id` (never also send `scope=`).

**Fix:** create / select the Instagram Login Configuration and set `FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID`. The app now refuses to start OAuth without that config ID (avoids the Invalid Scopes dialog).

### Dashboard setup

Create a **Facebook Login for Business** configuration (e.g. `SkalX Instagram`) with:

- `instagram_basic` (required)
- `instagram_content_publish` (required to publish)
- `pages_show_list` (required to discover Pages / linked IG)
- `pages_read_engagement` (documented dependency)
- `instagram_manage_comments` (comments)
- `instagram_manage_insights` (insights metrics)

Ensure those permissions are **available** for the app (App Dashboard → permissions / access level). Then set in `.env.local`:

```bash
FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID=your_instagram_flb_configuration_id
```

Restart Next.js after changing `.env.local`.

Do **not** reuse Ads (`FACEBOOK_LOGIN_CONFIG_ID`) or Facebook Publish (`FACEBOOK_PUBLISH_LOGIN_CONFIG_ID`) unless that config intentionally includes the Instagram scopes (not recommended).

Add Valid OAuth Redirect URI:

`{NEXT_PUBLIC_APP_URL}/api/social/instagram/oauth/callback`

App Review / Advanced Access is typically required for Live non-role users for Instagram permissions.

Do **not** switch to `instagram_business_*` unless you intentionally migrate the whole stack to Instagram Login (`graph.instagram.com`, different token exchange and discovery).

## Discovery & eligibility

After OAuth, SkalX lists Pages from `GET /me/accounts?fields=...,instagram_business_account`, then enriches each linked IG User:

```
GET https://graph.facebook.com/v{version}/{ig-user-id}?fields=id,username,profile_picture_url
```

Do **not** request `account_type` on this Facebook Login path — that field exists only for Instagram Login (`graph.instagram.com`) and returns `(#100) Tried accessing nonexistent field (account_type)`.

Professional eligibility comes from the Page ↔ `instagram_business_account` edge (Meta only returns it for Business/Creator accounts) plus Page access token and CREATE_CONTENT/MANAGE tasks. Selection is always explicit. Finalize persists **`igUserId`** (IG User), never the Facebook Page id, for publish/comments/insights.

## Media hosting (Instagram publish)

Instagram Graph `image_url` / `video_url` must be **public HTTPS** that Meta can fetch without cookies or auth headers. Localhost Supabase cannot be used.

SkalX resolves owned Generated Contents creatives server-side:

1. If the library URL is already public HTTPS → reuse it.
2. Otherwise download owned storage bytes and **mirror** to deterministic path  
   `instagram-publish/{userId}/{creativeId}.{ext}` on hosted public `campaign-assets`.
3. Re-publish of the same creative reuses the mirrored object (probe before upload).

### Environment

| Environment | Configuration |
|---|---|
| **Production** | `NEXT_PUBLIC_SUPABASE_URL=https://….supabase.co` + service role. Primary storage is the media host. |
| **Local** | Keep local Supabase for the app. Add a hosted destination: `INSTAGRAM_MEDIA_HOST_SUPABASE_URL` + `INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY`. Optional `INSTAGRAM_MEDIA_HOST_BUCKET` (default `campaign-assets`). |

Never set the media host to localhost. Facebook organic publishing still uses multipart for local assets and is unchanged.

## Isolation

- Tokens stored as `integrations.provider = meta-instagram`
- Does not overwrite `meta` (Ads) or `meta-publish` (Facebook organic)
- Ads OAuth scopes remain free of Instagram publish permissions
