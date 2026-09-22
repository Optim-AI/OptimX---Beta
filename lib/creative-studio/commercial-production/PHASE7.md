# Phase 7 — Native Continuous Generation

## Summary

Phase 7 makes **Runway → Seedance 2.5 native continuous generation** the **default** way to produce a 15s or 30s commercial.

The Shot Planner still describes creative structure (beats, continuity, product state). It does **not** mean “one video file per shot.”

## Primary path

```text
Campaign Brief
  → Commercial Director → Blueprint
  → Shot Planner → ShotPlan
  → Campaign Compiler → CampaignGenerationSpec
  → ONE Seedance 2.5 job (duration = 15 | 30)
  → Deterministic QC
  → FinalCommercial (productionMode: native_continuous)
```

## Fallback path (explicit only)

```text
generationMode: shot_based_fallback
  → Phase 6 per-shot videos
  → Minimal timeline assembly
  → FinalCommercial (productionMode: shot_based_composed)
```

FFmpeg multi-clip stitch is **not** implemented here (timeline is ready; stitch deferred).

Fallback is **never** applied silently after a native failure.

## Provider stack

| Concern | Value |
|--------|--------|
| Provider | `runway` |
| Model | `seedance2_5` |
| Duration | Full campaign `15` or `30` (not clamped to short clips) |

Do not use alternate model IDs (`seedance_2_5`, etc.).

## What Phase 7 does not include

- Voice / dialogue / ElevenLabs / Chirp / lip-sync
- Music / SFX generation
- Visual AI QC (`visualInspectionAvailable: false`)
- Giant FFmpeg compositor
- Veo / BytePlus / fal / Kling / Wan
- Durable production-run DB (still process-local caches)
- Async job queue (HTTP still poll-to-completion)

## API

`POST /api/commercial/generate`

Default: `generationMode = "native_continuous"` → returns `{ finalCommercial }`.

Optional: `generationMode: "shot_based_fallback"`.

Legacy Phase 6 run/manifest: set `produceFinal: false`.

## Tests

```bash
npm run test:campaign-compiler
npm run test:campaign-executor
npm run test:commercial-production
```

All automated tests mock providers — **no Runway / Nano Banana credits**.
