# Meta OAuth Redesign - Implementation Guide

**Date:** December 24, 2024
**Status:** ✅ Implementation Complete
**Version:** 2.0

---

## Overview

The Meta OAuth flow has been redesigned to support **page selection**, **graceful error handling**, and **page-level architecture**. Users can now:

1. Select which Facebook Page to connect (instead of auto-selecting the first one)
2. See helpful error pages when issues occur
3. Experience auto-closing windows with 15-second timers
4. Understand what went wrong and how to fix it

---

## What Changed

### Before (Old Flow)
```
User clicks "Connect Meta"
  ↓
Facebook OAuth
  ↓
Callback auto-selects FIRST page
  ↓
Saves integration immediately
  ↓
Shows success page
```

**Problems:**
- No choice for users with multiple pages
- Poor error handling (generic JSON errors)
- Hard failure if user has no pages

### After (New Flow)
```
User clicks "Connect Meta"
  ↓
Facebook OAuth
  ↓
Callback fetches ALL pages
  ↓
IF no pages → Helpful error page with creation guide
IF pages exist → Page selection UI
  ↓
User selects ONE page
  ↓
Finalize endpoint saves integration
  ↓
Redirect to integrations with success message
```

**Benefits:**
- Users choose which page to connect
- Graceful error handling with helpful guidance
- Auto-closing windows (15s timer)
- Better UX for multi-page users

---

## Files Created/Modified

### New Files Created

**Backend:**
- `lib/meta/oauthSession.ts` - Session management for OAuth flow
- `pages/api/meta/oauth/session.ts` - API to retrieve OAuth session
- `pages/api/meta/oauth/finalize.ts` - API to complete integration

**Frontend:**
- `components/OAuthResultPage.tsx` - Shared component for result pages
- `pages/integrations/meta/select-page.tsx` - Page selection UI
- `pages/integrations/meta/no-pages.tsx` - Error: no pages found
- `pages/integrations/meta/cancelled.tsx` - Error: user cancelled OAuth
- `pages/integrations/meta/error.tsx` - Generic error handler

**Database:**
- `docs/migrations/oauth_sessions.sql` - SQL migration for oauth_sessions table

### Modified Files

**Backend:**
- `pages/api/meta/oauth/callback.ts`
  - Added OAuth cancellation handling
  - Fetch pages with extended fields
  - Store temporary session instead of saving immediately
  - Redirect to appropriate page (selection or error)

---

## Setup Instructions

### Step 1: Run Database Migration

You need to create the `oauth_sessions` table in Supabase.

**Option A: Via Supabase Dashboard**
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy the contents of `docs/migrations/oauth_sessions.sql`
4. Execute the SQL

**Option B: Via Supabase CLI**
```bash
supabase db push
```

**What the migration does:**
- Creates `oauth_sessions` table
- Adds indexes for performance
- Adds metadata columns to `integrations` table:
  - `page_name` (TEXT)
  - `page_category` (TEXT)
  - `all_pages` (JSONB)

### Step 2: Verify Environment Variables

Ensure these are set in `.env.local`:

```env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_API_VERSION=23.0
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

### Step 3: Update OAuth Redirect URI in Facebook App

1. Go to https://developers.facebook.com/apps
2. Select your app
3. Go to **Facebook Login** > **Settings**
4. Add redirect URI: `http://localhost:3000/api/meta/oauth/callback`
5. For production: `https://yourdomain.com/api/meta/oauth/callback`

### Step 4: Test the Flow

**Test Case 1: Happy Path (User with Multiple Pages)**
1. Start development server: `npm run dev`
2. Navigate to integrations page
3. Click "Connect Meta"
4. Authorize on Facebook
5. Should see page selection UI with all your pages
6. Select a page
7. Should redirect to `/integrations?connected=meta&status=success`

**Test Case 2: User with No Pages**
1. Use a Facebook account with no pages
2. Click "Connect Meta"
3. Authorize on Facebook
4. Should see "No Facebook Pages Found" error page
5. See helpful instructions to create a page
6. See 15-second auto-close timer
7. Click "Create Page Now" or wait for auto-close

**Test Case 3: User Cancels OAuth**
1. Click "Connect Meta"
2. Click "Cancel" on Facebook authorization screen
3. Should see "Connection Cancelled" error page
4. See explanation of why permissions are needed
5. See 15-second auto-close timer

