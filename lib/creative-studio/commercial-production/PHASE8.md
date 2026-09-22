# Phase 8 — Commercial QC & Regeneration Loop

## Pipeline position

```text
Final Commercial
      ↓
Deterministic QC
      ↓
Visual Sampling (when analyzer configured)
      ↓
Visual Analysis
      ↓
Creative / Product / Brand / Continuity / Artifact / Ending evaluation
      ↓
Decision
 ├── accept
 ├── regenerate  → RegenerationPlan (targeted, versioned, bounded)
 └── manual_review
```

## Decisions (no quality score)

- `accept` — deterministic pass; no material creative/production failures
- `regenerate` — concrete fixable failure; emits `RegenerationPlan` with required changes + preserved creative DNA
- `manual_review` — ambiguous/low-confidence evidence, analyzer errors, or regeneration limit reached

**There is no `qualityScore` / `overallScore`.**

## Defaults

| Setting | Default |
|--------|---------|
| `MAX_AUTO_REGENERATIONS` | `2` |
| `autoDecisionMinConfidence` | `0.85` |
| `manualReviewBelowConfidence` | `0.7` |

## Visual analysis

- Abstraction: `CommercialVisualAnalyzer`
- Implementation: `GeminiVisualAnalyzer` (reuses `getGeminiApiKey` + `fetchWithGeminiRateLimitRetry`)
- Tests: `MockVisualAnalyzer` only — **no live Gemini / Runway / Seedance / Nano Banana**
- Live vision opt-in: `COMMERCIAL_QC_LIVE_VISION=1`
- Frame sampling: deterministic timestamps (15s ≈ 0/20/40/60/80/100%; denser for 30s)
- Pixel extraction: inject `frameSampler`; without it, stub frame refs are used for contract tests

## Regeneration

- Module produces a **plan**, not a provider call
- `runQCWithRegenerationLoop` accepts a `regenerate()` callback (tests mock video provider)
- Versions: `v1` → `v2` → `v3` (never overwrite)
- After limit: force `manual_review`

## Integration

- `produceFinalCommercial` runs QC by default (`runCommercialQc: false` to skip)
- `FinalCommercial.commercialQC` holds the report
- `ProductionManifest.qc` holds a compact summary via `attachQcToManifest`

## Audio

Voice / audio QC is **not** implemented. Frame analysis does not claim audio quality.

## Tests

```bash
npm run test:commercial-qc
```
