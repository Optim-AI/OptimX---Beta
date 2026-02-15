# API Reference

Complete reference for all SkalX AI API endpoints.

---

## Authentication Endpoints

### Google Ads Integration
- `GET /api/auth/google-ads/auth` - Initiate OAuth flow
- `GET /api/auth/google-ads/callback` - Handle OAuth callback
- `GET /api/auth/google-ads/profile` - Fetch user profile
- `GET /api/auth/google-ads/clientAccounts` - List available ad accounts
- `POST /api/auth/google-ads/runCampaign` - Execute advertising campaign

### Meta Integration (New Architecture)
- `GET /api/meta/oauth/start` - Initiate Meta OAuth flow  
- `GET /api/meta/oauth/callback` - Handle OAuth callback
- `GET /api/meta/integration/status` - Check connection status
- `GET /api/meta/integration/me` - Get account details
- `GET /api/meta/ads/campaigns` - List ad campaigns
- `GET /api/meta/ads/adsets` - List ad sets
- `GET /api/meta/ads/ads` - List ads
- `GET /api/meta/ads/insights` - Get ad insights
- `GET /api/meta/ads/leads` - Retrieve leads

### Instagram Endpoints
- `POST /api/instagram/posts/create` - Create Instagram post
- `GET /api/instagram/posts/list` - List Instagram posts
- `GET /api/instagram/posts/[id]` - Get single post
- `GET /api/instagram/posts/[id]/comments` - Get post comments
- `POST /api/instagram/posts/[id]/comments` - Reply to comment

### Facebook Endpoints
- `POST /api/facebook/posts/create` - Create Facebook Page post
- `GET /api/facebook/posts/list` - List Facebook posts
- `GET /api/facebook/posts/[id]` - Get single post
- `DELETE /api/facebook/posts/[id]` - Delete post
- `GET /api/facebook/posts/[id]/comments` - Get post comments
- `POST /api/facebook/posts/[id]/comments` - Reply to comment

---

## Integration Management

- `GET /api/integrations/status` - Get connected platforms (user-scoped)
- `GET /api/integrations/get` - Fetch integration details and tokens
- `POST /api/integrations/disconnect` - Remove platform connection
- `GET /api/integrations/metrics` - Platform performance metrics

---

## AI-Powered Endpoints (App Router)

- `POST /api/enhancePrompt` - Enhance user prompts with OpenAI
- `POST /api/generateCaption` - Generate AI-powered captions
- `POST /api/generate-campaign` - Create complete campaigns
- `POST /api/translate-prompt` - Multi-language translation

---

## Campaign & Content

- `POST /api/campaigns/*` - Campaign CRUD operations
- `POST /api/publicize` - Publish content to platforms
- `GET /api/recommendations` - AI-powered recommendations
- `POST /api/analyze` - Content analysis

---

## User Management

- `GET /api/chats/*` - Chat history and management
- `POST /api/credits/*` - Credit/billing operations

---

**See also:** [Architecture](./ARCHITECTURE.md) | [Database](./DATABASE.md) | [Development](./DEVELOPMENT.md)
