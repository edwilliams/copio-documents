import { createDefaultAdapter } from '../adapters/storage/index.js';
import { randomId } from '../utils/utils.js';
import { createMergeableStore } from '../lib/tinybase.6.5.2.js';

/**
 * @typedef {Object} DocMetadata
 * @property {string} id - Document ID
 * @property {string} name - Document title
 * @property {number} pageCount - Number of pages in the document
 * @property {Array<any>} [pages] - Document pages
 */

/**
 * @typedef {Object} DocWithPages
 * @property {string} id - Document ID
 * @property {string} name - Document title
 * @property {Array<any>} pages - Document pages array
 */

/**
 * DocRepository — Headless Document Repository (Hexagonal Core / CPO-014).
 *
 * Encapsulates all document lifecycle and persistence logic behind a clean,
 * async API. Delegates storage to the configured StoragePort adapter and
 * eliminates direct store dependencies and JSON serialization from UI components.
 */
export class DocRepository {
  #adapter = null;
  #softDeletedDocs = new Map();
  #softDeletedPages = new Map();

  /**
   * @param {import('../adapters/storage/storage-port.js').StoragePort} [adapter]
   */
  constructor(adapter = createDefaultAdapter()) {
    this.#adapter = adapter;
  }

  /**
   * Underlying StoragePort adapter.
   */
  get adapter() {
    return this.#adapter;
  }

  /**
   * Backward-compatibility accessor for the underlying TinyBase store (if available).
   */
  get store() {
    return this.#adapter?.store ?? null;
  }

  /**
   * Initializes the repository and underlying storage adapter.
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    return this.#adapter.init();
  }

  /**
   * Lists all documents with metadata synchronously if supported by adapter.
   * @returns {DocMetadata[]}
   */
  listDocsSync() {
    if (typeof this.#adapter.listDocsSync === 'function') {
      const rows = this.#adapter.listDocsSync();
      return rows.map((row) => {
        const pages = this.#normalizePages(row.pages);
        return {
          id: row.id,
          name: row.name || '',
          pageCount: pages.length,
          pages,
        };
      });
    }
    return [];
  }

  /**
   * Lists all documents with metadata (id, name, pageCount, pages).
   * @returns {Promise<DocMetadata[]>}
   */
  async listDocs() {
    const rows = await this.#adapter.listDocs();
    return rows.map((row) => {
      const pages = this.#normalizePages(row.pages);
      return {
        id: row.id,
        name: row.name || '',
        pageCount: pages.length,
        pages,
      };
    });
  }

