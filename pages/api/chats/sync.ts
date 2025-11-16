// pages/api/chats/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

type ReqBody = {
  chatId?: string | null;
  title?: string | null;
  messages: any[]; // array of {role, content, imageUrl?, meta?}
  client_version?: string | null;
  consent_for_training?: boolean;
};

async function getUserIdFromBearer(req: NextApiRequest): Promise<string | null> {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer (.+)$/i);
    const token = m ? m[1] : null;
    if (!token) return null;

    // try modern supabase-js call shapes
    try {
      // some supabase versions accept getUser({ accessToken })
      const maybe = await (supabaseAdmin.auth as any).getUser?.({ accessToken: token });
      if (maybe && maybe.data && maybe.data.user) return maybe.data.user.id;
    } catch (e) {
      // ignore
    }

    try {
      // some versions accept getUser(token)
      const maybe2 = await (supabaseAdmin.auth as any).getUser?.(token);
      if (maybe2 && maybe2.data && maybe2.data.user) return maybe2.data.user.id;
    } catch (e) {
      // ignore
    }

    // Last resort: no user found
    return null;
  } catch (e) {
    console.warn('getUserIdFromBearer error', e);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromBearer(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const body = req.body as ReqBody;
    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ ok: false, error: 'Invalid body: messages array required' });
    }

    // sanitize/limit message size if needed here...
    const payload: any = {
      user_id: userId,
      title: body.title ?? null,
      messages: body.messages,
      client_version: body.client_version ?? null,
      consent_for_training: !!body.consent_for_training,
    };

    // Upsert by id if chatId provided, else insert new
    let result: any;
    if (body.chatId) {
      const { data, error } = await supabaseAdmin
        .from('user_chats')
        .upsert({ id: body.chatId, ...payload }, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin.from('user_chats').insert([payload]).select().single();
      if (error) throw error;
      result = data;
    }

    return res.status(200).json({ ok: true, chat: result });
  } catch (err: any) {
    console.error('chats/sync error', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
