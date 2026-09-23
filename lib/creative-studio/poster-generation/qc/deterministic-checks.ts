/**
 * Deterministic poster QC — no AI.
 * Technical checks code can verify reliably.
 */

import sharp from "sharp";
import type { PosterAspectRatio } from "../types";
import type { PosterQcCheck, PosterQcIssue } from "../types";

export type DeterministicQcResult = {
  passed: boolean;
  /** Hard failure → skip vision */
  skipVision: boolean;
  technicalCheck: PosterQcCheck;
  issues: PosterQcIssue[];
  warnings: PosterQcIssue[];
  meta: {
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
    measuredAspect?: number;
  };
};

const ASPECT_TARGETS: Record<PosterAspectRatio, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "1.91:1": 1.91,
};

function issue(
  id: string,
  code: string,
  message: string,
  severity: PosterQcIssue["severity"] = "high",
  expected?: string,
  observed?: string
): PosterQcIssue {
  return {
    id,
    category: "technical",
    severity,
    code,
    message,
    expected: expected ?? null,
    observed: observed ?? null,
    actionable: true,
    recommendedFix: "Regenerate the poster image",
  };
}

export async function loadImageBuffer(
  imageUrl: string
): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith("data:")) {
      const m = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!m) return null;
      return Buffer.from(m[1], "base64");
    }
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const resp = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SkalX AI/1.0)",
          Accept: "image/*",
        },
      });
      if (!resp.ok) return null;
      return Buffer.from(await resp.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

export async function runDeterministicPosterQc(options: {
  imageUrl: string;
  expectedAspect: PosterAspectRatio;
  assetStatus: string;
}): Promise<DeterministicQcResult> {
  const issues: PosterQcIssue[] = [];
  const warnings: PosterQcIssue[] = [];
  const meta: DeterministicQcResult["meta"] = {};

  if (options.assetStatus === "failed" || !options.imageUrl?.trim()) {
    issues.push(
      issue(
        "tech_missing",
        "IMAGE_MISSING",
        "Generated image is missing or generation failed",
        "critical",
        "generated image",
        options.imageUrl || "(empty)"
      )
    );
    return {
      passed: false,
      skipVision: true,
      technicalCheck: {
        status: "fail",
        severity: "critical",
        summary: "Image missing",
        expected: "Valid generated image",
        observed: "Missing",
      },
      issues,
      warnings,
      meta,
    };
  }

  const buffer = await loadImageBuffer(options.imageUrl);
  if (!buffer || buffer.length < 32) {
    issues.push(
      issue(
        "tech_empty",
        "IMAGE_EMPTY",
        "Image could not be loaded or is empty/corrupted",
        "critical"
      )
    );
    return {
      passed: false,
      skipVision: true,
      technicalCheck: {
        status: "fail",
        severity: "critical",
        summary: "Image corrupt or unloadable",
      },
      issues,
      warnings,
      meta: { bytes: buffer?.length || 0 },
    };
  }

  meta.bytes = buffer.length;

  try {
    const image = sharp(buffer);
    const info = await image.metadata();
    meta.width = info.width;
    meta.height = info.height;
    meta.format = info.format;

    if (!info.width || !info.height) {
      issues.push(
        issue("tech_dims", "IMAGE_NO_DIMENSIONS", "Image has no dimensions", "critical")
      );
    } else {
      const measured = info.width / info.height;
      meta.measuredAspect = measured;
      const target = ASPECT_TARGETS[options.expectedAspect];
      const tolerance = 0.08;
      if (target && Math.abs(measured - target) > tolerance) {
        warnings.push(
          issue(
            "tech_aspect",
            "ASPECT_MISMATCH",
            `Measured aspect ~${measured.toFixed(3)} differs from expected ${options.expectedAspect}`,
            "medium",
            options.expectedAspect,
            `${info.width}x${info.height}`
          )
        );
      }
    }

    if (info.format && !["png", "jpeg", "webp", "jpg"].includes(info.format)) {
      warnings.push(
        issue(
          "tech_format",
          "UNEXPECTED_FORMAT",
          `Unexpected image format: ${info.format}`,
          "low",
          "png/jpeg/webp",
          info.format
        )
      );
    }
  } catch {
    issues.push(
      issue(
        "tech_decode",
        "IMAGE_DECODE_FAILED",
        "Image failed to decode",
        "critical"
      )
    );
    return {
      passed: false,
      skipVision: true,
      technicalCheck: {
        status: "fail",
        severity: "critical",
        summary: "Decode failed",
      },
      issues,
      warnings,
      meta,
    };
  }

  const passed = issues.length === 0;
  return {
    passed,
    skipVision: !passed,
    technicalCheck: {
      status: passed ? (warnings.length ? "warn" : "pass") : "fail",
      severity: passed ? (warnings.length ? "low" : "none") : "critical",
      summary: passed
        ? warnings.length
          ? "Technically valid with aspect/format warnings"
          : "Image loads and decodes"
        : "Technical failure",
      expected: `Valid image @ ${options.expectedAspect}`,
      observed: meta.width
        ? `${meta.width}x${meta.height} ${meta.format}`
        : "invalid",
      evidence: meta.bytes ? [`bytes=${meta.bytes}`] : undefined,
    },
    issues,
    warnings,
    meta,
  };
}
