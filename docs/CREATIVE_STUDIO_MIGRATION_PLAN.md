# Creative Studio Migration Plan

**Date:** February 2, 2026  
**Source Branch:** `creative-studio-revised`  
**Target Branch:** `staging`  
**Status:** Completed

---

## Overview

This document outlines the comprehensive plan to migrate the Creative Studio feature from the `creative-studio-revised` branch into the `staging` branch, ensuring compatibility with the existing architecture.

---

## 1. Architecture Comparison

### Staging Branch Architecture

| Component | Location | Description |
|-----------|----------|-------------|
| **Supabase Client** | `auth/supabase/client.ts` | `supabase`, `supabaseAdmin` exports |
| **Auth Helpers** | `auth/request.ts` | `getUserIdFromRequest()`, `getTokenFromReq()` |
| **Database Schema** | `database/schema.ts` | Drizzle ORM schema definitions |
| **Database Models** | `database/models/*.dao.ts` | DAO pattern for database operations |
| **Colors/Theme** | `lib/ui/colors.ts` | UI color tokens |
| **Sidebar** | `app/web/src/components/Sidebar.tsx` | Navigation component |
| **API Routes** | `pages/api/*` | Next.js Pages Router API |

### Creative-Studio-Revised Branch Differences

| Component | Source Location | Migration Action |
|-----------|-----------------|------------------|
| **Supabase Client** | `lib/supabaseClient.ts` | Update imports to staging path |
| **Auth Helpers** | Inline in API routes | Use staging's auth helpers |
| **Database** | None (removed) | Add new tables to staging schema |
| **Colors** | `lib/colors.ts` | Update imports to staging path |
| **Sidebar** | Modified with chat history | Merge changes into staging |

---

## 2. Files to Migrate

### New Pages (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `pages/creative-studio.tsx` | ~7350 | Main Creative Studio page with poster/video generation |

### New API Endpoints (10 files)

| File | Description |
|------|-------------|
| `pages/api/creative-studio/README.md` | API documentation |
| `pages/api/creative-studio/create-campaign.ts` | Create campaign from poster |
| `pages/api/creative-studio/fetch-image.ts` | Fetch images from URLs |
| `pages/api/creative-studio/fetch-logo.ts` | Fetch brand logos |
| `pages/api/creative-studio/generate-script.ts` | AI video script generation |
| `pages/api/creative-studio/generate-video.ts` | Video generation with Veo 3.1 |
| `pages/api/creative-studio/get-sessions.ts` | Get saved sessions |
| `pages/api/creative-studio/save-poster.ts` | Save posters to storage |
| `pages/api/creative-studio/save-session.ts` | Save creative studio sessions |
| `pages/api/creative-studio/scrape-product.ts` | Product URL scraping |

### New Brand Analysis APIs (3 files)

| File | Description |
|------|-------------|
| `pages/api/brand/analyze.ts` | Basic brand analysis |
| `pages/api/brand/fullAnalyze.ts` | Comprehensive brand analysis |
| `pages/api/brand/generateTemplates.ts` | Generate brand templates |

### Modified Files (1 file)

| File | Changes |
|------|---------|
| `app/web/src/components/Sidebar.tsx` | Add Creative Studio nav item, chat history support |

### Database Changes (1 migration)

| Table | Description |
|-------|-------------|
| `creative_studio_sessions` | Store saved Creative Studio sessions |

---

## 3. Import Path Adaptations

All files must be adapted to use staging's import paths:

```typescript
// FROM (creative-studio-revised)          // TO (staging)
import { supabase } from "../lib/supabaseClient"     → import { supabase } from "@/auth/supabase/client"
import { supabaseAdmin } from "../../../lib/supabaseClient" → import { supabaseAdmin } from "@/auth/supabase/client"
import colors from "../../../../lib/colors"          → import colors from "@/lib/ui/colors"
// Auth helpers - use staging pattern
// (inline auth)                           → import { getUserIdFromRequest } from "@/auth/request"
```

---

## 4. Database Schema Addition

### New Table: `creative_studio_sessions`

```typescript
// Add to database/schema.ts
export const creativeStudioSessions = pgTable("creative_studio_sessions", {
  id: uuid().primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text().notNull(),
  brandSnapshot: jsonb("brand_snapshot").notNull(),
  productData: jsonb("product_data"),
  config: jsonb(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_creative_studio_sessions_user_id").using("btree", table.userId.asc().nullsLast()),
]);
```

