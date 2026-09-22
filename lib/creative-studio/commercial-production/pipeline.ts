/**
 * Campaign-level commercial production pipeline.
 *
 * This is not: user prompt → one video model → final MP4.
 * Each stage consumes the previous stage's structured output.
 */

export const COMMERCIAL_PIPELINE_STAGES = [
  "campaign_input",
  "commercial_director",
  "blueprint",
  "shot_planning",
  "generation_strategy",
  "keyframe_generation",
  "keyframe_qc",
  "video_generation",
  "shot_qc",
  "timeline_assembly",
  "compositing",
  "final_commercial",
] as const;

export type CommercialPipelineStage = (typeof COMMERCIAL_PIPELINE_STAGES)[number];

export const COMMERCIAL_PIPELINE_STAGE_ORDER: Record<CommercialPipelineStage, number> =
  COMMERCIAL_PIPELINE_STAGES.reduce(
    (acc, stage, index) => {
      acc[stage] = index;
      return acc;
    },
    {} as Record<CommercialPipelineStage, number>
  );
