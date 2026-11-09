/**
 * Draft operations, run in the background:
 *  - edit by description or by boxed area → a NEW free draft next to the original (pay only if kept)
 *  - extra size for a KEPT poster → same design in another format, charged 1 credit when it comes out
 */
import { randomUUID } from 'crypto';
import { CreditsDAO } from '@/database';
import { normalizeBox, editPosterArea, type AreaBox } from '@/lib/creative-studio/area-edit';
import { getDefaultPosterImageProvider } from '@/lib/creative-studio/poster-generation/generation/provider-router';
import { runPosterIterationForSession } from '@/lib/creative-studio/poster-generation/iteration/run-for-session';
import { renderDraftInFormat } from '@/lib/content-studio/engine-posters';
import { metaLog } from '@/lib/meta/log';
import { AD_FORMATS, isAdFormat, type AdFormat } from './options';
import { draftsLeftToday } from './limits';
import { storeDraftImage, previewPathFor, DRAFT_BUCKET } from './storage';
import { AdStudioError, keepDrafts } from './service';
import * as store from './store';
import type { DraftAngle } from './why';

export type DraftOp =
  | { kind: 'edit'; draftId: string; parentId: string; instruction: string; box: AreaBox | null }
  | { kind: 'format'; draftId: string; parentId: string; format: AdFormat };

const generationIdFromPath = (p: string) => p.split('/').pop()!.replace(/\.[a-z]+$/i, '');

async function creditsOf(userId: string) {
  return (await CreditsDAO.getFullBalance(userId))?.imageCredits.total ?? 0;
}

/** Validate an edit request and create the pending draft row. */
export async function requestEdit(userId: string, projectId: string, parentId: string, input: { instruction: unknown; box?: unknown }): Promise<DraftOp> {
  const instruction = typeof input.instruction === 'string' ? input.instruction.trim().slice(0, 500) : '';
  if (instruction.length < 3) throw new AdStudioError('Say what to change, for example “make the product bigger” or “change the text to Diwali special”.');
  const box = input.box ? normalizeBox(input.box as Partial<AreaBox>) : null;
  if (input.box && !box) throw new AdStudioError('That area is too small. Drag a bigger box.');
  const project = await store.getProject(userId, projectId);
  const parent = await store.getDraft(userId, projectId, parentId);
  if (!project || !parent) throw new AdStudioError('Not found', 404);
  if (parent.status !== 'ready' || !parent.storagePath || !parent.sessionId) throw new AdStudioError('This poster can’t be edited.', 409);
  if (draftsLeftToday(await store.draftsLast24h(userId, project.productSlug)) < 1) {
    throw new AdStudioError('You’ve made the most free drafts for this product today. Come back tomorrow to edit more.', 429, 'DAILY_LIMIT');
  }
  const [row] = await store.insertDrafts([{
    projectId, userId, round: parent.round, position: parent.position, format: parent.format,
    angle: { ...(parent.angle as DraftAngle) }, parentDraftId: parent.id, kind: 'edit', status: 'drawing',
  }]);
  return { kind: 'edit', draftId: row.id, parentId: parent.id, instruction, box };
}

/** Validate an extra-size request for a kept poster and create the pending draft row. */
export async function requestFormat(userId: string, projectId: string, parentId: string, format: unknown): Promise<DraftOp> {
  if (!isAdFormat(format)) throw new AdStudioError('Choose a size.');
  const parent = await store.getDraft(userId, projectId, parentId);
  if (!parent) throw new AdStudioError('Not found', 404);
  if (!parent.kept || !parent.sessionId) throw new AdStudioError('Keep this poster first, then add other sizes.', 409);
  if (parent.format === format) throw new AdStudioError('This poster is already that size.');
  const siblings = (await store.listDrafts(projectId)).filter((d) => d.parentDraftId === parent.id && d.kind === 'format' && d.format === format && d.status !== 'failed');
  if (siblings.length) throw new AdStudioError('That size is already made or on its way.', 409, 'EXISTS');
  if ((await creditsOf(userId)) < 1) throw new AdStudioError('You need 1 image credit for another size.', 402, 'INSUFFICIENT_CREDITS');
  const [row] = await store.insertDrafts([{
    projectId, userId, round: parent.round, position: parent.position, format,
    angle: { ...(parent.angle as DraftAngle) }, parentDraftId: parent.id, kind: 'format', status: 'drawing',
  }]);
  return { kind: 'format', draftId: row.id, parentId: parent.id, format };
}

