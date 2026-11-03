# Copio Documents — Architecture Guide

> For developers and AI assistants getting up to speed. Complements `README.md` (user-facing) with the *how* and *why* of the codebase.

---

## Mental Model

Copio Documents is an offline-first **single-page web application with no runtime build step**. Every file you see is what the browser runs. There is no runtime TypeScript compilation, no bundler, no JSX transform. The `js/lib/` folder contains pre-built third-party bundles; everything else is vanilla ES modules authored directly.

The app is offline-first: the Service Worker caches every asset at install time. Any new file added to the project **must** be added to `files-to-cache.json` and the `CACHE_NAME` version bumped in `sw.js`.

---

## Folder Structure

```
js/
  adapters/           Driven (Outbound) ports & implementations (Hexagonal)
    storage/
      storage-port.js         StoragePort contract interface
      indexeddb-adapter.js    IndexedDbStorageAdapter (TinyBase + IndexedDB)
      memory-adapter.js       MemoryStorageAdapter (in-memory for tests/ephemeral)
      index.js                createDefaultAdapter() factory

  core/               Singletons & infrastructure
    store.js          TinyBase store + IndexedDB persister instance
    router.js         Hash-based SPA router singleton
    register-components.js  Entry point: imports all components, waits for CE definitions

  components/         Global shell components (not tied to a specific route)
    copio-app.js      Root orchestrator — owns routing, docRepo bridge, event handling
    copio-header.js   Top nav bar
    copio-loader.js   Full-screen loading spinner

  routes/             One folder per route; components live where they're used
    home/
      copio-row.js          Document list row (/ home view)
    doc/
      copio-images.js       Page editor / image ingestion (/doc/:id/edit)
      copio-carousel.js     Full-screen viewer (/doc/:id)
    ocr/
      copio-doc-ocr-dialog.js  OCR dialog (/doc/:id + OCR action)
    sync/
      copio-sync-dialog.js  P2P sync dialog (/sync, /sync/:peer)
    add-edit/
      copio-add-edit-dialog.js  Add / edit document dialog (/add, /doc/:id/edit)

  services/           Headless business logic (no rendering)
    doc-repository.js Headless document repository (CPO-014)
    sync-service.js   PeerJS WebRTC session management
    ocr-service.js    Tesseract.js worker lifecycle + batch OCR
    export-utils.js   PDF (PDFKit), ZIP (JSZip), Markdown export

  utils/              Pure functions, no side-effects
    utils.js          randomId, fileToBase64, thresholdSrc (Sauvola binarization),
                      rotateSrc, getCroppedSrc, extractExif
    pdf-utils.js      Renders PDF pages to data URLs via PDF.js
    module-loader.js  Dynamic lazy ES module and asset loaders (CPO-031)

  lib/                Third-party pre-built bundles — do not edit
```

---

## Core Patterns

### 1. No Shadow DOM

Every Lit component uses:
```js
createRenderRoot() { return this; }
```
This opts into **Light DOM** so Shoelace's global CSS custom properties and `sl-*` components work without crossing shadow boundaries. This is intentional and should be preserved on any new component.

### 2. Headless DocRepository & Pluggable StoragePort (CPO-014, CPO-033)

Components and routes **never** import or touch the persistence layer (`store.js`) directly. All document persistence, lifecycle mutations, and reactive subscriptions flow through the headless `DocRepository` singleton (`js/services/doc-repository.js`).

`DocRepository` delegates data persistence to a pluggable **`StoragePort`** driven adapter:
- **`IndexedDbStorageAdapter`** (`js/adapters/storage/indexeddb-adapter.js`): Default browser adapter wrapping TinyBase IndexedDB persistence (`copio-db`).
- **`MemoryStorageAdapter`** (`js/adapters/storage/memory-adapter.js`): Pure in-memory storage for headless Node test suites, temporary scan sessions, and server-side environments.
- **`createDefaultAdapter()`** (`js/adapters/storage/index.js`): Factory selecting IndexedDB in browser runtimes and Memory in Node / test harnesses.

### 3. Data model

Documents are manipulated as domain objects with parsed pages:
```js
// Document domain object
{
  id: "doc-abc123",
  name: "My Document",       // string
  pages: [ ... ]             // Array of Page objects
}
```

Each page object:
```js
// Image page
{ id, src, exif, type: 'image'|'pdf', name }

// Markdown page
{ id, type: 'markdown', name, content }
```

