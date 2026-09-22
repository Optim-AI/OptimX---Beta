# Phase 9 — Commercial Studio Frontend Integration

## Entry point

`/brand-studio/video?id=<sessionId>`

Components: `VideoSessionPageClient` → `VideoStudioWorkspace`

## Flow

```text
Existing Studio
 ↓
Campaign Brief (session + AdBuilderData)
 ↓
Product Reference (URL / upload)
 ↓
Creative Direction
 ↓
15s / 30s + 9:16 / 16:9
 ↓
Generate Commercial → POST /api/commercial/generate (ONCE)
 ↓
native_continuous Seedance 2.5 (durationSeconds = 15|30)
 ↓
Final Commercial + QC
 ↓
Accept / Regenerate / Manual review
```

## Invariants

- Normal UI never calls `/api/commercial/generate-shot`
- Never sends `shot_based_fallback`
- 15s → exactly one generation with `durationSeconds: 15`
- 30s → exactly one generation with `durationSeconds: 30`

## Mapper

`lib/creative-studio/commercial-production/studio-mapper.ts`

```bash
npm run test:studio-mapper
```
