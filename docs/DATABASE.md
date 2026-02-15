# Database Schema

SkalX AI uses **Drizzle ORM** with **Supabase PostgreSQL** for all data persistence.

---

## Tech Stack

- **ORM:** Drizzle ORM (TypeScript-first, type-safe)
- **Database:** Supabase PostgreSQL
- **Local Development:** Supabase Local (`postgresql://postgres:postgres@localhost:54322/postgres`)
- **Migrations:** Managed via Drizzle Kit, output to `supabase/migrations/`
- **Schema Definition:** `database/schema.ts`

---

## Schema Overview

### Core Tables

#### `integrations`
Stores platform connection tokens and metadata for Meta, Google Ads, etc.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)` (Supabase Auth)
- `provider` - Platform name (meta, google-ads)
- `provider_user_id` - Platform-specific user ID
- `ad_account_id` - Ad account identifier
- `page_id` - Facebook page ID
- `ig_user_id` - Instagram business account ID
- `access_token` - Primary API access token
- `refresh_token` - Token refresh credential
- `token_expires_at` - Token expiration timestamp
- `health_status` - Token health (healthy, expires_soon, expired, revoked, invalid)
- `last_health_check` - Last health check timestamp
- `health_error_message` - User-friendly error message
- `page_name` - Facebook page name
- `page_category` - Facebook page category
- `all_pages` - All pages user has access to (JSONB)
- `raw` - Raw OAuth response (JSONB)
- `metadata` - Additional platform-specific data (JSONB)

**Indexes:**
- `user_id`, `provider`, `page_id`, `ig_user_id`, `health_status`, `last_health_check`
- Composite: `user_id + provider`

---

#### `oauth_sessions`
Temporary OAuth sessions for multi-step OAuth flows (10-minute expiration).

**Key Fields:**
- `id` - Session ID (text, primary key)
- `user_id` - References `auth.users(id)`
- `provider` - Platform (meta, google-ads)
- `data` - Session data (JSONB)
- `expires_at` - Expiration timestamp
- `created_at` - Creation timestamp

**Indexes:**
- `user_id`, `provider`, `expires_at`

---

#### `app_settings`
Global and per-user configuration flags.

**Key Fields:**
- `id` - Primary key (text)
- `key` - Setting name (unique)
- `value` - Setting value (JSONB)
- `created_at`, `updated_at`

**Indexes:**
- Unique index on `key`

---

#### `profiles`
User profile data (extends Supabase Auth users).

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)` (unique)
- `data` - Profile data (JSONB)
- `created_at`, `updated_at`

---

#### `campaigns`
Marketing campaign drafts and published campaigns.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)`
- `name` - Campaign name
- `status` - Campaign status (draft, published, etc.)
- `data` - Campaign configuration (JSONB)
- `created_at`, `updated_at`

**Indexes:**
- `user_id`, `status`

---

#### `recommendations`
AI-generated campaign recommendations.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)`
- `campaign_id` - References `campaigns(id)` (nullable)
- `type` - Recommendation type
- `title`, `description`
- `data` - Recommendation details (JSONB)
- `status` - Status (pending, applied, dismissed)
- `created_at`, `updated_at`

**Indexes:**
- `user_id`, `campaign_id`, `status`

---

#### `user_credits`
Credit balance for each user.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)` (unique)
- `credits` - Credit balance (integer, default 0)
- `created_at`, `updated_at`

**Indexes:**
- Unique index on `user_id`

---

#### `user_chats`
Chat history with AI assistant.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)`
- `role` - Message role (user, assistant, system)
- `message` - Message content (text)
- `metadata` - Additional data (JSONB)
- `created_at`

**Indexes:**
- `user_id`, `created_at`

---

#### `user_generated_image`
AI-generated images for campaigns.

**Key Fields:**
- `id` - Primary key (text)
- `user_id` - References `auth.users(id)`
- `image_url` - Public URL
- `image_path` - Storage path (nullable)
- `created_at`

**Indexes:**
- `user_id`, `created_at`

---

#### `google_ads_tokens`
Google Ads OAuth tokens (separate from main integrations table).

**Key Fields:**
- `user_id` - Primary key, references `auth.users(id)`
- `refresh_token`, `access_token`
- `token_expires_at`
- `scope`
- `created_at`, `updated_at`

