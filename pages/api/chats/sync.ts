// pages/api/chats/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ChatDAO } from '@/database';

type ReqBody = {
  action?: 'create' | 'list' | 'update' | 'rename' | 'delete';
  chatId?: string | null;
  title?: string | null;
  messages?: any[]; // array of {role, content, imageUrl?, meta?}
  client_version?: string | null;
  consent_for_training?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const body = req.body as ReqBody;
    const action = body.action || 'create';

    // Handle different actions
    switch (action) {
      case 'list': {
        const chats = await ChatDAO.findByUserId(userId);
        return res.status(200).json({ ok: true, chats });
      }

      case 'delete': {
        if (!body.chatId) {
          return res.status(400).json({ ok: false, error: 'chatId required for delete' });
        }
        await ChatDAO.delete(body.chatId);
        return res.status(200).json({ ok: true });
      }

      case 'rename': {
        if (!body.chatId || !body.title) {
          return res.status(400).json({ ok: false, error: 'chatId and title required for rename' });
        }
        const result = await ChatDAO.upsert(body.chatId, userId, 'user', '[]', { title: body.title });
        return res.status(200).json({ ok: true, chat: result });
      }

      case 'update': {
        if (!body.chatId || !body.messages || !Array.isArray(body.messages)) {
          return res.status(400).json({ ok: false, error: 'chatId and messages array required for update' });
        }
        const messageData = {
          role: body.messages[0]?.role || 'user',
          message: JSON.stringify(body.messages),
          metadata: {
            title: body.title,
            messagesCount: body.messages.length,
          },
        };
        const result = await ChatDAO.upsert(body.chatId, userId, messageData.role, messageData.message, messageData.metadata);
        return res.status(200).json({ ok: true, chat: result });
      }

      case 'create':
      default: {
        if (!body.messages || !Array.isArray(body.messages)) {
          return res.status(400).json({ ok: false, error: 'Invalid body: messages array required' });
        }
        // Create message data
        const messageData = {
          role: body.messages[0]?.role || 'user',
          message: JSON.stringify(body.messages),
          metadata: {
            title: body.title || 'New Chat',
            client_version: body.client_version,
            consent_for_training: !!body.consent_for_training,
            messagesCount: body.messages.length,
          },
        };

        // Upsert by id if chatId provided, else insert new
        let result: any;
        if (body.chatId) {
          result = await ChatDAO.upsert(body.chatId, userId, messageData.role, messageData.message, messageData.metadata);
        } else {
          result = await ChatDAO.create(userId, messageData.role, messageData.message, messageData.metadata);
        }

        return res.status(200).json({ ok: true, chat: result });
      }
    }
  } catch (err: any) {
    console.error('chats/sync error', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
