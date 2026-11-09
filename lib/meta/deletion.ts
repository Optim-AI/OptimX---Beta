/**
 * Deletes everything SkalX holds from Meta for a user: token, assets and
 * (from Phase 2) all synced tables, which cascade from meta_connections.
 * Used by Disconnect, Meta's data-deletion callback and (token-only) deauthorize.
 */
import { randomBytes } from 'crypto';
import { MetaConnectionDAO, type MetaConnectionRow } from '@/database/models/MetaConnection.dao';
import { decryptToken } from './crypto';
import { graphCall } from './graph';
import { metaLog } from './log';

export function newConfirmationCode(): string {
  return `skx-${randomBytes(9).toString('base64url')}`;
}

/** Extra non-cascading cleanup steps (later phases). Stored creative images are removed directly in purge(). */
type CleanupStep = (conn: MetaConnectionRow) => Promise<void>;
const extraCleanup: CleanupStep[] = [];
export function registerMetaCleanup(step: CleanupStep) {
  extraCleanup.push(step);
}

async function revokeAtMeta(conn: MetaConnectionRow): Promise<boolean> {
  if (!conn.tokenEnc || conn.tokenType !== 'user') return false;
  try {
    await graphCall('me/permissions', decryptToken(conn.tokenEnc), {}, { method: 'DELETE', attempts: 1 });
    return true;
  } catch (err) {
    metaLog.warn('revoke_failed', { connectionId: conn.id, message: (err as Error).message });
    return false;
  }
}

async function purge(conns: MetaConnectionRow[], opts: { revoke: boolean }) {
  let revoked = 0;
  let imagesRemoved = 0;
  for (const c of conns) {
    if (opts.revoke && (await revokeAtMeta(c))) revoked++;
    try {
      const { removeCreativeImages } = await import('@/lib/meta-sync/images');
      imagesRemoved += await removeCreativeImages(c);
    } catch (err) {
      metaLog.error('creative_image_cleanup_failed', { connectionId: c.id, message: (err as Error).message });
    }
    for (const step of extraCleanup) {
      try {
        await step(c);
      } catch (err) {
        metaLog.error('cleanup_step_failed', { connectionId: c.id, message: (err as Error).message });
      }
    }
  }
  // Synced tables (campaigns, ads, insights, organic posts, sync runs) cascade from meta_connections.
  const deleted = await MetaConnectionDAO.deleteConnections(conns.map((c) => c.id));
  return { revoked, deleted, imagesRemoved };
}

/** In-app Disconnect. */
export async function disconnectUser(userId: string) {
  const conn = await MetaConnectionDAO.getByUser(userId);
  const code = newConfirmationCode();
  const req = await MetaConnectionDAO.createDeletionRequest({
    confirmationCode: code, source: 'user_disconnect', metaUserId: conn?.metaUserId ?? null, userId,
  });
  if (!conn) {
    await MetaConnectionDAO.finishDeletionRequest(req.id, 'no_data', {});
    return { deleted: 0, confirmationCode: code };
  }
  try {
    const result = await purge([conn], { revoke: true });
    await MetaConnectionDAO.finishDeletionRequest(req.id, 'completed', result);
    metaLog.info('disconnected', { userId, ...result });
    return { deleted: result.deleted, confirmationCode: code };
  } catch (err) {
    await MetaConnectionDAO.finishDeletionRequest(req.id, 'failed', { message: (err as Error).message });
    throw err;
  }
}

/** Meta data-deletion callback (user removed the app and asked for deletion). */
export async function handleMetaDeletionRequest(metaUserId: string) {
  const code = newConfirmationCode();
  const conns = await MetaConnectionDAO.findByMetaUserId(metaUserId);
  const req = await MetaConnectionDAO.createDeletionRequest({
    confirmationCode: code, source: 'meta_callback', metaUserId, userId: conns[0]?.userId ?? null,
  });
  try {
    if (!conns.length) {
      await MetaConnectionDAO.finishDeletionRequest(req.id, 'no_data', {});
    } else {
      const result = await purge(conns, { revoke: false });
      await MetaConnectionDAO.finishDeletionRequest(req.id, 'completed', result);
    }
  } catch (err) {
    await MetaConnectionDAO.finishDeletionRequest(req.id, 'failed', { message: (err as Error).message });
    metaLog.error('deletion_failed', { message: (err as Error).message });
  }
  return code;
}

/** Deauthorize callback: the app was removed. Drop tokens; keep nothing usable. */
export async function handleMetaDeauthorize(metaUserId: string) {
  const conns = await MetaConnectionDAO.findByMetaUserId(metaUserId);
  const req = await MetaConnectionDAO.createDeletionRequest({
    confirmationCode: newConfirmationCode(), source: 'deauthorize', metaUserId, userId: conns[0]?.userId ?? null,
  });
  await MetaConnectionDAO.revokeTokens(conns.map((c) => c.id));
  await MetaConnectionDAO.finishDeletionRequest(req.id, conns.length ? 'completed' : 'no_data', { connections: conns.length });
}
