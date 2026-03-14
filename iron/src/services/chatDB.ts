// IndexedDB cache for chat messages — persists across page reloads.
// Messages are keyed by their Django id and indexed by conversation_id.

const DB_NAME      = 'ironbuddy_chat';
const DB_VERSION   = 1;
const MSG_STORE    = 'messages';

export interface CachedMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  file_url?: string;
  file_type?: string;
  file_name?: string;
  created_at: string;
}

// ── Internal DB open ──────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const store = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
        store.createIndex('by_conversation', 'conversation_id', { unique: false });
      }
    };

    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Bulk-write messages for a conversation (upsert). */
export async function saveMessages(conversationId: number, messages: CachedMessage[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(MSG_STORE, 'readwrite');
    const store = tx.objectStore(MSG_STORE);
    for (const msg of messages) {
      store.put({ ...msg, conversation_id: conversationId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Load all cached messages for a conversation, sorted by created_at. */
export async function getMessages(conversationId: number): Promise<CachedMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(MSG_STORE, 'readonly');
    const index = tx.objectStore(MSG_STORE).index('by_conversation');
    const req   = index.getAll(IDBKeyRange.only(conversationId));
    req.onsuccess = () =>
      resolve(
        (req.result as CachedMessage[]).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    req.onerror = () => reject(req.error);
  });
}

/** Upsert a single message into the cache. */
export async function addMessage(message: CachedMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MSG_STORE, 'readwrite');
    tx.objectStore(MSG_STORE).put(message);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
