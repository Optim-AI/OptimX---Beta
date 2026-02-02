// app/hooks/useChats.tsx
import { useEffect, useState, useCallback } from 'react';
import { saveChatLocally, getChatLocal, getAllChatsLocal, deleteChatLocal, enqueueSync, drainSyncQueue } from '../lib/chatDB';
import { supabase } from '../lib/supabaseClient'; // your client-side supabase
import { v4 as uuidv4 } from 'uuid';

type Chat = {
  id: string;
  title?: string | null;
  messages: any[];
  client_version?: string | null;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
  consent_for_training?: boolean;
};

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    try {
      const all = await getAllChatsLocal();
      // ensure a stable shape
      const arr = (all || []).map((c: any) => ({ ...c, id: c.id || uuidv4() }));
      setChats(arr);
    } catch (e) {
      console.warn('loadLocal error', e);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocal();
    // attempt background drain on mount
    (async () => {
      try {
        await setupBackgroundDrain();
      } catch (e) {
        /* ignore */
      }
    })();
  }, [loadLocal]);

  // get current access token helper
  async function getAccessToken(): Promise<string | null> {
    try {
      const s = await supabase.auth.getSession();
      const session = (s as any)?.data?.session ?? null;
      if (!session) return null;
      return session.access_token || session.accessToken || session.provider_token || null;
    } catch (e) {
      return null;
    }
  }

  // server sync function used by drain queue
  async function syncItemToServer(item: any): Promise<boolean> {
    try {
      const token = await getAccessToken();
      if (!token) {
        // no auth -> keep in queue
        return false;
      }
      const resp = await fetch('/api/chats/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(item),
      });
      if (!resp.ok) {
        console.error('sync to server failed', await resp.text());
        return false;
      }
      const json = await resp.json();
      if (json?.ok && json.chat) {
        // update local canonical copy
        await saveChatLocally(json.chat.id, json.chat);
        // reload local list
        await loadLocal();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('syncItemToServer error', e);
      return false;
    }
  }

  async function setupBackgroundDrain() {
    // attempt a one-time drain
    await drainSyncQueue(syncItemToServer);
    // also drain when online
    window.addEventListener('online', () => {
      drainSyncQueue(syncItemToServer).catch((e) => console.warn('drain on online failed', e));
    });
  }

  // Create a new chat (local + queue for server)
  async function createChat(title?: string | null, initialMessages: any[] = [], consent_for_training = false) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const chat: Chat = {
      id,
      title: title ?? `Chat ${new Date().toLocaleString()}`,
      messages: initialMessages,
      client_version: 'v1',
      created_at: now,
      updated_at: now,
      synced: false,
      consent_for_training,
    };
    await saveChatLocally(id, chat);
    // enqueue sync payload (server expects messages array + other fields)
    await enqueueSync({
      chatId: id,
      title: chat.title,
      messages: chat.messages,
      client_version: chat.client_version,
      consent_for_training: chat.consent_for_training,
    });
    setChats((c) => [chat, ...c]);
    // attempt immediate drain
    drainSyncQueue(syncItemToServer).catch(() => {});
    return chat;
  }

  // Update existing chat locally and enqueue sync
  async function updateChat(id: string, updates: Partial<Chat>) {
    const local = await getChatLocal(id);
    if (!local) throw new Error('Chat not found');
    const merged = { ...local, ...updates, updated_at: new Date().toISOString() };
    await saveChatLocally(id, merged);
    await enqueueSync({
      chatId: id,
      title: merged.title,
      messages: merged.messages,
      client_version: merged.client_version,
      consent_for_training: merged.consent_for_training,
    });
    // reload local list
    const all = await getAllChatsLocal();
    setChats(all);
    // try immediate drain
    drainSyncQueue(syncItemToServer).catch(() => {});
  }

  // Delete chat locally (and attempt server delete by upserting a tombstone? For now just delete local + enqueue server delete not implemented)
  async function removeChat(id: string) {
    await deleteChatLocal(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    // optionally: call server delete endpoint (not provided here). Use service API if needed.
  }

  // Force sync all local chats to server (useful for UI button)
  async function syncAll() {
    await drainSyncQueue(syncItemToServer);
    await loadLocal();
  }

  return {
    chats,
    loading,
    createChat,
    updateChat,
    removeChat,
    syncAll,
  };
}
