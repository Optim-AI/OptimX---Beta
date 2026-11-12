/**
 * Round progress helpers. Keep this file free of DB / engine imports so unit tests stay light.
 *
 * A round runs in a 5-minute Vercel waitUntil. 8 full poster pipelines in parallel used to
 * deadlock the 10-connection DB pool, then the killed job left drafts in "drawing" forever.
 */
export const RENDER_CONCURRENCY = 2;
export const DRAFT_TIMEOUT_MS = 120_000;
/** After the background function is gone, pick the round back up (maxDuration 300s + 1 min). */
export const ROUND_STALE_MS = 6 * 60 * 1000;

export function isOpenDraftStatus(status: string): boolean {
  return status === 'pending' || status === 'drawing';
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export function roundNeedsResume(
  project: { status: string; updatedAt: string },
  drafts: { status: string; updatedAt: string }[],
  now = Date.now(),
): boolean {
  if (project.status !== 'drawing' && project.status !== 'researching') return false;
  const open = drafts.filter((d) => isOpenDraftStatus(d.status));
  if (!open.length && project.status === 'drawing') return false;
  const newest = Math.max(
    Date.parse(project.updatedAt),
    ...open.map((d) => Date.parse(d.updatedAt)),
  );
  if (!Number.isFinite(newest)) return false;
  return now - newest > ROUND_STALE_MS;
}
