import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import { totalShotDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../campaign/types";
import type { CommercialShot } from "../shot-planner/types";
import type { CommercialTimeline, TimelineClip, TimelineTrack } from "./types";

export function buildTimelineFromShots(input: {
  campaignId: string;
  duration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio;
  shots: CommercialShot[];
}): CommercialTimeline {
  const videoTrackId = "track-video";
  let cursor = 0;
  const clips: TimelineClip[] = input.shots
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((shot) => {
      const clip: TimelineClip = {
        id: `clip-${shot.id}`,
        trackId: videoTrackId,
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds: shot.durationSeconds,
        transitionIn: shot.transitionIn,
        transitionOut: shot.transitionOut,
      };
      cursor += shot.durationSeconds;
      return clip;
    });

  const videoTrack: TimelineTrack = {
    id: videoTrackId,
    kind: "video",
    clips,
  };

  const transitions = clips.slice(0, -1).map((clip, index) => ({
    fromClipId: clip.id,
    toClipId: clips[index + 1].id,
    type: clip.transitionOut ?? "cut",
  }));

  return {
    campaignId: input.campaignId,
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    tracks: [videoTrack],
    clips,
    transitions,
    overlays: [],
    soundEffects: [],
    textLayers: [],
  };
}

export function timelineDurationSeconds(timeline: CommercialTimeline): number {
  if (!timeline.clips.length) return 0;
  return Math.max(...timeline.clips.map((clip) => clip.startSeconds + clip.durationSeconds));
}

export function plannedShotDurationSeconds(shots: CommercialShot[]): number {
  return totalShotDurationSeconds(shots.map((shot) => shot.durationSeconds));
}