---

#### `integration_status`
Legacy table for global integration status flags.

**Key Fields:**
- `provider` - Primary key (text)
- `is_active` - Boolean flag
- `updated_at`

---

## Database Access Layer

### Schema Definition
**File:** `database/schema.ts`

All tables are defined using Drizzle ORM's schema builder:

```typescript
export const integrations = pgTable("integrations", {
  id: text().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  provider: text().notNull(),
  // ... other fields
}, (table) => [
  index("integrations_user_id_idx").using("btree", table.userId...),
  // ... other indexes
]);
```

### Data Access Objects (DAOs)
**Location:** `database/models/`

Each table has a corresponding DAO class:

- `IntegrationDAO.ts` - CRUD operations for integrations
- `OAuthSessionDAO.ts` - OAuth session management
- `CampaignDAO.ts` - Campaign operations
- `RecommendationDAO.ts` - Recommendation operations
- `SettingsDAO.ts` - Settings management
- `ProfileDAO.ts` - Profile operations

**Example Usage:**
```typescript
import { IntegrationDAO } from '@/database';

// Upsert integration
await IntegrationDAO.upsert({
  userId: 'user-123',
  provider: 'meta',
  accessToken: 'token...',
  healthStatus: 'healthy',
  // ... other fields
});

// Find by user and provider
const integration = await IntegrationDAO.findByUserAndProvider('user-123', 'meta');
```

---

## Migration Management

### Migration Workflow

1. **Update Schema:** Edit `database/schema.ts`
2. **Generate Migration:** `npm run db:generate` (outputs to `supabase/migrations/`)
3. **Apply Locally:** `supabase db reset` or `drizzle-kit push`
4. **Deploy to Production:** `supabase db push`

### Migration Files Location
`supabase/migrations/` (managed by Drizzle Kit)

**Current Migrations:**
- `20241224000000_initial_schema.sql` - Initial database schema
- `20251226103540_remove_public_users.sql` - Removed public.users table (using auth.users)
- Future migrations generated via `npm run db:generate`

### Configuration
**File:** `drizzle.config.ts`

```typescript
export default defineConfig({
  schema: "./database/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
```

---

## Row Level Security (RLS)

All tables enforce RLS policies to ensure users can only access their own data.

**Example Policies (managed in Supabase):**

```sql
-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own integrations
CREATE POLICY "Users can view own integrations"
  ON integrations FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own integrations"
  ON integrations FOR DELETE
  USING (auth.uid()::text = user_id);
```

**Note:** Similar policies exist for all user-scoped tables (campaigns, profiles, chats, etc.)

---

## Local Development

### Supabase Local Setup

**Start Database:**
```bash
supabase start
```

**Database URL:**
```
postgresql://postgres:postgres@localhost:54322/postgres
```

**Access Supabase Studio:**
```
http://localhost:54323
```

**Reset Database (Re-run Migrations):**
```bash
supabase db reset
```

---

## Useful Commands

### Database Operations
```bash
# Generate migration from schema changes
npm run db:generate

# Push schema changes to database (without migration file)
drizzle-kit push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Supabase Commands
```bash
# Start Supabase services
supabase start

# Stop Supabase
supabase stop

# Check status
supabase status

# Reset database & re-run migrations
supabase db reset
```

---

## Type Safety

Drizzle ORM provides full TypeScript type inference:

```typescript
import { integrations } from '@/database/schema';
import type { Integration } from '@/database/schema';

// Type-safe insert
type IntegrationInsert = typeof integrations.$inferInsert;

// Type-safe select
type IntegrationSelect = typeof integrations.$inferSelect;

// Fully typed queries
const result = await db.select().from(integrations).where(eq(integrations.userId, userId));
// result is automatically typed as Integration[]
```

---

## Production Deployment

1. Create Supabase project at https://app.supabase.com
2. Get connection string from Project Settings > Database
3. Update `DATABASE_URL` in production environment
4. Run migrations: `supabase db push` or apply migration files manually

---

**See also:**
- [Supabase Local Setup](./SUPABASE_LOCAL_SETUP.md) - Complete setup guide
- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [API Reference](./API_REFERENCE.md) - API endpoint documentation
- [Development](./DEVELOPMENT.md) - Development workflow