  /**
   * Retrieves a document with its parsed pages array synchronously if supported.
   * @param {string} id
   * @returns {DocWithPages|null}
   */
  getDocSync(id) {
    if (!id) return null;
    if (typeof this.#adapter.getDocSync === 'function') {
      const row = this.#adapter.getDocSync(id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name || '',
        pages: this.#normalizePages(row.pages),
      };
    }
    const docs = this.listDocsSync();
    const doc = docs.find((d) => d.id === id);
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      pages: doc.pages || [],
    };
  }

  /**
   * Retrieves a document with its parsed pages array.
   * Returns null if not found.
   * @param {string} id
   * @returns {Promise<DocWithPages|null>}
   */
  async getDoc(id) {
    return this.getDocSync(id);
  }

  /**
   * Creates a new document with an optional title and initial pages.
   * @param {string} [name='Untitled Document']
   * @param {Array<any>} [pages=[]]
   * @returns {Promise<DocWithPages>}
   */
  async createDoc(name = 'Untitled Document', pages = []) {
    const id = randomId();
    const normalizedPages = this.#normalizePages(pages);
    const doc = {
      id,
      name: name || 'Untitled Document',
      pages: normalizedPages,
    };

    await this.#adapter.saveDoc(id, doc);
    return doc;
  }

  /**
   * Saves or updates an existing document.
   * @param {string} id
   * @param {{ name?: string, pages?: any[] }} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (!id) throw new Error('Cannot save document without an ID');

    const normalizedPages = this.#normalizePages(doc.pages);
    await this.#adapter.saveDoc(id, {
      id,
      name: doc.name || '',
      pages: normalizedPages,
    });
  }

  /**
   * Renames a document.
   * @param {string} id
   * @param {string} name
   * @returns {Promise<void>}
   */
  async renameDoc(id, name) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    doc.name = name;
    await this.saveDoc(id, doc);
  }

  /**
   * Deletes a document with soft-delete undo support (CPO-016).
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.soft=true] - Whether to allow undo for timeoutMs
   * @param {number} [options.timeoutMs=5000] - Duration in ms before purging permanently
   * @returns {Promise<{ id: string, name: string, undo: () => Promise<any> }|void>}
   */
  async deleteDoc(id, { soft = true, timeoutMs = 5000 } = {}) {
    if (!id) return;
    const doc = this.getDocSync(id);
    if (!doc) return;

    this.#clearDocSoftDelete(id);
    await this.#adapter.deleteDoc(id);

    if (soft && timeoutMs > 0) {
      const timerId = setTimeout(async () => {
        this.#softDeletedDocs.delete(id);
      }, timeoutMs);

      this.#softDeletedDocs.set(id, {
        doc,
        timerId,
      });
    }

    return {
      id,
      name: doc.name,
      undo: () => this.undoDeleteDoc(id),
    };
  }

  #clearDocSoftDelete(id) {
    if (this.#softDeletedDocs.has(id)) {
      const entry = this.#softDeletedDocs.get(id);
      clearTimeout(entry.timerId);
      this.#softDeletedDocs.delete(id);
    }
  }

  /**
   * Restores a soft-deleted document back into the active store.
   * @param {string} id
   * @returns {Promise<DocWithPages|null>}
   */
  async undoDeleteDoc(id) {
    const entry = this.#softDeletedDocs.get(id);
    if (!entry) return null;

    clearTimeout(entry.timerId);
    this.#softDeletedDocs.delete(id);

    await this.#adapter.saveDoc(id, entry.doc);
    return entry.doc;
  }

  /**
   * Checks whether a document is currently in soft-delete state.
   * @param {string} id
   * @returns {boolean}
   */
  isSoftDeletedDoc(id) {
    return this.#softDeletedDocs.has(id);
  }

  /**
   * Appends pages to an existing document.
   * @param {string} id
   * @param {Array<any>|any} pages
   * @returns {Promise<void>}
   */
  async addPages(id, pages) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const toAdd = Array.isArray(pages) ? pages : [pages];
    doc.pages.push(...toAdd);
    await this.saveDoc(id, doc);
  }

  /**
   * Updates an individual page within a document.
   * @param {string} id
   * @param {string} pageId
   * @param {Record<string, any>} updates
   * @returns {Promise<void>}
   */
  async updatePage(id, pageId, updates) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const pageIndex = doc.pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) {
      throw new Error(`Page "${pageId}" not found in document "${id}"`);
    }

    doc.pages[pageIndex] = {
      ...doc.pages[pageIndex],
      ...updates,
    };

    await this.saveDoc(id, doc);
  }

  /**
   * Reorders pages in a document according to an array of page IDs.
   * Any pages omitted from pageIds will be appended at the end.
   * @param {string} id
   * @param {string[]} pageIds
   * @returns {Promise<void>}
   */
  async reorderPages(id, pageIds) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const pageMap = new Map(doc.pages.map((p) => [p.id, p]));
    const reordered = [];

    for (const pid of pageIds) {
      if (pageMap.has(pid)) {
        reordered.push(pageMap.get(pid));
        pageMap.delete(pid);
      }
    }

    // Retain any remaining pages
    for (const remaining of pageMap.values()) {
      reordered.push(remaining);
    }

    doc.pages = reordered;
    await this.saveDoc(id, doc);
  }

  /**
   * Deletes a page from a document with soft-delete undo support (CPO-016).
   * @param {string} id
   * @param {string} pageId
   * @param {Object} [options]
   * @param {boolean} [options.soft=true] - Whether to allow undo for timeoutMs
   * @param {number} [options.timeoutMs=5000] - Duration in ms before purging permanently
   * @returns {Promise<{ docId: string, pageId: string, undo: () => Promise<any> }|void>}
   */
  async deletePage(id, pageId, { soft = true, timeoutMs = 5000 } = {}) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const pageIndex = doc.pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) return;

    const [deletedPage] = doc.pages.splice(pageIndex, 1);
    await this.saveDoc(id, doc);

    const key = `${id}:${pageId}`;
    this.#clearPageSoftDelete(key);

    if (!soft || timeoutMs <= 0) {
      if (typeof this.#adapter.deletePage === 'function') {
        try {
          await this.#adapter.deletePage(id, pageId);
        } catch (err) {
          console.warn(`[DocRepository] Adapter deletePage error:`, err);
        }
      }
      return;
    }

    const timerId = setTimeout(async () => {
      this.#softDeletedPages.delete(key);
      if (typeof this.#adapter.deletePage === 'function') {
        try {
          await this.#adapter.deletePage(id, pageId);
        } catch (err) {
          console.warn(`[DocRepository] Adapter deletePage error:`, err);
        }
      }
    }, timeoutMs);

    this.#softDeletedPages.set(key, {
      docId: id,
      pageId,
      page: deletedPage,
      index: pageIndex,
      timerId,
    });

    return {
      docId: id,
      pageId,
      undo: () => this.undoDeletePage(id, pageId),
    };
  }

  #clearPageSoftDelete(key) {
    if (this.#softDeletedPages.has(key)) {
      const entry = this.#softDeletedPages.get(key);
      clearTimeout(entry.timerId);
      this.#softDeletedPages.delete(key);
    }
  }

  /**
   * Restores a soft-deleted page back into its parent document at its original index.
   * @param {string} id
   * @param {string} pageId
   * @returns {Promise<any|null>}
   */
  async undoDeletePage(id, pageId) {
    const key = `${id}:${pageId}`;
    const entry = this.#softDeletedPages.get(key);
    if (!entry) return null;

    clearTimeout(entry.timerId);
    this.#softDeletedPages.delete(key);

    const doc = await this.getDoc(id);
    if (!doc) return null;

    const insertIdx = Math.min(entry.index, doc.pages.length);
    doc.pages.splice(insertIdx, 0, entry.page);
    await this.saveDoc(id, doc);
    return entry.page;
  }

  /**
   * Checks whether a page is currently in soft-delete state.
   * @param {string} id
   * @param {string} pageId
   * @returns {boolean}
   */
  isSoftDeletedPage(id, pageId) {
    return this.#softDeletedPages.has(`${id}:${pageId}`);
  }

  /**
   * Subscribes to document updates in storage.
   * @param {() => void} cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(cb) {
    return this.#adapter.subscribe(cb);
  }

  /**
   * Returns all documents as a dictionary indexed by id.
   * @returns {Promise<Record<string, DocWithPages>>}
   */
  async getAllDocs() {
    const docs = await this.listDocs();
    const result = {};
    for (const doc of docs) {
      result[doc.id] = doc;
    }
    return result;
  }

  /**
   * Retrieves synchronization payload for wire transmission.
   * If underlying store is a MergeableStore, returns CRDT payload with tombstones.
   * Otherwise falls back to legacy table export.
   * @returns {Promise<{ type: string, content?: any, docs?: any }>}
   */
  async getSyncPayload() {
    const store = this.store;
    if (store && typeof store.isMergeable === 'function' && store.isMergeable()) {
      return {
        type: 'mergeable',
        content: store.getMergeableContent(),
      };
    }
    return {
      type: 'legacy',
      docs: await this.exportAll(),
    };
  }

  /**
   * Merges synchronization payload received over wire.
   * Supports both CRDT mergeable payloads and legacy document dictionaries.
   * @param {any} payload
   * @returns {Promise<number>} Count of newly added documents
   */
  async importSyncPayload(payload) {
    const store = this.store;
    if (
      payload?.type === 'mergeable' &&
      payload?.content &&
      store &&
      typeof store.isMergeable === 'function' &&
      store.isMergeable()
    ) {
      const prevDocIds = new Set((await this.listDocs()).map((d) => d.id));
      const incoming = createMergeableStore().setMergeableContent(payload.content);
      store.merge(incoming);
      const afterDocs = await this.listDocs();
      const added = afterDocs.filter((d) => !prevDocIds.has(d.id)).length;
      return added;
    }

    const docs = payload?.type === 'legacy' ? payload.docs : payload;
    return this.importDocs(docs);
  }

  /**
   * Exports all documents formatted for wire transmission (e.g. P2P sync).
   * @returns {Promise<Record<string, { name: string, pages: string }>>}
   */
  async exportAll() {
    const docs = await this.listDocs();
    const result = {};
    for (const doc of docs) {
      result[doc.id] = {
        name: doc.name,
        pages: JSON.stringify(doc.pages),
      };
    }
    return result;
  }

  /**
   * Imports multiple documents from wire/raw format (e.g. from P2P sync).
   * @param {Record<string, any>} docsMap
   * @returns {Promise<number>} Count of newly added documents
   */
  async importDocs(docsMap) {
    let added = 0;
    for (const [id, row] of Object.entries(docsMap || {})) {
      const existing = await this.getDoc(id);
      if (!existing) added++;

      const pages = this.#normalizePages(row.pages);
      await this.saveDoc(id, {
        name: row.name || '',
        pages,
      });
    }
    return added;
  }

  #normalizePages(rawPages) {
    if (Array.isArray(rawPages)) return [...rawPages];
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

/**
 * Singleton repository instance using default storage.
 */
export const docRepository = new DocRepository();
