# Facebook Token Management - Implementation Status

## Overview
This document tracks the implementation of comprehensive Facebook token lifecycle management with automatic refresh, health checks, and error handling - all without cron jobs.

## ✅ Completed (Phase 1-3)

### Core Infrastructure
1. ✅ **Retry Utility** (`integrations/meta/retry.ts`)
   - Exponential backoff with 3 retries (1s, 5s, 30s delays)
   - Handles transient network errors
   - Reusable across all Facebook API calls

2. ✅ **Token Refresh Logic** (`integrations/meta/token-refresh.ts`)
   - `refreshFacebookToken()` - Exchange old token for new 60-day token
   - `ensureValidToken()` - Auto-refresh if expires within 7 days
   - `detectTokenError()` - Classify Facebook API errors (expired, revoked, invalid, etc.)
   - Custom `TokenError` class for user-facing errors

3. ✅ **Health Check Service** (`integrations/meta/health.ts`)
   - `checkIntegrationHealth()` - Validate token via Facebook API
   - `shouldCheckHealth()` - Determine if check needed (>6h or expires soon)
   - `getHealthStatus()` - Calculate status from expiration date
   - `updateIntegrationHealth()` - Update database with health status
   - `updateIntegrationHealthInBackground()` - Fire-and-forget updates

### Database
4. ✅ **Migration** (`drizzle/migrations/0001_add_integration_health.sql`)
   - Added `health_status` column (healthy, expires_soon, expired, revoked, invalid)
   - Added `last_health_check` column (timestamp)
   - Added `health_error_message` column (user-friendly error)
   - Created indexes for efficient queries
   - **Already executed on local database**

5. ✅ **Schema Update** (`database/schema.ts`)
   - Updated `integrations` table schema with health fields
   - Added indexes for health_status and last_health_check

6. ✅ **IntegrationDAO Updates** (`database/models/Integration.dao.ts`)
   - `update()` - Partial update method
   - `updateHealth()` - Update health status
   - `updateTokens()` - Update tokens and reset health to healthy
   - `upsert()` - Now accepts health fields

### OAuth Flow
7. ✅ **OAuth Callback** (`pages/api/meta/oauth/callback.ts`)
   - Calculates token expiration (60 days from now)
   - Passes `tokenExpiresAt` to session storage

8. ✅ **OAuth Finalize** (`pages/api/meta/oauth/finalize.ts`)
   - Saves `tokenExpiresAt` when creating integration
   - Sets `healthStatus = 'healthy'`
   - Sets `lastHealthCheck = now`

9. ✅ **OAuth Session** (`integrations/meta/oauth-session.ts`)
   - Updated interface to include `tokenExpiresAt`
   - Stores token expiration in temporary session

10. ✅ **Integration Store** (`integrations/store.ts`)
    - `saveIntegration()` now accepts health fields
    - Passes health data to IntegrationDAO

### API Integration
11. ✅ **getMetaIntegration with Auto-Refresh** (`integrations/meta/auth.ts`)
    - Checks if integration is unhealthy → throws TokenError
    - Runs health check if needed (>6h or expires soon)
    - Auto-refreshes token if expires within 7 days
    - Returns updated integration with health status
    - Custom TokenError class for reconnection prompts

12. ✅ **Dashboard Health Check API** (`pages/api/dashboard/health-check.ts`)
    - Called when user lands on dashboard
    - Checks integration health
    - Attempts proactive token refresh if expires soon
    - Returns health status for UI

---

## 🚧 Remaining Work (Phase 4-6)

### API Updates
13. ⏳ **Update Integration Status API** (`pages/api/integrations/status.ts`)
    - Add health fields to response
    - Return `healthStatus`, `tokenExpiresAt`, `healthMessage`, `needsReconnect`

14. ⏳ **Wrap Facebook API Endpoints with Error Handling**
    - Sample endpoint pattern created
    - Need to apply to ~15 endpoints:
      - `pages/api/facebook/posts/create.ts`
      - `pages/api/facebook/posts/list.ts`
      - `pages/api/instagram/posts/create.ts`
      - `pages/api/instagram/posts/list.ts`
      - `pages/api/meta/ads/*.ts`
      - etc.
    - Pattern: Try-catch around API calls, detect token errors, update health in background

### Frontend Updates
15. ⏳ **Dashboard UI** (`pages/dashboard.tsx`)
    - Call `/api/dashboard/health-check` on mount
    - Show reconnect banner if `needsReconnect = true`
    - Display health status warnings

16. ⏳ **Integrations Page UI** (`pages/integrations.tsx`)
    - Show health status badges on integration cards
    - Display reconnect button for unhealthy integrations
    - Show token expiration warnings

17. ⏳ **Integration Store readSavedIntegration** (`integrations/store.ts`)
    - Include health fields in returned integration object
    - Map `healthStatus`, `healthMessage`, `tokenExpiresAt`, `lastHealthCheck`

### Cleanup
18. ⏳ **Remove Debug Logging**
    - Clean up temporary logging from OAuth session fix
    - Files to clean:
      - `pages/api/meta/oauth/callback.ts`
      - `pages/api/meta/oauth/session.ts`
      - `integrations/meta/oauth-session.ts`
      - `database/models/OAuthSession.dao.ts`

