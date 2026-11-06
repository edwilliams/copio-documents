import { createMergeableStore } from '../lib/tinybase.6.5.2.js';
import { createMergeableIndexedDbPersister } from '../adapters/storage/indexeddb-persister.js';

export const store = createMergeableStore();
store.setTable('docs', {});

export const persister = createMergeableIndexedDbPersister(store, 'copio-db');
persister.startAutoLoad();
persister.startAutoSave();
