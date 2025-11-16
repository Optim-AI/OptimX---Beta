// app/libs/chatDB.ts
// Client-side IndexedDB helpers for chats + sync queue

const DB_NAME = 'optim-app-db';
const CHATS_STORE = 'chats';
const QUEUE_STORE = 'sync_queue';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHATS_STORE)) db.createObjectStore(CHATS_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveChatLocally(key: string, chatObj: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readwrite');
    tx.objectStore(CHATS_STORE).put(chatObj, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getChatLocal(key: string): Promise<any | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readonly');
    const req = tx.objectStore(CHATS_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getAllChatsLocal(): Promise<any[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readonly');
    const req = tx.objectStore(CHATS_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteChatLocal(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readwrite');
    tx.objectStore(CHATS_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Sync queue helpers
export async function enqueueSync(payload: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    tx.objectStore(QUEUE_STORE).put(payload, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function drainSyncQueue(syncFn: (item: any) => Promise<boolean>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = async (ev: any) => {
      const cur = ev.target.result;
      if (!cur) { db.close(); resolve(); return; }
      const item = cur.value;
      try {
        const ok = await syncFn(item);
        if (ok) {
          cur.delete();
          cur.continue();
        } else {
          // server unavailable or auth error — stop processing for now
          db.close();
          resolve();
        }
      } catch (e) {
        console.warn('drainSyncQueue item sync error', e);
        db.close();
        resolve();
      }
    };

    cursorReq.onerror = () => { db.close(); reject(cursorReq.error); };
  });
}
