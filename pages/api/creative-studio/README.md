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
    "aspectRatio": "1:1"
  }
}
```

### 3. `/api/creative-studio/save-session` (POST)
Saves a Creative Studio session for later retrieval.

**Request:**
```json
{
  "name": "Creative Studio - Brand Name",
  "brandSnapshot": { "name": "...", "description": "...", "audience": "...", "offering": "...", "tone": "..." },
  "productData": { "prompt": "...", "images": [] },
  "config": { "theme": "...", "aspectRatio": "1:1" }
}
```

### 4. `/api/creative-studio/create-campaign` (POST)
Creates a campaign from a generated poster.

**Request:**
```json
{
  "posterUrl": "data:image/png;base64,..." or "https://...",
  "campaignName": "My Campaign",
  "brandSnapshot": { ... },
  "config": { ... },
  "platforms": []
}
```

### 5. `/api/creative-studio/get-sessions` (GET)
Retrieves all saved Creative Studio sessions for the authenticated user.

### 6. `/api/creative-studio/scrape-product` (POST)
Scrapes product information from a URL.

**Request:**
```json
{
  "url": "https://example.com/product"
}
```

### 7. `/api/creative-studio/fetch-logo` (POST)
Fetches a brand logo from a domain.

**Request:**
```json
{
  "domain": "example.com"
}
```

### 8. `/api/creative-studio/generate-script` (POST)
Generates a video ad script using AI.

**Request:**
```json
{
  "product_name": "Product Name",
  "brand_name": "Brand Name",
  "style": "Cinematic",
  "duration": 15,
  "platform": "Instagram Reels / TikTok",
  "aspect_ratio": "9:16",
  "voiceover": true,
  "tone": "Energetic"
}
```

### 9. `/api/creative-studio/generate-video` (POST)
Generates a video ad using Google Veo 3.1.

**Request:**
```json
{
  "product_name": "Product Name",
  "brand_name": "Brand Name",
  "final_video_prompt": "...",
  "style": "Cinematic",
  "duration": 6,
  "aspect_ratio": "9:16"
}
```

### 10. `/api/creative-studio/generate-video-stitched` (POST)
Generates a longer video ad by creating multiple Veo clips (typically 2× ~8 seconds) and stitching them into a single MP4.

**Request:**
Same as `generate-video`. Use `duration > 8` to trigger stitching.

## Authentication

All routes require Bearer token authentication:
```
Authorization: Bearer <supabase_access_token>
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key for script generation |
| `GEMINI_VEO_API_KEY` | Google Gemini Veo 3.1 API key for video generation |
| `BRANDFETCH_API_KEY` | (Optional) Brandfetch API key for logo fetching |

## Storage

Images are uploaded to the `campaign-assets` bucket in Supabase Storage.
