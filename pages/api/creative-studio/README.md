# Creative Studio API Routes

This directory contains API routes for the Creative Studio feature.

## Routes

### 1. `/api/creative-studio/fetch-image` (POST)
Fetches an image from a URL (handles both direct image URLs and product page URLs by scraping).

**Request:**
```json
{
  "url": "https://example.com/product-page"
}
```

**Response:**
```json
{
  "ok": true,
  "dataUrl": "data:image/png;base64,...",
  "contentType": "image/png",
  "size": 12345
}
```

### 2. `/api/creative-studio/save-poster` (POST)
Saves a generated poster to the user's image library.

**Request:**
```json
{
  "imageUrl": "data:image/png;base64,..." or "https://...",
  "name": "Creative Studio Poster 1",
  "metadata": {
    "brand": "Brand Name",
    "theme": "elegant",
    "objective": "BRAND_AWARENESS",
    "aspectRatio": "1:1"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "imageUrl": "https://...",
  "imagePath": "campaigns/user_id/...",
  "record": { ... }
}
```

### 3. `/api/creative-studio/save-session` (POST)
Saves a Creative Studio session for later retrieval.

**Request:**
```json
{
  "name": "Creative Studio - Brand Name",
  "brandSnapshot": {
    "name": "...",
    "description": "...",
    "audience": "...",
    "offering": "...",
    "tone": "..."
  },
  "productData": {
    "prompt": "...",
    "images": []
  },
  "config": {
    "theme": "...",
    "objective": "...",
    "cta": "...",
    "aspectRatio": "1:1"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "uuid",
  "session": { ... }
}
```

### 4. `/api/creative-studio/create-campaign` (POST)
Creates a campaign from a generated poster.

**Request:**
```json
{
  "posterUrl": "data:image/png;base64,..." or "https://...",
  "campaignName": "My Campaign",
  "objective": "LINK_CLICKS",
  "brandSnapshot": { ... },
  "config": { ... },
  "platforms": []
}
```

**Response:**
```json
{
  "ok": true,
  "campaignId": "uuid",
  "campaign": { ... },
  "imageUrl": "https://..."
}
```

### 5. `/api/creative-studio/get-sessions` (GET)
Retrieves all saved Creative Studio sessions for the authenticated user.

**Response:**
```json
{
  "ok": true,
  "sessions": [ ... ]
}
```

## Database Schema

### Required Tables

#### `user_generated_image` (already exists)
- `user_id` (uuid, foreign key)
- `image_url` (text)
- `image_path` (text, nullable)
- `source` (text) - e.g., "creative-studio"
- `metadata` (jsonb, nullable)
- `created_at` (timestamp)

#### `creative_studio_sessions` (needs to be created)
```sql
CREATE TABLE IF NOT EXISTS creative_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_snapshot JSONB NOT NULL,
  product_data JSONB,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_user_id 
ON creative_studio_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_updated_at 
ON creative_studio_sessions(updated_at DESC);
```

#### `campaigns` (already exists)
- Uses existing campaigns table structure
- Fields used: `user_id`, `name`, `campaign_type`, `brand_voice`, `content_types`, `image_url`, `image_path`, `objective`, `platforms`, `metadata`

## Authentication

All routes require Bearer token authentication:
```
Authorization: Bearer <supabase_access_token>
```

## Storage

Images are uploaded to the `campaign-assets` bucket in Supabase Storage with the path:
```
campaigns/{user_id}/{timestamp}_{name}.{ext}
```

