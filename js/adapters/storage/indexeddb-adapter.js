import { StoragePort } from './storage-port.js';
import { store as defaultStore, persister as defaultPersister } from '../../core/store.js';
import { createMergeableStore } from '../../lib/tinybase.6.5.2.js';
import { createMergeableIndexedDbPersister } from './indexeddb-persister.js';

/**
 * IndexedDbStorageAdapter — TinyBase IndexedDB implementation of StoragePort (CPO-033).
 *
 * Wraps TinyBase and IndexedDbPersister behind the StoragePort contract, ensuring
 * existing database data ('copio-db') is preserved while isolating storage mechanics.
 */
export class IndexedDbStorageAdapter extends StoragePort {
  #store = null;
  #persister = null;
  #dbName = 'copio-db';
  #isCustom = false;

  /**
   * @param {Object} [options]
   * @param {any} [options.store] - Optional TinyBase store instance
   * @param {any} [options.persister] - Optional TinyBase persister instance
   * @param {string} [options.dbName] - Custom IndexedDB database name
   */
  constructor(options = {}) {
    super();

    if (options.dbName && options.dbName !== 'copio-db') {
      this.#dbName = options.dbName;
      this.#store = options.store || createMergeableStore();
      this.#store.setTable('docs', {});
      this.#persister = options.persister || createMergeableIndexedDbPersister(this.#store, this.#dbName);
      this.#isCustom = true;
    } else {
      this.#store = options.store || defaultStore;
      this.#persister = options.persister || defaultPersister;
      this.#dbName = 'copio-db';
    }
  }

  get store() {
    return this.#store;
  }

  get persister() {
    return this.#persister;
  }

  /**
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    if (this.#isCustom) {
      await this.#persister.load();
      this.#persister.startAutoLoad();
      this.#persister.startAutoSave();
    } else {
      // Load stored data from IndexedDB
      await this.#persister.load();
    }

    return {
      kind: 'indexeddb',
      persistent: true,
    };
  }

  /**
   * Returns list of all stored documents synchronously from the TinyBase cache.
   * @returns {Array<{ id: string, name: string, pages: any[] }>}
   */
  listDocsSync() {
    const table = this.#store.getTable('docs');
    return Object.entries(table || {}).map(([id, row]) => ({
      id,
      name: row.name || '',
      pages: this.#parsePages(row.pages),
    }));
  }

  /**
   * Returns list of all stored documents.
   * @returns {Promise<Array<{ id: string, name: string, pages: any[] }>>}
   */
  async listDocs() {
    return this.listDocsSync();
  }

  /**
   * Retrieves a document by its ID synchronously from the TinyBase cache.
   * @param {string} id
   * @returns {{ id: string, name: string, pages: any[] } | null}
   */
  getDocSync(id) {
    if (!this.#store.hasRow('docs', id)) {
      return null;
    }

    const row = this.#store.getRow('docs', id);
    return {
      id,
      name: row.name || '',
      pages: this.#parsePages(row.pages),
    };
  }

  /**
   * Retrieves a document by its ID.
   * @param {string} id
   * @returns {Promise<{ id: string, name: string, pages: any[] } | null>}
   */
  async getDoc(id) {
    return this.getDocSync(id);
  }

  /**
   * Saves or updates a document.
   * @param {string} id
   * @param {import('./storage-port.js').DocRow} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (!id) throw new Error('Cannot save document without an ID');

    const pages = Array.isArray(doc.pages)
      ? doc.pages
      : this.#parsePages(doc.pages);

    this.#store.setRow('docs', id, {
      name: doc.name || '',
      pages: JSON.stringify(pages),
    });
  }

  /**
   * Deletes a document.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    this.#store.delRow('docs', id);
  }

  /**
   * Saves page data for a document.
   * @param {string} docId
   * @param {string} pageId
   * @param {any} blobOrData
   * @returns {Promise<void>}
   */
  async savePage(docId, pageId, blobOrData) {
    const doc = await this.getDoc(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const idx = doc.pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) {
      if (typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)) {
        doc.pages[idx] = { ...doc.pages[idx], ...blobOrData };
      } else {
        doc.pages[idx] = { ...doc.pages[idx], src: blobOrData };
      }
    } else {
      const pageObj =
        typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)
          ? { id: pageId, ...blobOrData }
          : { id: pageId, src: blobOrData };
      doc.pages.push(pageObj);
    }

    await this.saveDoc(docId, doc);
  }

  /**
   * Retrieves page data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<any>}
   */
  async getPage(docId, pageId) {
    const doc = await this.getDoc(docId);
    if (!doc) return null;
    const page = doc.pages.find((p) => p.id === pageId);
    return page ? (page.src ?? page) : null;
  }

  /**
   * Deletes page data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(docId, pageId) {
    const doc = await this.getDoc(docId);
    if (!doc) return;
    doc.pages = doc.pages.filter((p) => p.id !== pageId);
    await this.saveDoc(docId, doc);
  }

  /**
   * Subscribes to document changes via TinyBase table listener.
   * @param {() => void} cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(cb) {
    const listenerId = this.#store.addTableListener('docs', cb);
    return () => {
      this.#store.delListener(listenerId);
    };
  }

  #parsePages(rawPages) {
    if (Array.isArray(rawPages)) return rawPages;
    if (typeof rawPages === 'string') {
      try {
        return JSON.parse(rawPages);
      } catch {
        return [];
      }
    }
    return [];
  }
}
