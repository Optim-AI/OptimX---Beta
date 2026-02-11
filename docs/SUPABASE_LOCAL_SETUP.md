# Supabase Local Development Setup

This guide explains how to set up local development using Supabase for PostgreSQL and authentication, with Drizzle ORM for database queries.

## 🚀 Quick Start (TL;DR)

```bash
# 1. One command to start everything
./scripts/dev.sh

# That's it! This will:
# - Check Docker is running
# - Start Supabase if needed
# - Start Next.js dev server
```

**All services will be running:**
- Next.js: http://localhost:3000
- Supabase Studio: http://localhost:54323
- PostgreSQL: localhost:54322

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local Development Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Next.js App    │    │   Drizzle ORM    │                   │
│  │   (Port 3000)    │───▶│   (Type-safe)    │                   │
│  └──────────────────┘    └────────┬─────────┘                   │
│                                   │                              │
│                                   ▼                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Supabase Local Dev Stack                     │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ │   │
│  │  │  Postgres  │ │    Auth    │ │  Storage   │ │ Studio │ │   │
│  │  │ Port 54322 │ │ Port 54321 │ │ Port 54321 │ │  54323 │ │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**All services are handled by Supabase** - no additional Docker containers needed!

## Prerequisites

1. **Docker** (running)
2. **Supabase CLI**

```bash
# Install via Homebrew (macOS)
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase

# Verify installation
supabase --version
```

## Migrate all Supabase to local (one command)

To start the local Supabase stack and apply **all** migrations (schema + seed) in one go:

```bash
npm run supabase:migrate-local
```

Or run the script directly:

```bash
chmod +x ./scripts/migrate-supabase-to-local.sh
./scripts/migrate-supabase-to-local.sh
```

This will:
1. Ensure Docker and Supabase CLI are available
2. Start local Supabase (Postgres, Auth, Storage, Studio)
3. Run `supabase db reset` so every migration in `supabase/migrations/` is applied and `seed.sql` runs

Your `.env.local` should already point to local (e.g. `SUPABASE_URL=http://localhost:54321`, `DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres`).

### Pull from a remote Supabase project into local (optional)

If you have a **hosted** Supabase project and want to copy its schema (or data) to local:

1. Link the project (one-time):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Get `YOUR_PROJECT_REF` from the project URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`.

2. Pull remote schema as a new migration:
   ```bash
   supabase db pull
   ```
   Then apply it locally: `supabase db reset`.

3. To copy **data** from remote to local, use `pg_dump` from the remote DB and `psql` into local, or use the Supabase dashboard to export/import.

## Quick Start

### 1. Start Supabase Local Stack

```bash
# From project root
supabase start
```

This spins up Docker containers for:
- **Postgres** (Port 54322)
- **Auth/GoTrue** (Port 54321)
- **Studio** (Port 54323)
- **Realtime**
- **Storage**

You'll see output like:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
anon key: eyJ...
service_role key: eyJ...
```

### 2. Apply Database Migrations

```bash
# Reset database and apply all migrations
supabase db reset
```

This:
- Drops the local database
- Re-applies all migrations from `supabase/migrations/`
- Runs `supabase/seed.sql` for test data

### 3. Configure Environment Variables

Create `.env.local` from the example:

```bash
# Copy example file
cp .env.example .env.local
```

Get your Supabase local keys:
```bash
supabase status
```

Update `.env.local`:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Supabase (from `supabase status` output)
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key-from-supabase-status>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key-from-supabase-status>"
```

### 4. Start Next.js Development Server

```bash
npm run dev
```

## Important URLs

| Service | URL | Description |
|---------|-----|-------------|
| Next.js App | http://localhost:3000 | Your application |
| Supabase Studio | http://localhost:54323 | Database GUI, Auth, Storage management |
| Supabase API | http://localhost:54321 | REST/GraphQL API |
| Storage API | http://localhost:54321/storage/v1 | File storage API |
| PostgreSQL | localhost:54322 | Direct DB connection |
| Inbucket (Email) | http://localhost:54324 | Email testing UI |

## Working with Drizzle ORM

### Database Schema

The schema is defined in `database/schema.ts`. Drizzle provides full type safety.

### Generate Migrations

When you modify the schema:

```bash
# Generate migration from schema changes
npx drizzle-kit generate
```

This creates a new migration file in `supabase/migrations/`.

### Push Schema (Development Only)

For quick iteration without migration files:

```bash
npx drizzle-kit push
```

⚠️ Use `generate` for trackable, production-safe changes.

### Apply Migrations

```bash
# Apply via Supabase (recommended for local dev)
supabase db reset