**Test Case 4: Session Expiry**
1. Start OAuth flow
2. Get to page selection
3. Wait 11 minutes (session expires after 10 min)
4. Try to select a page
5. Should see "Session Expired" error

---

## Architecture Details

### Session Flow

**1. OAuth Callback (pages/api/meta/oauth/callback.ts)**
```typescript
// Fetches pages from Facebook
const pagesResp = await fetch(
  `https://graph.facebook.com/v${VERSION}/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account&access_token=${userAccessToken}`
);

// Stores temporary session (10 min TTL)
const sessionId = await storeOAuthSession(userId, {
  userAccessToken,
  pages: pagesJson.data,
  adAccounts: adAccountsJson.data,
});

// Redirects to selection page
return res.redirect(`/integrations/meta/select-page?sessionId=${sessionId}`);
```

**2. Page Selection (pages/integrations/meta/select-page.tsx)**
```typescript
// Fetches session data
const session = await fetch(`/api/meta/oauth/session?sessionId=${sessionId}`);

// User selects a page
const handleSelectPage = async (pageId) => {
  await fetch('/api/meta/oauth/finalize', {
    method: 'POST',
    body: JSON.stringify({ sessionId, pageId }),
  });
};
```

**3. Finalize (pages/api/meta/oauth/finalize.ts)**
```typescript
// Retrieves session
const session = await getOAuthSession(sessionId);

// Finds selected page
const selectedPage = session.pages.find(p => p.id === pageId);

// Fetches Instagram account for that page
const igResp = await fetch(`/.../instagram_business_account`);

// Saves integration with page-level data
await saveIntegration({
  userAccessToken,
  pageAccessToken: selectedPage.access_token,
  pageId: selectedPage.id,
  pageName: selectedPage.name,
  pageCategory: selectedPage.category,
  igUserId,
  adAccountId,
  allPages: session.pages, // All pages for future switching
});