---

## 📋 Implementation Checklist for Remaining Work

### Quick Wins (Do First)
- [ ] Update `readSavedIntegration()` to include health fields
- [ ] Update `/api/integrations/status` endpoint
- [ ] Clean up debug logging

### Medium Priority
- [ ] Wrap 2-3 sample Facebook API endpoints with error handling pattern
- [ ] Add reconnect banner to dashboard
- [ ] Update integrations page to show health status

### Nice to Have
- [ ] Apply error handling pattern to all ~15 Facebook API endpoints
- [ ] Add token expiration countdown UI
- [ ] Add health check indicator in header/nav

---

## 🧪 Testing Plan

### Manual Testing Scenarios
1. **Fresh Connection**
   - Connect Facebook account
   - Verify `tokenExpiresAt` is 60 days from now
   - Verify `healthStatus = 'healthy'`

2. **Token Expires Soon (Mock)**
   - Manually set `tokenExpiresAt` to 3 days from now
   - Visit dashboard → should auto-refresh token
   - Verify new `tokenExpiresAt` is 60 days from now

3. **Token Expired (Mock)**
   - Set `tokenExpiresAt` to yesterday
   - Visit dashboard → should show reconnect banner
   - Try creating post → should return 401 with reconnect message

4. **Token Revoked**
   - Revoke app access in Facebook settings
   - Try creating post → should detect error 190
   - Should mark integration as 'revoked'
   - Dashboard should show reconnect banner

5. **Page Access Lost**
   - Remove user as page admin (external)
   - Try posting → should detect error 10
   - Should mark integration as 'invalid'
   - Should show appropriate error message

---

## 🔧 Configuration

### Environment Variables Required
```bash
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_API_VERSION=23.0  # or latest
```

### Database
- Migration already applied to local Supabase
- For production, run: `0001_add_integration_health.sql`

---

## 📚 Key Concepts

### Health Statuses
- **healthy** - Token valid, no issues
- **expires_soon** - Token expires within 7 days (auto-refresh triggered)
- **expired** - Token past expiration date (reconnect required)
- **revoked** - User revoked access (reconnect required)
- **invalid** - Page access lost or permission denied (reconnect required)

### Token Lifecycle
1. OAuth → Long-lived token (60 days)
2. Day 1-53: healthy
3. Day 54-60: expires_soon (auto-refresh on API call or dashboard visit)
4. After refresh: new 60-day token, back to healthy
5. Day 60+: expired (reconnect required)

### Health Check Triggers
- Dashboard page load (if >6h since last check)
- Any Facebook API call (if >6h since last check or expires soon)
- Manual refresh on integrations page

---

## 🎯 Next Steps

1. **Complete readSavedIntegration update** - Quick, unblocks UI work
2. **Test complete flow** - Verify auto-refresh works end-to-end
3. **Update 2-3 sample endpoints** - Establish pattern
4. **Add dashboard reconnect banner** - Critical UX
5. **Apply pattern to remaining endpoints** - Scale it out
6. **Clean up logging** - Polish

---

## 📖 Usage Examples

### For Developers - Wrapping API Endpoints

```typescript
// Before
export default async function handler(req, res) {
  const integration = await getMetaIntegration(req);
  const result = await createFacebookPost({ ...integration });
  return res.json(result);
}

// After
import { TokenError } from '@/integrations/meta/auth';
import { detectTokenError } from '@/integrations/meta/token-refresh';
import { updateIntegrationHealthInBackground } from '@/integrations/meta/health';

export default async function handler(req, res) {
  try {
    // Auto-checks health & refreshes token if needed
    const integration = await getMetaIntegration(req);
    const result = await createFacebookPost({ ...integration });
    return res.json(result);
  } catch (error: any) {
    // Handle token errors
    if (error instanceof TokenError) {
      // Update health in background (non-blocking)
      updateIntegrationHealthInBackground(
        userId,
        'meta',
        error.code,
        error.userMessage
      );

      return res.status(401).json({
        error: 'token_error',
        code: error.code,
        message: error.userMessage,
        needsReconnect: true,
      });
    }

    // Check if Facebook API error
    const tokenError = detectTokenError(error);
    if (tokenError.code !== 'error') {
      return res.status(401).json({
        error: 'token_error',
        code: tokenError.code,
        message: tokenError.message,
        needsReconnect: true,
      });
    }

    // Other errors
    return res.status(500).json({ error: error.message });
  }
}
```

---

## ✨ Benefits Achieved

✅ **No cron jobs** - All logic runs on-demand
✅ **Auto-refresh** - Tokens refreshed before expiration
✅ **Resilient** - Retry logic handles network issues
✅ **Clear UX** - Users know when reconnection needed
✅ **Serverless-ready** - No background processes
✅ **Error transparency** - Different errors handled distinctly
✅ **Performance** - Health checks only every 6 hours
✅ **Graceful degradation** - Transient failures don't break app

---

*Last Updated: 2026-01-04*
*Status: ~80% Complete - Core infrastructure done, UI updates remaining*