In the persistence layer (`IndexedDbStorageAdapter`), `pages` is stored as a JSON string within the TinyBase `docs` table to keep the schema flat. Serialization and deserialization are **100% encapsulated inside `DocRepository` and `IndexedDbStorageAdapter`**; no UI component ever calls `JSON.parse` or `JSON.stringify` on document pages.

### 4. Router

`js/core/router.js` exports a `SimpleRouter` singleton (`router`). It's hash-based (`#/doc/abc123`). Routes are named:

| Name | Path |
|---|---|
| `home` | `/` |
| `add` | `/add` |
| `doc-view` | `/doc/:id` |
| `doc-edit` | `/doc/:id/edit` |
| `sync-host` | `/sync` |
| `sync-join` | `/sync/:peer` |

Navigate programmatically: `router.navigate('/doc/abc123')`.
Subscribe to changes: `router.onRouteChange(({ name, params }) => ...)` — returns an unsubscribe function.

`copio-app.js` is the only subscriber. Route changes are handled in `#handleRouteChange()` which delegates to other components via their imperative APIs (e.g. `dialog.open()`, `dialog.openEdit()`).

### 5. Component communication

Components communicate **upward via custom events**, **downward via properties/methods**:

- `copio-row` fires `doc:edit`, `doc:view`, `doc:delete`, `doc:rename`, etc. → `copio-app` handles them
- `copio-add-edit-dialog` fires `dialog:save` with `{ id, name, pages }` and `dialog:close` → `copio-app` handles them
- `copio-sync-dialog` fires `dialog:close` → `copio-app` calls `syncManager.close()`
- `copio-doc-ocr-dialog` fires `note:save` → `copio-app` appends a markdown page to the doc
- `copio-header` fires `header:link-device`, `header:clear-cache` → `copio-app` handles them

All custom events use `{ bubbles: true, composed: false }` and follow the clean domain event convention (`doc:*`, `dialog:*`, `note:*`, `header:*`) as specified in CPO-036.

### 6. TinyBase → Lit reactivity bridge

TinyBase is not Lit-aware. The bridge in `copio-app.js` constructor:
```js
this.store.addTableListener('docs', () => {
  this.docsData = this.store.getTable('docs'); // triggers Lit re-render
  if (router.getHashPath().startsWith('/doc/')) {
    router.handleRoute(); // re-run route if viewing a doc (pages may have changed)
  }
});
```

### 7. Offline / Service Worker

`sw.js` uses a **cache-first** strategy. On install it fetches `files-to-cache.json` and caches every listed asset atomically via `cache.addAll()` (all-or-nothing). If any file 404s, the install fails and nothing is cached.

**Rules when changing files:**
- Every new JS/CSS/asset file → add to `files-to-cache.json`
- Every deploy → bump `CACHE_NAME` version in `sw.js` (e.g. `copio-cache-v14`)
- `"/"` and `"index.html"` are both listed (cover both root URL forms)

---

## Entry Point Flow

```
index.html
  └── <script type="module" src="js/core/register-components.js">
        ├── imports all copio-*.js components (self-register via customElements.define)
        ├── awaits Promise.allSettled([customElements.whenDefined(...)]) for all sl-* and copio-*
        └── document.body.classList.add('ready')  ← triggers CSS fade-in, hides loader
```

`copio-app` is mounted as `<copio-app>` in `index.html`. Its `firstUpdated()` lifecycle hook kicks off data loading and routing.

---

## Hexagonal Architecture & Driven Ports

Copio Documents separates business logic from platform infrastructure:
1. **Core Domain Services**: Headless services like `DocRepository` and `SyncService` encapsulate document state, mutations, reordering, and session management.
2. **Driven (Outbound) Ports**: Defined port contracts for storage (`StoragePort`), OCR (`OcrPort`), image processing (`ImageProcessorPort`), and sync (`SyncPort`).
3. **Pluggable Adapters**: Concrete implementations such as `IndexedDbStorageAdapter` (TinyBase in browser), `MemoryStorageAdapter` (in-memory for headless tests), and `PeerJsSyncAdapter`.

### `StoragePort` Contract
The storage port interface (`js/adapters/storage/storage-port.js`) defines the driven contract for data storage:

```ts
interface StoragePort {
  init(): Promise<{ kind: string; persistent: boolean }>;
  listDocs(): Promise<DocRow[]>;
  getDoc(id: string): Promise<DocRow | null>;
  saveDoc(id: string, doc: DocRow): Promise<void>;
  deleteDoc(id: string): Promise<void>;
  savePage(docId: string, pageId: string, blobOrData: any): Promise<void>;
  getPage(docId: string, pageId: string): Promise<any>;
  deletePage(docId: string, pageId: string): Promise<void>;
  subscribe?(cb: () => void): () => void;
}
```

