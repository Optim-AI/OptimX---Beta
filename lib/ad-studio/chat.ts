/**
 * "Tell SkalX what you want": a short chat that turns the owner's words into a creative
 * direction for the next round (which then re-runs the research with it). Stateless: the
 * browser sends the conversation; the server adds the project context.
 */
import * as z from 'zod/v4';
import { geminiStructured, aiConfigured, type StructuredClient } from '@/lib/ai/structured';
import { getUserBrand } from '@/lib/brand-kit/server';
import { metaLog } from '@/lib/meta/log';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import { AD_FORMATS, AD_GOALS, type AdFormat, type AdGoal } from './options';
import type { DraftAngle } from './why';
import * as store from './store';
import { AdStudioError } from './service';

export const MAX_TURNS = 12;
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const ChatReplySchema = z.object({
  reply: z.string().describe('What SkalX says back: 1-3 short, warm sentences in simple English. If something is unclear, ask ONE question.'),
  direction: z.string().describe('The full creative direction for the next batch of posters so far, as short instructions (what to show, mood, text, who it is for, what to avoid). Combine everything the owner said in this chat. Empty if nothing yet.'),
  ready: z.boolean().describe('True when the direction is clear enough to make posters.'),
});
export type ChatReply = z.infer<typeof ChatReplySchema>;

export const CHAT_SYSTEM = `You are SkalX's friendly creative assistant inside Ad Studio. You help a small business owner (often 40-60, not a marketer) say what they want from their poster ads. SkalX will then research and draw new posters from what you write in "direction".

- Keep replies short and plain. Never use marketing jargon.
- Ask at most one question at a time, only if needed.
- Never promise results, prices, discounts or claims that the owner didn't give you. If they mention an offer, repeat it exactly in the direction.
- You can't change posters directly; the owner presses "Make posters with this" to get new ones.
- If the owner asks for something unsafe, misleading or about a different product, say so kindly and steer back.`;

function sanitize(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
}

export async function chatTurn(userId: string, projectId: string, rawMessages: unknown, deps: { client?: StructuredClient } = {}): Promise<ChatReply> {
  const messages = sanitize(rawMessages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new AdStudioError('Type a message first.');
  // Count the whole conversation before anything is trimmed, so the cap can't be bypassed.
  if (messages.filter((m) => m.role === 'user').length > MAX_TURNS) throw new AdStudioError('This chat is getting long — press “Make posters with this”, or start a new chat.', 429, 'CHAT_LIMIT');
  if (messages.length > MAX_TURNS * 2) throw new AdStudioError('This chat is getting long — press “Make posters with this”, or start a new chat.', 429, 'CHAT_LIMIT');

  const project = await store.getProject(userId, projectId);
  if (!project) throw new AdStudioError('Not found', 404);
  const product = project.product as Product;
  const [{ snapshot }, drafts] = await Promise.all([getUserBrand(userId).catch(() => ({ snapshot: null })), store.listDrafts(project.id)]);
  const context = {
    brand: snapshot ? { name: snapshot.name, tone: snapshot.tone, audience: snapshot.audience } : null,
    product: { name: product.product_name, price: product.price, description: product.description?.slice(0, 300), benefit: product.short_benefit },
    goal: AD_GOALS[project.goal as AdGoal]?.label ?? project.goal,
    offer: project.offerDetails,
    formats: project.formats.map((f) => AD_FORMATS[f as AdFormat]?.label ?? f),
    earlier_direction: project.direction,
    posters_already_shown: drafts.filter((d) => d.kind === 'original').map((d) => ({ angle: (d.angle as DraftAngle).angle, kept: d.kept })).slice(-24),
  };

  if (!deps.client && !aiConfigured()) {
    throw new AdStudioError('The SkalX assistant isn’t set up yet. You can still type what you want in “None of these quite right?” below.', 503, 'NOT_CONFIGURED');
  }
  const client = deps.client ?? geminiStructured;
  const res = await client.generate({
    system: `${CHAT_SYSTEM}\n\nContext (JSON):\n${JSON.stringify(context)}`,
    messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    schema: ChatReplySchema, effort: 'low', maxTokens: 4000, timeoutMs: 60_000, label: 'ad-studio-chat',
  });
  if (res.stop === 'refusal') {
    return { reply: 'Sorry, I can’t help with that one. Tell me more about how you’d like the posters to look?', direction: '', ready: false };
  }
  const out = res.data;
  if (!out) throw new Error('Chat reply was not valid');
  metaLog.info('ad_studio_chat', { projectId, turns: messages.length, ready: out.ready, usage: res.usage });
  return { reply: out.reply.slice(0, 800), direction: out.direction.slice(0, 1000), ready: out.ready };
}
