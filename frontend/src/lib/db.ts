/**
 * Minimal promise-based IndexedDB wrapper. Everything TWOOLKIT remembers lives
 * here, in the user's own browser profile — nothing is synced to a server.
 *
 * Stores:
 *  - kv:      small JSON values (stats, settings snapshots, scan snapshot, dir handles)
 *  - blobs:   processed output files kept for the "Recent files" page
 *  - trash:   files moved to the in-app recycle bin (with restore metadata)
 */

const DB_NAME = "vellum";
const DB_VERSION = 1;
export type StoreName = "kv" | "blobs" | "trash";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ["kv", "blobs", "trash"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const idb = {
  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return tx<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>).catch(() => undefined);
  },
  set(store: StoreName, key: string, value: unknown): Promise<void> {
    return tx(store, "readwrite", (s) => s.put(value, key)).then(() => undefined);
  },
  del(store: StoreName, key: string): Promise<void> {
    return tx(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
  },
  keys(store: StoreName): Promise<string[]> {
    return tx(store, "readonly", (s) => s.getAllKeys()).then((k) => k.map(String)).catch(() => []);
  },
  clear(store: StoreName): Promise<void> {
    return tx(store, "readwrite", (s) => s.clear()).then(() => undefined);
  },
};

/** Estimate of the browser storage this origin uses (real numbers from the Storage API). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
