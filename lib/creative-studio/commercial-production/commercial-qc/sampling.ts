/**
 * Deterministic, duration-aware visual frame sampling plan.
 * Does not extract pixels — only computes timestamps.
 */

import type { VisualSamplingPlan } from "./types";

export interface SamplingOptions {
  /** Minimum samples including start and end. Default 6. */
  minSamples?: number;
  /** Maximum samples. Default 8 for ≤15s, 10 for 30s. */
  maxSamples?: number;
  /** Explicit normalized fractions 0..1. When set, overrides count heuristics. */
  fractions?: number[];
}

const DEFAULT_FRACTIONS_15 = [0, 0.2, 0.4, 0.6, 0.8, 1];
const DEFAULT_FRACTIONS_30 = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

/**
 * Build a sampling plan. Never samples outside [0, duration].
 * Always preserves beginning and ending evidence; includes narrative middle.
 */
export function buildVisualSamplingPlan(
  durationSeconds: number,
  options: SamplingOptions = {}
): VisualSamplingPlan {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return {
      timestamps: [0],
      reason: "Invalid duration — single zero sample",
      durationSeconds: 0,
      sampleCount: 1,
    };
  }

  const fractions =
    options.fractions ??
    (durationSeconds <= 15 ? DEFAULT_FRACTIONS_15 : DEFAULT_FRACTIONS_30);

  let maxSamples =
    options.maxSamples ?? (durationSeconds <= 15 ? 6 : 10);
  const minSamples = options.minSamples ?? Math.min(6, fractions.length);
  maxSamples = Math.max(maxSamples, minSamples);

  // Start from configured fractions, then densify if needed
  let selected = [...fractions];
  if (selected.length < minSamples) {
    const step = 1 / (minSamples - 1);
    selected = Array.from({ length: minSamples }, (_, i) =>
      Number((i * step).toFixed(4))
    );
  }
  if (selected.length > maxSamples) {
    // Keep first, last, and evenly spaced middle
    const midCount = maxSamples - 2;
    const mids: number[] = [];
    for (let i = 1; i <= midCount; i++) {
      mids.push(Number(((i / (midCount + 1))).toFixed(4)));
    }
    selected = [0, ...mids, 1];
  }

  // Ensure 0 and 1
  if (selected[0] !== 0) selected = [0, ...selected];
  if (selected[selected.length - 1] !== 1) selected = [...selected, 1];

  const raw = selected.map((f) =>
    Math.min(durationSeconds, Math.max(0, Number((f * durationSeconds).toFixed(3))))
  );

  // Deduplicate while preserving order
  const timestamps: number[] = [];
  for (const t of raw) {
    if (timestamps.length === 0 || Math.abs(timestamps[timestamps.length - 1] - t) > 0.05) {
      timestamps.push(t);
    }
  }

  // Guarantee end frame even after dedupe
  const end = Number(durationSeconds.toFixed(3));
  if (Math.abs(timestamps[timestamps.length - 1] - end) > 0.05) {
    timestamps.push(end);
  } else {
    timestamps[timestamps.length - 1] = end;
  }
  timestamps[0] = 0;

  return {
    timestamps,
    reason:
      durationSeconds <= 15
        ? "Normalized 15s campaign sampling (~0/20/40/60/80/100%)"
        : "Normalized 30s campaign sampling with denser narrative coverage",
    durationSeconds,
    sampleCount: timestamps.length,
  };
}

/**
 * Validate that timestamps lie within duration and are unique enough.
 */
export function validateSamplingPlan(
  plan: VisualSamplingPlan
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (plan.timestamps.length === 0) {
    issues.push("No timestamps");
  }
  for (const t of plan.timestamps) {
    if (t < 0 || t > plan.durationSeconds + 0.001) {
      issues.push(`Timestamp ${t} outside [0, ${plan.durationSeconds}]`);
    }
  }
  if (plan.timestamps[0] !== 0) {
    issues.push("First timestamp must be 0");
  }
  const last = plan.timestamps[plan.timestamps.length - 1];
  if (Math.abs(last - plan.durationSeconds) > 0.05) {
    issues.push("Last timestamp must equal duration");
  }
  return { ok: issues.length === 0, issues };
}