### Migration SQL

```sql
-- supabase/migrations/[timestamp]_add_creative_studio_sessions.sql
CREATE TABLE IF NOT EXISTS creative_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  brand_snapshot JSONB NOT NULL,
  product_data JSONB,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_user_id 
ON creative_studio_sessions(user_id);

-- RLS Policies
ALTER TABLE creative_studio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON creative_studio_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON creative_studio_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON creative_studio_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON creative_studio_sessions FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 5. Sidebar Modifications

Update `app/web/src/components/Sidebar.tsx`:

1. **Add Creative Studio to NAV_ITEMS:**
   ```typescript
   { href: '/creative-studio', label: 'Creative Studio', Icon: Palette },
   ```

2. **Add optional chat history props** (for Creative Studio page)

3. **Keep existing active route highlighting**

---

## 6. Environment Variables

The following environment variables are required for Creative Studio:

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_VEO_API_KEY` | Google Gemini Veo 3.1 API key for video generation | Yes (for video) |
| `OPENAI_API_KEY` | OpenAI API key (already in staging) | Yes |

---

## 7. Migration Steps

### Step 1: Database Schema Update
- [x] Add `creative_studio_sessions` table to `database/schema.ts`
- [x] Create migration SQL file

### Step 2: Sidebar Update
- [x] Modify Sidebar.tsx with Creative Studio nav item
- [x] Add chat history support (optional props)

### Step 3: API Endpoints
- [x] Create `pages/api/creative-studio/` directory
- [x] Migrate and adapt all API endpoints with correct imports

### Step 4: Main Page
- [x] Migrate `pages/creative-studio.tsx` with correct imports

### Step 5: Brand APIs
- [x] Create `pages/api/brand/` directory  
- [x] Migrate brand analysis endpoints

### Step 6: Testing
- [x] Verify all imports resolve correctly
- [ ] Test Creative Studio page loads
- [ ] Test brand analysis flow
- [ ] Test poster generation
- [ ] Test video generation (requires GEMINI_VEO_API_KEY)
- [ ] Test session save/load

---

## 8. Key Features Being Migrated

### Creative Studio Features

1. **Brand Analysis** - AI-powered brand analysis from website URL
2. **Poster Generation** - AI-generated marketing posters with themes:
   - Minimal, Professional, Elegant, Premium
   - Bold, Playful, Trendy, Festive, Dynamic
3. **Video Ad Generation** - Using Google Veo 3.1:
   - Multiple styles (Cinematic, Stop Motion, 3D Animation, etc.)
   - Multiple durations (6s, 8s, 10s, 15s)
   - Multiple aspect ratios (9:16, 1:1, 16:9, 4:5)
4. **Session Management** - Save and load creative sessions
5. **Chat History** - Sidebar integration for session navigation

### Supported Workflows

1. **Website → Brand Analysis → Poster Generation**
2. **Product URL → Scrape → Video Ad Creation**
3. **Manual Brand Input → Creative Generation**

---

## 9. Dependencies

### New/Updated Dependencies

| Package | Purpose | Action |
|---------|---------|--------|
| `@google/genai` | Gemini Veo 3.1 video generation | Add to package.json |

---

## 10. Post-Migration Checklist

- [x] All TypeScript errors resolved
- [x] All lint errors resolved
- [x] Creative Studio accessible from sidebar
- [ ] Brand analysis working (test after npm install)
- [ ] Poster generation working (test after npm install)
- [ ] Video generation working (requires GEMINI_VEO_API_KEY)
- [ ] Sessions save/load working (requires database migration)
- [ ] Images save to Supabase storage (test after setup)
- [x] Documentation updated

---

## 11. Post-Migration Steps

To complete the migration, run the following commands:

```bash
# 1. Fix npm permissions if needed
sudo chown -R $(whoami):staff ~/.npm

# 2. Install new dependencies
npm install

# 3. Apply database migration (if using Supabase)
supabase db reset
# OR apply migration manually:
# supabase migration up

# 4. Start the development server
npm run dev
```

---

**Migration Author:** AI Assistant  
**Last Updated:** February 2, 2026  
**Migration Completed:** February 2, 2026
