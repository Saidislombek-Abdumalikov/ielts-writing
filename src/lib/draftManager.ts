/**
 * Local-First Draft Persistence Manager using IndexedDB + LocalStorage Fallback.
 * Ensures student writing survives browser crashes, refreshes, tab closes, and network outages.
 */

export interface LocalDraft {
  key: string;            // `draft_${taskId}_${studentId}`
  taskId: string;
  studentId: string;
  content: string;
  wordCount: number;
  updatedAt: number;     // Date.now() timestamp
  syncedWithServer: boolean;
}

const DB_NAME = 'IELTSWritingDraftsDB';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalDraft(taskId: string, studentId: string, content: string, syncedWithServer = false): Promise<void> {
  const key = `draft_${taskId}_${studentId}`;
  const now = Date.now();
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  
  const draftRecord: LocalDraft = {
    key,
    taskId,
    studentId,
    content,
    wordCount,
    updatedAt: now,
    syncedWithServer,
  };

  // 1. Primary Write: IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(draftRecord);
  } catch (e) {
    console.warn('IndexedDB write warning, using localStorage fallback:', e);
  }

  // 2. Secondary Redundant Backup: LocalStorage
  try {
    localStorage.setItem(key, JSON.stringify(draftRecord));
  } catch (e) {
    console.warn('LocalStorage write warning:', e);
  }
}

export async function getLocalDraft(taskId: string, studentId: string): Promise<LocalDraft | null> {
  const key = `draft_${taskId}_${studentId}`;

  // 1. Try IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);

    const record = await new Promise<LocalDraft | null>((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (record) return record;
  } catch (e) {
    console.warn('IndexedDB read warning, checking localStorage fallback:', e);
  }

  // 2. Fallback to LocalStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as LocalDraft;
    }
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }

  return null;
}

export async function clearLocalDraft(taskId: string, studentId: string): Promise<void> {
  const key = `draft_${taskId}_${studentId}`;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
  } catch (e) {
    console.warn('IndexedDB delete error:', e);
  }

  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('LocalStorage delete error:', e);
  }
}