// Cleans up session
await clearOAuthSession(sessionId);
```

### Data Model

**OAuth Session (Temporary - 10 min TTL)**
```typescript
{
  id: "oauth_meta_userId_timestamp_random",
  user_id: "uuid",
  provider: "meta",
  data: {
    userId: "uuid",
    userAccessToken: "EAAx...",
    pages: [
      {
        id: "123456",
        name: "My Business Page",
        category: "Business",
        access_token: "EAAy...",
        tasks: ["MANAGE", "CREATE_CONTENT"],
        instagram_business_account: { id: "789" }
      }
    ],
    adAccounts: [...],
    expiresAt: "2024-12-24T12:00:00Z"
  },
  expires_at: "2024-12-24T12:00:00Z"
}
```

**Integration (Permanent)**
```typescript
{
  provider: "meta",
  userId: "uuid",
  credentials: {
    userAccessToken: "EAAx...",
    pageAccessToken: "EAAy...",
    pageId: "123456",
    pageName: "My Business Page",
    pageCategory: "Business",
    igUserId: "789",
    adAccountId: "456",
    allPages: [...], // All available pages for future switching
  },
  createdAt: "2024-12-24T11:00:00Z"
}
```

---

## Error Handling

### Error Types

| Error | Redirect | Auto-Close |
|-------|----------|------------|
| No pages found | `/integrations/meta/no-pages` | 15s |
| User cancels OAuth | `/integrations/meta/cancelled?reason=...` | 15s |
| Pages fetch failed | `/integrations/meta/error?type=pages_fetch_failed` | 15s |
| Session expired | `/integrations/meta/error?type=session_expired` | 15s |
| Token exchange failed | `/integrations/meta/error?type=token_exchange_failed` | 15s |
| Generic error | `/integrations/meta/error?type=callback_error&stage=...` | 15s |

### Auto-Close Behavior

All error pages use the `OAuthResultPage` component which:
1. Starts 15-second countdown timer
2. Displays countdown to user
3. Attempts to send postMessage to parent window (if popup)
4. Attempts `window.close()` (if popup)
5. Falls back to redirect if close fails

**User can:**
- Click "Close Window" / "Continue" to trigger immediately
- Wait for auto-close
- Use browser back button

---

## Testing Checklist

### Manual Tests

- [ ] **Happy path**: User with 2+ pages can select one
- [ ] **Single page**: User with 1 page sees selection UI
- [ ] **No pages**: Shows helpful error with creation guide
- [ ] **OAuth cancelled**: Shows permissions explanation
- [ ] **Session expires**: Handles gracefully after 10 minutes
- [ ] **Page without Instagram**: Shows warning but allows connection
- [ ] **Page without MANAGE permission**: Disables selection
- [ ] **Auto-close timer**: Counts down from 15 to 0
- [ ] **Popup window**: Closes automatically
- [ ] **Regular tab**: Redirects after timeout
- [ ] **Manual close**: Button works immediately

### Security Tests

- [ ] Session IDs are random and unpredictable
- [ ] Sessions expire after 10 minutes
- [ ] Cannot access another user's session
- [ ] Access tokens not exposed in URLs
- [ ] CSRF protection on finalize endpoint

### Edge Cases

- [ ] User has 50+ pages (test pagination/performance)
- [ ] Page name with special characters
- [ ] Network error during selection
- [ ] Concurrent OAuth attempts
- [ ] Browser back button during flow
- [ ] Session deleted while on selection page

---

## Future Enhancements

### Phase 2 Features (Optional)

1. **Multi-Page Selection**
   - Allow connecting multiple pages at once
   - Checkbox selection instead of single choice
   - Save multiple integrations per user

2. **Page Switching**
   - UI in settings to switch between connected pages
   - Re-use stored `allPages` data
   - No need to re-authenticate

3. **Real-Time Instagram Check**
   - Check Instagram connection status in real-time
   - Provide link to connect Instagram to page
   - Show Instagram username/handle

4. **Ad Account Selection**
   - Separate selection for ad accounts
   - Allow multiple ad accounts
   - Map ad accounts to pages

5. **Page Metadata Display**
   - Show follower count
   - Show verification status
   - Show page insights preview

---

## Troubleshooting

### Issue: "Session not found or expired"

**Cause:** Session TTL is 10 minutes. User took too long on selection page.

**Solution:**
- Increase TTL in `storeOAuthSession()` (currently 10 min)
- Or show warning when session < 2 min remaining

### Issue: "Page avatar not loading"

**Cause:** Graph API rate limits or page privacy settings.

**Solution:**
- Fallback avatar already implemented in `PageCard`
- Shows gray "?" icon if image fails to load

### Issue: "Window won't close"

**Cause:** Browser blocks `window.close()` for non-popup windows.

**Solution:**
- Already handled with fallback redirect
- User sees "Redirecting in X seconds" message

### Issue: oauth_sessions table doesn't exist

**Cause:** Migration not run.

**Solution:**
```bash
# Run the SQL migration manually
psql $DATABASE_URL < docs/migrations/oauth_sessions.sql

# Or via Supabase dashboard SQL editor
```

### Issue: "Cannot connect Instagram features"

**Cause:** Selected page has no Instagram Business account linked.

**Solution:**
- This is expected and handled gracefully
- User sees warning: "Instagram features will be unavailable"
- Page can still be connected for Facebook posting
- Guide user to connect Instagram at facebook.com/pages

---

## API Reference

### GET /api/meta/oauth/session

Retrieve temporary OAuth session data.

**Query Parameters:**
- `sessionId` (required): Session ID from redirect URL

**Response:**
```json
{
  "pages": [
    {
      "id": "123456",
      "name": "My Page",
      "category": "Business",
      "tasks": ["MANAGE"],
      "instagram_business_account": { "id": "789" }
    }
  ],
  "expiresAt": "2024-12-24T12:00:00Z"
}
```

**Errors:**
- 400: Missing sessionId
- 404: Session not found or expired

---

### POST /api/meta/oauth/finalize

Complete integration by saving selected page.

**Body:**
```json
{
  "sessionId": "oauth_meta_...",
  "pageId": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "integration": {
    "pageId": "123456",
    "pageName": "My Page",
    "pageCategory": "Business",
    "hasInstagram": true,
    "hasAds": false
  }
}
```

**Errors:**
- 400: Missing parameters
- 400: Session expired
- 400: Page not found in session
- 500: Failed to save integration

---

## Support

For questions or issues:
- **Email:** tech.optimx@gmail.com
- **Docs:** `/docs/META_PERMISSIONS_GUIDE.md`
- **Debug Mode:** Set `DEBUG_CALLBACK=true` in `.env.local`

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Production Ready:** After testing

