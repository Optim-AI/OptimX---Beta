/**
 * The single Graph / Marketing API version used by all Meta Intelligence code.
 * Checked against https://developers.facebook.com/docs/graph-api/changelog/versions/
 * on 2026-11-08: v26.0 (released 2026-07-29) is the latest.
 * Bump here only, after re-checking every field name we read.
 */
export const META_GRAPH_VERSION = 'v26.0' as const;

export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_DIALOG_BASE = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