#### Custom Storage Adapter Example
A custom backend adapter (e.g. S3, Supabase, or REST API) can implement `StoragePort` and be injected into `DocRepository`:

```js
import { StoragePort } from './storage-port.js';

export class CustomCloudStorageAdapter extends StoragePort {
  async init() {
    return { kind: 'custom-cloud', persistent: true };
  }

  async listDocs() {
    const res = await fetch('/api/documents');
    return res.json();
  }

  async getDoc(id) {
    const res = await fetch(`/api/documents/${id}`);
    if (res.status === 404) return null;
    return res.json();
  }

  async saveDoc(id, doc) {
    await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
  }

  async deleteDoc(id) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
  }

  async savePage(docId, pageId, blobOrData) {
    // Custom binary upload (e.g. presigned S3 URL)
  }

  async getPage(docId, pageId) {
    // Custom binary fetch
  }

  async deletePage(docId, pageId) {
    // Custom binary delete
  }
}
```

---

## Key Third-Party Libraries

| Library | How it's used | Loaded as |
|---|---|---|
| **Lit** (`lit-core.min.js`) | Base class for all components | ES module |
| **TinyBase** | Reactive store + IndexedDB persistence | ES module |
| **Shoelace** | UI components (`sl-dialog`, `sl-button`, etc.) | ES module (auto-registers) |
| **Tesseract.js** | OCR via WASM Web Worker | Lazy dynamic loader (`loadTesseract()`) |
| **PDFKit** | Client-side PDF generation | Lazy dynamic loader (`loadPdfKit()`) |
| **PDF.js** | Renders uploaded PDFs to images | ES module |
| **PeerJS** | WebRTC for P2P sync | Lazy dynamic loader (`loadPeerJs()`) |
| **Cropper.js** | Interactive image crop UI | Lazy dynamic loader (`loadCropper()`) |
| **JSZip** | ZIP bundle export | Lazy dynamic loader (`loadJsZip()`) |
| **Sortable.js** | Drag-to-reorder pages | ES module |
| **qrcode** | QR code generation for sync URL | Lazy dynamic loader (`loadQrCode()`) |

`index.html` contains zero third-party classic `<script>` tags. Heavy dependencies (Tesseract, PDFKit, JSZip, PeerJS, Cropper, marked, qrcode) are loaded on demand via `js/utils/module-loader.js`. All worker, WASM, and asset paths resolve via a configurable `assetBase` (`setAssetBase()`, `resolveAssetUrl()`).

---

## Adding a New Route

1. Create `js/routes/your-route/copio-your-component.js` — a Lit component with `createRenderRoot() { return this; }`
2. Add the route to `ROUTES` in `js/core/router.js`
3. Handle the new route `name` in `copio-app.js` `#handleRouteChange()`
4. Import the component in `js/core/register-components.js` and add to the `whenDefined` list
5. Add the file path to `files-to-cache.json`
6. Bump `CACHE_NAME` in `sw.js`

## Adding a New Utility / Service

- **Pure function** (no DOM, no side-effects) → `js/utils/utils.js` or a new file in `js/utils/`
- **Stateful service** (manages a worker, connection, etc.) → new file in `js/services/`
- Services can import from utils; utils must not import from services

---

## Gotchas

- **`pages` is always a JSON string in the store** — parse before use, stringify before saving
- **Shoelace dialogs are async** — `await dialog.show()` before trying to focus inputs
- **OCR workers are long-lived** — `ocr-service.js` caches the active Tesseract worker; switching language terminates and recreates it
- **P2P sync requires internet** — PeerJS needs its signalling server; `sync-service.js` checks `navigator.onLine` before attempting
- **Worker & WASM asset paths** resolve via `resolveAssetUrl()` in `js/utils/module-loader.js` relative to the configurable `assetBase` (defaulting to `.`)

---

## Deployment & Feature Branches

- **Main Branch**: `master` is deployed directly to production on Netlify.
- **Feature Branches & Deploy Previews**: Work on tickets should be pushed to dedicated feature branches (`feature/<name>`) with a GitHub Pull Request. Netlify automatically creates an ephemeral **Deploy Preview** URL (e.g. `https://deploy-preview-<PR_NUMBER>--copio-documents.netlify.app`) for each PR.

