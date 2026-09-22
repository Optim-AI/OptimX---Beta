/**
 * Default Commercial Director — Phase 2.
 *
 * CampaignBrief → explore concepts → select → VisualTreatment / beats /
 * editorial / product / brand / platform / continuity / artifact risks / QC reqs
 * → validated CommercialBlueprintCore (no shots, no video generation).
 *
 * Does NOT call Runway, Seedance, film-engine Veo, or Shot Planner.
 */

import type { CampaignBrief } from "../campaign/types";
import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import { assembleBlueprintFromDraft, type DirectorDraft } from "./assemble";
import { createDefaultStructuredGenerator } from "./gemini-structured";
import type { StructuredGenerator } from "./llm";
import { StructuredGenerationError } from "./llm";
import {
  buildDirectorSystemPrompt,
  buildDirectorUserPrompt,
  buildRepairUserPrompt,
} from "./prompts";
import type {
  CommercialDirector,
  CommercialDirectorMeta,
  CommercialDirectorOutput,
} from "./types";
import {
  formatValidationIssues,
  validateCommercialBlueprint,
} from "./validate";

export interface DefaultCommercialDirectorOptions {
  generator?: StructuredGenerator;
  /** Max structured repair attempts after validation failure (default 1). */
  maxRepairAttempts?: number;
  /** Optional logger sink — defaults to console. */
  log?: (event: string, payload: Record<string, unknown>) => void;
}

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[commercial-director] ${event}`, payload);
}

export class DefaultCommercialDirector implements CommercialDirector {
  private readonly generator: StructuredGenerator;
  private readonly maxRepairAttempts: number;
  private readonly log: (event: string, payload: Record<string, unknown>) => void;

  constructor(options: DefaultCommercialDirectorOptions = {}) {
    this.generator = options.generator ?? createDefaultStructuredGenerator();
    this.maxRepairAttempts = options.maxRepairAttempts ?? 1;
    this.log = options.log ?? defaultLog;
  }

  async direct(brief: CampaignBrief): Promise<CommercialDirectorOutput> {
    const started = Date.now();
    this.assertBrief(brief);

    this.log("direct.start", {
      campaignId: brief.campaignId,
      duration: brief.campaignDuration,
      aspectRatio: brief.aspectRatio,
      platform: brief.platform ?? null,
      brand: brief.brand.name,
      product: brief.product.name,
      model: this.generator.modelId,
    });

    let draft: DirectorDraft;
    let model = this.generator.modelId;
    let repairAttempted = false;

    try {
      const first = await this.generator.generateJson<DirectorDraft>({
        systemPrompt: buildDirectorSystemPrompt(),
        userPrompt: buildDirectorUserPrompt(brief),
        schemaName: "commercial-blueprint",
        temperature: 0.9,
        maxOutputTokens: 16384,
      });
      draft = first.data;
      model = first.model;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log("direct.failure", {
        campaignId: brief.campaignId,
        model: this.generator.modelId,
        generationDurationMs: Date.now() - started,
        validationPassed: false,
        failureReason: message,
      });
      throw e;
    }

    let blueprint = assembleBlueprintFromDraft(brief, draft);
    let validation = validateCommercialBlueprint(blueprint);
    let rationale =
      (typeof draft.rationale === "string" && draft.rationale.trim()) ||
      blueprint.selectedConcept.campaignFitRationale ||
      blueprint.selectedConcept.oneLinePitch;

    if (!validation.ok && this.maxRepairAttempts > 0) {
      repairAttempted = true;
      this.log("direct.validation_failed_repairing", {
        campaignId: brief.campaignId,
        issueCount: validation.issues.length,
        issues: validation.issues.slice(0, 12),
      });

      try {
        const repaired = await this.generator.generateJson<DirectorDraft>({
          systemPrompt: buildDirectorSystemPrompt(),
          userPrompt: buildRepairUserPrompt(
            brief,
            draft,
            formatValidationIssues(validation.issues)
          ),
          schemaName: "commercial-blueprint-repair",
          temperature: 0.55,
          maxOutputTokens: 16384,
        });
        draft = repaired.data;
        model = repaired.model;
        blueprint = assembleBlueprintFromDraft(brief, draft);
        validation = validateCommercialBlueprint(blueprint);
        rationale =
          (typeof draft.rationale === "string" && draft.rationale.trim()) ||
          blueprint.selectedConcept.campaignFitRationale ||
          rationale;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.log("direct.repair_failure", {
          campaignId: brief.campaignId,
          failureReason: message,
        });
        throw new StructuredGenerationError(
          `Commercial Director repair failed: ${message}`,
          e
        );
      }
    }

    const generationDurationMs = Date.now() - started;

    if (!validation.ok) {
      const failureReason = formatValidationIssues(validation.issues);
      this.log("direct.validation_failed", {
        campaignId: brief.campaignId,
        selectedConcept: blueprint.selectedConcept?.title ?? null,
        model,
        generationDurationMs,
        validationPassed: false,
        failureReason,
        repairAttempted,
      });
      throw new StructuredGenerationError(
        `Commercial Blueprint validation failed: ${failureReason}`
      );
    }

    const meta: CommercialDirectorMeta = {
      campaignId: brief.campaignId,
      selectedConceptTitle: blueprint.selectedConcept.title,
      model,
      generationDurationMs,
      validationPassed: true,
      exploredConceptCount: blueprint.exploredConcepts?.length ?? 0,
      repairAttempted,
    };

    this.log("direct.success", {
      campaignId: meta.campaignId,
      selectedConcept: meta.selectedConceptTitle,
      model: meta.model,
      generationDurationMs: meta.generationDurationMs,
      validationPassed: true,
      exploredConceptCount: meta.exploredConceptCount,
      repairAttempted: meta.repairAttempted,
      beatCount: blueprint.visualBeats.length,
    });

    return { blueprint, rationale, meta };
  }

  private assertBrief(brief: CampaignBrief): void {
    if (!brief?.campaignId?.trim()) {
      throw new StructuredGenerationError("CampaignBrief.campaignId is required");
    }
    if (!brief.brand?.name?.trim()) {
      throw new StructuredGenerationError("CampaignBrief.brand.name is required");
    }
    if (!brief.product?.name?.trim()) {
      throw new StructuredGenerationError("CampaignBrief.product.name is required");
    }
    if (!isCampaignDurationSeconds(brief.campaignDuration)) {
      throw new StructuredGenerationError("CampaignBrief.campaignDuration must be 15 or 30");
    }
    if (!brief.aspectRatio) {
      throw new StructuredGenerationError("CampaignBrief.aspectRatio is required");
    }
  }
}

/** Factory using the default Gemini structured generator. */
export function createCommercialDirector(
  options?: DefaultCommercialDirectorOptions
): CommercialDirector {
  return new DefaultCommercialDirector(options);
}
