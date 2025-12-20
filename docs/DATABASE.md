# Database Schema

OptimX uses Supabase (PostgreSQL) for production data, SQLite for local development, and IndexedDB for client-side storage.

---

## Supabase Tables

### `integrations`
Stores platform connection tokens and metadata.

```sql
CREATE TABLE integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  ad_account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users table |
| provider | text | Platform name (google-ads, meta) |
| provider_user_id | text | Platform-specific user ID |
| ad_account_id | text | Ad account identifier |
| access_token | text | Primary API access token |
| refresh_token | text | Token refresh credential |
| metadata | jsonb | Additional platform-specific data |

### `app_settings`
Global and per-user configuration flags.

```sql
CREATE TABLE app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);
```

### `campaigns`
Marketing campaign data.

```sql
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  content JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `chats`
Chat history and AI interactions.

```sql
CREATE TABLE chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Row Level Security (RLS)

Example policies for `integrations` table:

```sql
-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() = user_id);
```

---

## SQLite (Development)

Local databases for development:
- `data/db.sqlite` - Main SQLite database mirror
- `data/ads_tokens.db` - Google Ads token storage
- WAL (Write-Ahead Logging) enabled for performance

---

## IndexedDB (Client-Side)

**Database:** `optim-app-db`

**Stores:**
- `chats` - Chat messages for offline access
- `sync_queue` - Pending operations for server sync

---

**See also:** [Architecture](./ARCHITECTURE.md) | [API Reference](./API_REFERENCE.md) | [Development](./DEVELOPMENT.md)