type Deps = {
  describe?: typeof runPosterIterationForSession;
  area?: (input: { poster: Buffer; box: AreaBox; instruction: string; userId: string }) => Promise<Buffer>;
  format?: typeof renderDraftInFormat;
  download?: (path: string) => Promise<Buffer>;
};

async function downloadDraft(path: string): Promise<Buffer> {
  const { supabaseAdmin } = await import('@/auth/supabase/admin');
  const { data, error } = await supabaseAdmin.storage.from(DRAFT_BUCKET).download(path);
  if (error || !data) throw new Error(`Could not read the poster: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function runDraftOp(op: DraftOp, deps: Deps = {}) {
  const draft = await store.getDraftById(op.draftId);
  const parent = await store.getDraftById(op.parentId);
  if (!draft || !parent || !parent.sessionId || !parent.storagePath) {
    if (draft) await store.updateDraft(draft.id, { status: 'failed', error: 'The original poster is missing.' });
    return { ok: false };
  }
  try {
    if (op.kind === 'edit') {
      let storagePath: string;
      let sessionId = parent.sessionId;
      if (op.box) {
        const poster = await (deps.download ?? downloadDraft)(parent.storagePath);
        const edited = await (deps.area ?? ((i) => editPosterArea({ ...i, provider: getDefaultPosterImageProvider() })))({ poster, box: op.box, instruction: op.instruction, userId: draft.userId });
        storagePath = (await storeDraftImage({ userId: draft.userId, sessionId, generationId: `edit-${randomUUID()}`, buffer: edited, contentType: 'image/png' })).storagePath;
      } else {
        const res = await (deps.describe ?? runPosterIterationForSession)({
          sessionId: parent.sessionId, userId: draft.userId, generationId: generationIdFromPath(parent.storagePath), request: op.instruction,
          storeImage: storeDraftImage, credits: { getBalance: async () => 1, deduct: async () => true },
        });
        if (!res.asset?.storagePath) throw new Error('The edit didn’t come out right.');
        storagePath = res.asset.storagePath;
        sessionId = res.session.id;
      }
      await store.updateDraft(draft.id, { status: 'ready', sessionId, storagePath, previewPath: previewPathFor(storagePath), error: null });
      return { ok: true };
    }

    const out = await (deps.format ?? renderDraftInFormat)({
      userId: draft.userId, sourceSessionId: parent.sessionId, aspectRatio: AD_FORMATS[op.format].aspect, storeImage: storeDraftImage,
    });
    if (!out.ok) {
      await store.updateDraft(draft.id, { status: 'failed', sessionId: out.sessionId, error: `${out.error} No credit was used.` });
      return { ok: false };
    }
    await store.updateDraft(draft.id, { status: 'ready', sessionId: out.sessionId, storagePath: out.storagePath, previewPath: previewPathFor(out.storagePath) });
    // The owner asked for this size: charge 1 credit now (atomic; if credits ran out it stays a draft they can keep later).
    try {
      await keepDrafts(draft.userId, draft.projectId, [draft.id]);
    } catch (err) {
      metaLog.warn('ad_studio_format_not_kept', { draftId: draft.id, message: (err as Error).message });
    }
    return { ok: true };
  } catch (err) {
    await store.updateDraft(draft.id, { status: 'failed', error: `${((err as Error).message || 'Something went wrong').slice(0, 200)} No credit was used.` });
    metaLog.error('ad_studio_draft_op_failed', { draftId: draft.id, kind: op.kind, message: (err as Error).message });
    return { ok: false };
  }
}
