/**
 * IndexedDB persister for TinyBase createMergeableStore (CPO-033 / CRDT Sync).
 *
 * Persists the complete CRDT mergeable state (including Hybrid Logical Clock
 * timestamps and deletion tombstones) to IndexedDB object store 'm',
 * while mirroring table data to object store 't' for backward compatibility.
 */

function openDb(dbName = 'copio-db', version = 2) {
  return new Promise((resolve, reject) => {
    const idb = typeof window !== 'undefined' && window.indexedDB ? window.indexedDB : indexedDB;
    const req = idb.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('t')) {
        db.createObjectStore('t', { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains('v')) {
        db.createObjectStore('v', { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains('m')) {
        db.createObjectStore('m', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Creates an IndexedDB persister that saves and restores MergeableStore content
 * including CRDT tombstones and metadata.
 *
 * @param {any} store - TinyBase MergeableStore
 * @param {string} [dbName='copio-db']
 * @returns {any} Persister instance with load, save, startAutoSave, startAutoLoad
 */
export function createMergeableIndexedDbPersister(store, dbName = 'copio-db') {
  let saveTimer = null;
  let listenerId = null;
  let status = 0; // 0 = idle, 1 = loading, 2 = saving
  let loads = 0;
  let saves = 0;
  let isAutoLoading = false;

  const save = async () => {
    status = 2;
    saves++;
    try {
      const db = await openDb(dbName);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['m', 't'], 'readwrite');
        const mStore = tx.objectStore('m');
        const tStore = tx.objectStore('t');

        if (typeof store.getMergeableContent === 'function') {
          mStore.put({ k: 'crdt', v: store.getMergeableContent() });
        }
        if (typeof store.getTable === 'function') {
          tStore.put({ k: 'docs', v: store.getTable('docs') });
        }

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } finally {
      status = 0;
    }
  };

  const load = async () => {
    status = 1;
    loads++;
    try {
      const db = await openDb(dbName);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['m', 't'], 'readonly');
        const mStore = tx.objectStore('m');
        const tStore = tx.objectStore('t');

        const mReq = mStore.get('crdt');
        mReq.onsuccess = () => {
          if (mReq.result && mReq.result.v && typeof store.setMergeableContent === 'function') {
            store.setMergeableContent(mReq.result.v);
            db.close();
            resolve(true);
          } else {
            // Fallback to legacy 't' table
            const tReq = tStore.get('docs');
            tReq.onsuccess = () => {
              if (tReq.result && tReq.result.v && typeof store.setTable === 'function') {
                store.setTable('docs', tReq.result.v);
              }
              db.close();
              resolve(false);
            };
            tReq.onerror = () => {
              db.close();
              resolve(false);
            };
          }
        };
        mReq.onerror = () => {
          db.close();
          reject(mReq.error);
        };
      });
    } finally {
      status = 0;
    }
  };

  const startAutoSave = () => {
    stopAutoSave();
    if (typeof store.addDidFinishTransactionListener === 'function') {
      listenerId = store.addDidFinishTransactionListener(() => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          save().catch((err) => console.error('[Persister] Auto-save error:', err));
        }, 50);
      });
    }
  };

  const stopAutoSave = () => {
    if (listenerId && typeof store.delListener === 'function') {
      store.delListener(listenerId);
      listenerId = null;
    }
    clearTimeout(saveTimer);
  };

  return {
    save,
    load,
    startAutoSave,
    stopAutoSave,
    startAutoLoad: async () => {
      isAutoLoading = true;
      await load();
    },
    stopAutoLoad: () => {
      isAutoLoading = false;
    },
    isAutoSaving: () => listenerId !== null,
    isAutoLoading: () => isAutoLoading,
    getStatus: () => status,
    getStore: () => store,
    getStats: () => ({ loads, saves }),
    destroy: () => {
      stopAutoSave();
    },
  };
}
