/**
 * Local-First Draft Persistence & Offline Submission Manager using IndexedDB + LocalStorage Fallback.
 * Ensures student writing and submissions survive browser crashes, refreshes, tab closes, and network outages.
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

export interface ActiveExamState {
  key: string;            // `exam_state_${taskId}_${studentId}`
  taskId: string;
  studentId: string;
  activeTab: 'task1' | 'task2';
  task1Content: string;
  task2Content: string;
  content: string;
  startedAtMs: number;
  expiresAtMs: number;
  pasteAttemptCount: number;
  suspiciousBurstFlag: boolean;
  updatedAt: number;
  isPendingSyncSubmission?: boolean;
  pendingOperationId?: string;
}

export interface PendingSubmission {
  operationId: string;    // Unique Idempotency ID (e.g. `sub_pending_${taskId}_${studentId}_${timestamp}_${random}`)
  taskId: string;
  studentId: string;
  content: string;
  task1Content?: string | null;
  task2Content?: string | null;
  task1WordCount?: number;
  task2WordCount?: number;
  wordCount: number;
  pasteAttemptCount: number;
  suspiciousBurstFlag: boolean;
  status: 'submitted';
  submittedAtLocal: number; // local_submission_created_at (ms)
  startedAtMs: number;      // exam_started_at (ms)
  expiresAtMs: number;      // exam_expires_at (ms)
  activeTab: 'task1' | 'task2';
  isMock: boolean;
  synced: boolean;
}

const DB_NAME = 'IELTSWritingDraftsDB';
const DB_VERSION = 2;
const STORE_NAME = 'drafts';
const EXAM_STATE_STORE = 'exam_state';
const PENDING_STORE = 'pending_submissions';

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
      if (!db.objectStoreNames.contains(EXAM_STATE_STORE)) {
        db.createObjectStore(EXAM_STATE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'operationId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============== LOCAL DRAFT MANAGER ==============

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

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(draftRecord);
  } catch (e) {
    console.warn('IndexedDB write warning, using localStorage fallback:', e);
  }

  try {
    localStorage.setItem(key, JSON.stringify(draftRecord));
  } catch (e) {
    console.warn('LocalStorage write warning:', e);
  }
}

export async function getLocalDraft(taskId: string, studentId: string): Promise<LocalDraft | null> {
  const key = `draft_${taskId}_${studentId}`;

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

// ============== ACTIVE EXAM STATE MANAGER ==============

export async function saveActiveExamState(state: Omit<ActiveExamState, 'key' | 'updatedAt'>): Promise<void> {
  const key = `exam_state_${state.taskId}_${state.studentId}`;
  const record: ActiveExamState = {
    ...state,
    key,
    updatedAt: Date.now(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction(EXAM_STATE_STORE, 'readwrite');
    const store = tx.objectStore(EXAM_STATE_STORE);
    store.put(record);
  } catch (e) {
    console.warn('IndexedDB exam state write warning:', e);
  }

  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    console.warn('LocalStorage exam state write warning:', e);
  }
}

export async function getActiveExamState(taskId: string, studentId: string): Promise<ActiveExamState | null> {
  const key = `exam_state_${taskId}_${studentId}`;

  try {
    const db = await openDB();
    const tx = db.transaction(EXAM_STATE_STORE, 'readonly');
    const store = tx.objectStore(EXAM_STATE_STORE);
    const req = store.get(key);

    const record = await new Promise<ActiveExamState | null>((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (record) return record;
  } catch (e) {
    console.warn('IndexedDB exam state read warning:', e);
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as ActiveExamState;
  } catch (e) {
    console.warn('LocalStorage exam state read error:', e);
  }

  return null;
}

export async function clearActiveExamState(taskId: string, studentId: string): Promise<void> {
  const key = `exam_state_${taskId}_${studentId}`;

  try {
    const db = await openDB();
    const tx = db.transaction(EXAM_STATE_STORE, 'readwrite');
    const store = tx.objectStore(EXAM_STATE_STORE);
    store.delete(key);
  } catch (e) {
    console.warn('IndexedDB exam state delete error:', e);
  }

  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('LocalStorage exam state delete error:', e);
  }
}

// ============== OFFLINE PENDING SUBMISSION MANAGER ==============

export async function savePendingSubmission(pending: PendingSubmission): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_STORE);
    store.put(pending);
  } catch (e) {
    console.warn('IndexedDB pending submission write warning:', e);
  }

  try {
    const key = `pending_sub_${pending.taskId}_${pending.studentId}`;
    localStorage.setItem(key, JSON.stringify(pending));
  } catch (e) {
    console.warn('LocalStorage pending submission write warning:', e);
  }
}

export async function getPendingSubmissions(studentId?: string): Promise<PendingSubmission[]> {
  const list: PendingSubmission[] = [];

  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, 'readonly');
    const store = tx.objectStore(PENDING_STORE);
    const req = store.getAll();

    const items = await new Promise<PendingSubmission[]>((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (items && items.length > 0) {
      return studentId ? items.filter(i => i.studentId === studentId && !i.synced) : items.filter(i => !i.synced);
    }
  } catch (e) {
    console.warn('IndexedDB pending read warning:', e);
  }

  // LocalStorage Fallback scan
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pending_sub_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as PendingSubmission;
          if (!parsed.synced && (!studentId || parsed.studentId === studentId)) {
            list.push(parsed);
          }
        }
      }
    }
  } catch (e) {
    console.warn('LocalStorage pending scan error:', e);
  }

  return list;
}

export async function markPendingSubmissionSynced(operationId: string, taskId: string, studentId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_STORE);
    store.delete(operationId);
  } catch (e) {
    console.warn('IndexedDB pending delete error:', e);
  }

  try {
    const key = `pending_sub_${taskId}_${studentId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('LocalStorage pending delete error:', e);
  }
}