# Or apply specific migration
supabase db push
```

## Supabase Auth + Drizzle Pattern

Supabase handles authentication (`auth.users`). A trigger syncs new users to your `public.users` table:

```sql
-- Automatically included in migrations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id::text, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Workflow:**
- Supabase Auth → manages authentication
- Drizzle → queries your business data
- Trigger → keeps `public.users` in sync with `auth.users`

## Testing Auth Locally

### Via Supabase Studio
1. Go to http://localhost:54323
2. Navigate to **Authentication** → **Users**
3. Click **Add User**

### Via Code
```typescript
import { supabase } from '@/auth/supabase/client';

await supabase.auth.signUp({
  email: "test@example.com",
  password: "password123"
});
```

## Common Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Check status
supabase status

# Reset database (apply all migrations + seed)
supabase db reset

# View logs
supabase logs

# Generate Drizzle migration
npx drizzle-kit generate

# Open Drizzle Studio (alternative to Supabase Studio)
npx drizzle-kit studio
```

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Stop all Supabase containers
supabase stop

# Or stop Docker containers manually
docker ps
docker stop <container-id>
```

### Database Connection Issues

1. Verify Supabase is running: `supabase status`
2. Check `DATABASE_URL` in `.env.local`
3. Ensure port 54322 is accessible

### Reset Everything

```bash
# Nuclear option - stop and remove all data
supabase stop --no-backup
supabase start
supabase db reset
```

### Migration Errors

If migrations fail:

```bash
# Check migration SQL
cat supabase/migrations/*.sql

# Reset and try again
supabase db reset
```

## Production Deployment

For production:

1. Create a Supabase project at https://supabase.com
2. Get connection string from Project Settings → Database
3. Update production environment variables:

```env
DATABASE_URL="postgres://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[PRODUCTION_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[PRODUCTION_SERVICE_ROLE_KEY]"
```

4. Apply migrations to production:
```bash
supabase link --project-ref [PROJECT_REF]
supabase db push
```

## Storage

Supabase Storage is configured with two buckets (defined in `supabase/config.toml`):

| Bucket | Public | Max Size | Allowed Types |
|--------|--------|----------|---------------|
| `campaign-assets` | ✓ | 10MB | images, videos |
| `user-uploads` | ✓ | 50MB | images, videos, PDFs |

### Using Storage in Code

```typescript
import { storageClient, BUCKETS } from '@/lib/storage/client';

// Upload a file
const { data, error } = await storageClient.upload(
  BUCKETS.CAMPAIGN_ASSETS,
  'campaigns/user123/hero.png',
  file,
  { contentType: 'image/png' }
);

// Get public URL
const url = storageClient.getPublicUrl(BUCKETS.CAMPAIGN_ASSETS, 'campaigns/user123/hero.png');

// Delete a file
await storageClient.delete(BUCKETS.USER_UPLOADS, 'path/to/file.pdf');
```

### Managing Storage in Studio

1. Go to http://localhost:54323
2. Navigate to **Storage** in the sidebar
3. Browse, upload, and manage files in your buckets

## File Structure

```
supabase/
├── config.toml          # Supabase local config (includes storage buckets)
├── migrations/
│   └── 20241224000000_initial_schema.sql
└── seed.sql             # Test data for local dev

database/
├── client.ts            # Drizzle client (uses pg Pool)
├── schema.ts            # Drizzle schema definitions
└── models/              # Data Access Objects (DAOs)

lib/storage/
└── client.ts            # Supabase Storage client wrapper

drizzle.config.ts        # Drizzle Kit configuration
```

