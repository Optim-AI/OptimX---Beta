# How to Verify DATABASE_URL Matches Your Supabase Database

If profile queries fail with missing columns, your app may be connecting to a different database than the one where you ran migrations.

## Step 1: Find Your DATABASE_URL

Your app reads `DATABASE_URL` from `.env.local` (or `.env`).

```bash
# Print it (mask the password for safety)
grep DATABASE_URL .env.local
```

The format is:
```
postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```
or (direct connection):
```
postgresql://postgres:[PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

The **project-ref** (e.g. `abcdefghijklmnop`) or **host** tells you which Supabase project it uses.

## Step 2: Find Supabase Project Reference

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. In "Connection string" → "URI", you'll see the same format
5. The **host** or **project reference** must match what's in your `DATABASE_URL`

**Common mismatch:**
- You ran SQL in **Project A** (e.g. production)
- `DATABASE_URL` in `.env.local` points to **Project B** (e.g. staging or local)
- Or: Local Supabase (`supabase start`) uses `localhost` – that's a different DB entirely

## Step 3: Verify Same Database

### Option A: Run a test query in Supabase SQL Editor

In your Supabase project → **SQL Editor**, run:

```sql
SELECT current_database(), inet_server_addr();
```

Note the result (e.g. database name, IP).

### Option B: Add a temporary API route to log connection info

Create `pages/api/debug-db.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.DATABASE_URL || '';
  // Show host only (never log full URL with password)
  const match = url.match(/@([^\/]+)\//);
  const host = match ? match[1] : 'not set';
  res.json({
    host: host,
    hasUrl: !!url,
    hint: 'Compare this host with your Supabase project Settings → Database',
  });
}
```

Then visit `http://localhost:3000/api/debug-db` and compare the `host` with your Supabase project.

### Option C: Check which project your Supabase SQL Editor uses

When you run SQL in Supabase Dashboard → SQL Editor, it uses **that project's database**. Your `DATABASE_URL` must point to the same project.

- **Hosted Supabase:** `DATABASE_URL` should use the connection string from **Settings → Database** of that project.
- **Local Supabase:** `supabase start` creates a local DB. Your local `DATABASE_URL` is often `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (port from `supabase status`).

## Step 4: Align Them

1. Copy the **Connection string (URI)** from Supabase Dashboard → Settings → Database (use "Transaction" or "Session" mode as needed).
2. Paste into `.env.local` as `DATABASE_URL=...`
3. Restart your dev server: `npm run dev`

## Step 5: Run the migration in the correct database

Once `DATABASE_URL` points to the right project, run the migration there:

**Supabase Dashboard SQL Editor (for that project):**
```sql
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "invoice_email" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "gst_number" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "primary_goal" text;
```

Or via Supabase CLI:
```bash
npx supabase db push
```
(Make sure `supabase link` points to the correct project.)
