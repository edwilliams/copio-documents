import { expect } from '@esm-bundle/chai';
import { createMergeableStore } from '../js/lib/tinybase.6.5.2.js';
import { createMergeableIndexedDbPersister } from '../js/adapters/storage/indexeddb-persister.js';

describe('createMergeableIndexedDbPersister', () => {
  it('preserves deletion tombstones across save and load in IndexedDB', async () => {
    const dbName = 'test-crdt-db-' + Date.now();
    const store1 = createMergeableStore('s1');
    const store3 = createMergeableStore('s3');

    // Both stores have doc1 initially
    store1.setRow('docs', 'doc1', { name: 'Receipt', pages: '[]' });
    store3.merge(store1);
    expect(store3.hasRow('docs', 'doc1')).to.be.true;

    // store1 deletes doc1
    store1.delRow('docs', 'doc1');

    // store1 is persisted to IndexedDB
    const persister1 = createMergeableIndexedDbPersister(store1, dbName);
    await persister1.save();

    // Now reload into store2 from IndexedDB
    const store2 = createMergeableStore('s2');
    const persister2 = createMergeableIndexedDbPersister(store2, dbName);
    await persister2.load();

    expect(store2.hasRow('docs', 'doc1')).to.be.false;
    // Check that tombstone exists!
    const mergeableContent = JSON.stringify(store2.getMergeableContent());
    expect(mergeableContent).to.include('doc1');

    // Merge store2 (which has the tombstone) into store3
    store3.merge(store2);
    // doc1 must be deleted on store3!
    expect(store3.hasRow('docs', 'doc1')).to.be.false;

    persister1.destroy();
    persister2.destroy();
  });

  it('migrates legacy docs from t table when m is empty', async () => {
    const dbName = 'test-legacy-db-' + Date.now();
    // Simulate legacy store creating 't' object store
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('t', { keyPath: 'k' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise((resolve) => {
      const tx = db.transaction(['t'], 'readwrite');
      tx.objectStore('t').put({ k: 'docs', v: { old1: { name: 'Legacy Doc', pages: '[]' } } });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });

    const store = createMergeableStore('s');
    const persister = createMergeableIndexedDbPersister(store, dbName);
    await persister.load();

    expect(store.hasRow('docs', 'old1')).to.be.true;
    expect(store.getCell('docs', 'old1', 'name')).to.equal('Legacy Doc');

    persister.destroy();
  });
});
