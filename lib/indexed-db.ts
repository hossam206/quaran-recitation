/**
 * Lightweight IndexedDB wrapper for mistake history storage.
 * Falls back gracefully if IndexedDB is unavailable (e.g., incognito mode).
 */

const DB_NAME = "murattil";
const DB_VERSION = 1;
const STORE_MISTAKES = "mistakes";
const STORE_SESSIONS = "sessions";

export interface MistakeRecord {
  id?: number;
  surah: number;
  ayah: number;
  wordIndex: number;
  expectedWord: string;
  spokenWord?: string;
  timestamp: number;
  sessionId: string;
}

export interface SessionRecord {
  id?: number;
  surah: number;
  startedAt: number;
  completedAt?: number;
  accuracy: number;
  totalWords: number;
  errorCount: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MISTAKES)) {
          const mistakeStore = db.createObjectStore(STORE_MISTAKES, {
            keyPath: "id",
            autoIncrement: true,
          });
          mistakeStore.createIndex("surah", "surah", { unique: false });
          mistakeStore.createIndex("sessionId", "sessionId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, {
            keyPath: "id",
            autoIncrement: true,
          });
          sessionStore.createIndex("surah", "surah", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    } catch {
      dbPromise = null;
      reject(new Error("IndexedDB not available"));
    }
  });

  return dbPromise;
}

async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  } catch {
    return null;
  }
}

// ── Mistakes ──

export async function saveMistakes(mistakes: MistakeRecord[]): Promise<void> {
  const store = await getStore(STORE_MISTAKES, "readwrite");
  if (!store) return;
  for (const m of mistakes) {
    store.add(m);
  }
}

export async function getMistakesBySurah(surah: number): Promise<MistakeRecord[]> {
  const store = await getStore(STORE_MISTAKES, "readonly");
  if (!store) return [];

  return new Promise((resolve) => {
    const index = store.index("surah");
    const request = index.getAll(surah);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function getAllMistakes(): Promise<MistakeRecord[]> {
  const store = await getStore(STORE_MISTAKES, "readonly");
  if (!store) return [];

  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

// ── Sessions ──

export async function saveSession(session: SessionRecord): Promise<number | null> {
  const store = await getStore(STORE_SESSIONS, "readwrite");
  if (!store) return null;

  return new Promise((resolve) => {
    const request = store.add(session);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => resolve(null);
  });
}

export async function getSessionsBySurah(surah: number): Promise<SessionRecord[]> {
  const store = await getStore(STORE_SESSIONS, "readonly");
  if (!store) return [];

  return new Promise((resolve) => {
    const index = store.index("surah");
    const request = index.getAll(surah);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const store = await getStore(STORE_SESSIONS, "readonly");
  if (!store) return [];

  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}
