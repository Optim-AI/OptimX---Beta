/**
 * In-process generation locks per session — Phase 9 duplicate-click protection.
 * Not a distributed lock; sufficient for single-node / prevents same-process double submit.
 */

const generatingSessions = new Set<string>();
const iteratingKeys = new Set<string>();

export function tryAcquireGenerationLock(sessionId: string): boolean {
  if (generatingSessions.has(sessionId)) return false;
  generatingSessions.add(sessionId);
  return true;
}

export function releaseGenerationLock(sessionId: string): void {
  generatingSessions.delete(sessionId);
}

export function tryAcquireIterationLock(key: string): boolean {
  if (iteratingKeys.has(key)) return false;
  iteratingKeys.add(key);
  return true;
}

export function releaseIterationLock(key: string): void {
  iteratingKeys.delete(key);
}
