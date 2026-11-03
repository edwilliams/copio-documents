# Copio Documents

<div align="center">
  <img style="margin: 0 auto; max-width: 512px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" src="https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F4eb7cf55-5d05-497a-8745-9002f292c32a_512x512.png" alt="Copio Documents Logo" />

  <h3>The Private, Offline-First Document Scanner & Manager</h3>

  <p><i>A reference web application showcasing Copio — capture, enhance, organise, and export multi-page documents 100% in your browser with zero cloud dependencies.</i></p>

  <div>
    <img src="https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen?style=for-the-badge&logo=shield" alt="100% Local Privacy" />
    <img src="https://img.shields.io/badge/Offline-First-blue?style=for-the-badge&logo=pwa" alt="Offline First" />
    <img src="https://img.shields.io/badge/Sync-Peer--to--Peer%20WebRTC-purple?style=for-the-badge&logo=webrtc" alt="P2P Sync" />
    <img src="https://img.shields.io/badge/Platform-PWA%20%7C%20Android%20TWA-3ddc84?style=for-the-badge&logo=android" alt="PWA and Android TWA" />
    <img src="https://img.shields.io/badge/Built%20with-Lit%20%2B%20TinyBase-orange?style=for-the-badge&logo=lit" alt="Built with Lit & TinyBase" />
  </div>
</div>

<br/>

---

## 🌟 About Copio Documents

**Copio Documents** is a production-grade showcase and reference web application built with **Copio** (`@copio/sdk`).

While Copio provides the underlying modular engine, embeddable Web Components, and headless services for document scanning, OCR, and storage, **Copio Documents** demonstrates how these capabilities come together into a full-featured, zero-server document management application.

Whether you are digitising receipts, assembling multi-page document archives, extracting text with on-device OCR, or taking Markdown notes alongside your scans — Copio Documents illustrates how Copio delivers the power of a desktop document suite directly in the browser with **zero cloud servers, zero user accounts, and zero data tracking**.

> 📖 **Read the Story:** Learn about the vision and evolution of Copio in [Ed Williams' Substack post](https://edwilliams.substack.com/p/copio). Originally built in React in 2019, Copio was completely rebuilt in 2026 using Web Components (Lit) and TinyBase for ultimate performance and zero framework overhead.

---

## 🔥 Features Showcased

Copio Documents serves as a living demonstration of Copio's core capabilities:

- 🔒 **100% Private & Serverless**: All documents and pages remain strictly on your local device. Data is persisted reactively in browser IndexedDB via TinyBase.
- ⚡ **Works 100% Offline**: Full Service Worker caching (`sw.js`) pre-caches application assets. Once loaded, the entire app functions without an internet connection.
- 🔤 **Client-Side OCR (Text Recognition)**: Extract text from photos and scans using WebAssembly (Tesseract.js WASM) in background Web Workers with zero cloud uploads and multi-language support.
- 🔄 **Direct Peer-to-Peer Sync**: Transfer documents directly between your phone, tablet, and computer over WebRTC Data Channels using instant QR code pairing — no intermediate server storage.
- 📷 **Smart Ingestion & Capture**: Snap photos directly via device cameras with automatic EXIF orientation correction. Import existing images (`.jpg`, `.png`), multi-page PDF documents (`.pdf`), or Markdown files (`.md`).
- 🎨 **Pro-Grade Page Enhancements**: Interactive cropping (Cropper.js), 360° rotation, and a Sauvola **Black & White Threshold filter** that converts shadowed photos into clean, high-contrast document scans.
- 📑 **Hybrid Documents**: Combine camera photos, scanned document pages, extracted PDF pages, and rich Markdown notes in a single unified document container.
- 📤 **Client-Side PDF & ZIP Export**: Compile multi-page documents into standardized A4 PDFs or download page bundles as a ZIP archive directly in the browser using client-side PDFKit and JSZip.
- 📱 **Installable Everywhere**: Install as a Progressive Web App (PWA) on iOS, Android, and desktop, or deploy as a native Android Trusted Web Activity (TWA) APK.

---

## 🛠️ Application Feature Breakdown

### 📷 1. Ingestion & Capture
- **Live Camera Capture**: Snap photos of documents directly within the browser interface.
- **EXIF Auto-Correction**: Automatically detects and corrects orientation from image EXIF metadata.
- **Multi-Format Ingestion**: Upload images (`.jpg`, `.png`), multi-page PDF documents (`.pdf`), or Markdown notes (`.md`, `.markdown`, `.txt`).
- **PDF Page Extraction**: Client-side rendering of PDF pages into editable document pages via PDF.js.

### 🔤 2. Client-Side OCR & Text Extraction
- **On-Device Text Recognition**: Powered by Tesseract.js WebAssembly executing in background Web Workers to maintain smooth UI responsiveness.
- **Single Page & Batch OCR**: Extract text from individual pages or batch-process multi-page documents with live progress tracking.
- **Convert to Markdown Note**: Transform any scanned document page into an editable Markdown note with one click.
- **Multi-Language Support**: Pre-cached English language model, with on-demand loading for French, German, Spanish, Italian, Portuguese, and more.
- **Export & Copy**: Copy extracted text with recognition confidence scores or save as `.txt` / `.md`.

### ✂️ 3. Editing & Page Enhancement
- **Interactive Cropping**: Adjust scan boundaries with touch-friendly crop handles.
- **Orientation Adjustment**: Rotate individual pages in 90° increments.
- **Black & White Filter**: Sauvola thresholding cleans shadows and background noise for print-ready text documents.
- **Drag-to-Reorder**: Reorder pages effortlessly using touch and mouse drag-and-drop.
- **Metadata Inspector**: Inspect EXIF data, dimensions, and image properties on demand.

### 📝 4. Hybrid Notes & Markdown Integration
- **Embedded Markdown Notes**: Colocate rich text notes and reference documents together.
- **Full-Screen Carousel Viewer**: Review multi-page scans and rendered Markdown side-by-side.
- **In-App Markdown Editor**: Create and edit notes directly inside any document container.

### 🔄 5. Serverless Peer-to-Peer Sync
- **WebRTC Data Channels**: Pair devices directly using PeerJS.
- **Instant QR Pairing**: Scan a QR code on your desktop or laptop with your mobile phone to connect instantly.
- **Zero Cloud Intermediaries**: End-to-end device transfer ensures document privacy.

### 📤 6. Client-Side Export
- **PDF Compilation**: Generate formatted multi-page A4 PDFs with proper margins and resolution handling via PDFKit.
- **ZIP Bundling**: Package all raw or enhanced pages into a compressed ZIP file using JSZip.
- **Markdown Export**: Export markdown notes as standalone `.md` files.

---

## 🏗️ Architecture & How It Uses Copio

Copio Documents is designed as an offline-first single-page application built on top of the **Copio** architecture:

```
copio-documents/
├── index.html                  # PWA application entry point
├── manifest.webmanifest        # Web App Manifest
├── sw.js                       # Service Worker for offline asset precaching
├── css/                        # Shoelace styling, container queries, Cropper CSS
├── js/
│   ├── components/             # Global shell components (copio-app, copio-header, copio-loader)
│   ├── routes/                 # Feature views (home row, editor, carousel viewer, OCR, sync, add/edit)
│   ├── adapters/               # Driven ports: Storage (IndexedDB, Memory), OCR, PDF, Sync
│   ├── services/               # Headless domain services (DocRepository, SyncService, OcrService)
│   └── core/                   # Store, hash router, component registry
└── vendor/                     # Vendored @copio/sdk runtime bundle (vendor/copio.0.1.2.js)
```

### Key Architectural Principles
- **No Build Step Runtime**: The production web app runs pure vanilla ES modules directly in modern browsers without requiring bundlers or transpilation at runtime.
- **Hexagonal Architecture**: Business logic and domain state are isolated in headless services (`DocRepository`, `SyncManager`) and communicate with driven adapters (`StoragePort`, `OcrPort`, `PdfPort`, `SyncPort`).
- **Light DOM Web Components**: Custom elements extend Lit with `createRenderRoot() { return this; }` to enable seamless styling with Shoelace design tokens and container queries.
- **Pluggable Persistence**: The default `IndexedDbStorageAdapter` automatically syncs state with IndexedDB via TinyBase, keeping documents persistent and reactive across sessions.

---

## 🧰 Tech Stack

| Library / Tech | Purpose |
|---|---|
| 🧱 **[Lit](https://lit.dev)** | Web Components base class & reactive templating |
| 🗃️ **[TinyBase](https://tinybase.org)** | Reactive data store with auto-persisted IndexedDB storage |
| 🔤 **[Tesseract.js](https://tesseract.projectnaptha.com/)** | Client-side WebAssembly Optical Character Recognition (OCR) |
| 🎨 **[Shoelace](https://shoelace.style)** | Accessible UI component library (dialogs, icons, buttons) |
| ✂️ **[Cropper.js](https://fengyuanchen.github.io/cropperjs/)** | Touch-friendly interactive image crop and rotation |
| 📄 **[PDFKit](https://pdfkit.org)** | In-browser client-side PDF document compiler |
| 📡 **[PeerJS](https://peerjs.com)** | WebRTC peer-to-peer data transport layer |
| 📷 **[Exifr](https://mutiny.cz/exifr/)** | High-performance EXIF image metadata parser |
| 🔀 **[Sortable.js](https://sortablejs.github.io/Sortable/)** | Touch & mouse drag-and-drop page reordering |
| 📱 **[Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)** | Full offline asset caching & progressive web app shell |

---

## 🚀 Getting Started

### 📖 Using the Web App
1. **Create a Document**: Click the **+** floating action button and enter a title for your document.
2. **Add Content**: Tap the capture button to snap photos with your camera, upload images, import PDFs, or create Markdown notes.
3. **Enhance & Reorder**: Select any page thumbnail to crop, rotate, apply black & white threshold filters, or edit notes. Drag thumbnails to reorder pages.
4. **Run OCR**: Tap the OCR action on any image page to extract text, inspect confidence metrics, or convert to a Markdown note.
5. **Export**: Use the document action menu to download as a multi-page PDF, a ZIP archive, or Markdown files.
6. **Sync Devices**: Tap **Link another device** in the top menu to generate a QR code for direct P2P sync with another phone or computer.

---

### 💻 Developer Setup

#### Prerequisites
- **Node.js** (v18+ recommended — needed for running the test suite and linter).
- A static HTTP/HTTPS server or `localhost` (HTTPS is required for Service Worker activation on non-localhost hosts).

#### Installation
```bash
# Clone the repository
git clone https://github.com/edwilliams/copio-documents.git
cd copio-documents

# Install dependencies (test runner and linter)
npm install
```

#### Run Locally
Serve the repository root with any static web server:

```bash
# Using npx serve
npx serve .

# Or using Python 3
python3 -m http.server 3000
```

Open `http://localhost:3000` in your web browser.

#### Running Tests & CI Checks
```bash
# Run the complete CI verification suite locally
npm run check:ci

# Or run tests directly
npm test
```

---

## 📱 Mobile & PWA Installation

### 📲 Progressive Web App (PWA)
Open Copio Documents in any mobile browser (Safari on iOS, Chrome on Android/Desktop) and choose **Add to Home Screen** or **Install App**. The app installs locally and operates 100% offline.

### 🤖 Android Trusted Web Activity (TWA)
Copio Documents can be built into a standalone native Android APK shell using [Bubblewrap](https://developer.chrome.com/docs/android/trusted-web-activity/):

```bash
# Install Bubblewrap CLI globally
npm install -g @bubblewrap/cli

# Navigate to TWA directory
mkdir copio-twa && cd copio-twa

# Generate Android project from PWA manifest
bubblewrap update --skipVersionUpgrade

# Build signed APK
BUBBLEWRAP_KEYSTORE_PASSWORD=<your-password> \
BUBBLEWRAP_KEY_PASSWORD=<your-password> \
bubblewrap build
```

The resulting `app-release-signed.apk` can be installed directly on Android devices.

---

## 🔒 Privacy & Security Guarantee

- **Zero Remote Storage**: All document data, photos, and notes remain inside your browser's local `IndexedDB`.
- **Zero Analytics or Telemetry**: No tracking scripts, analytics cookies, or remote logging.
- **Direct WebRTC Sync**: P2P sync transmits data directly between paired devices with end-to-end data channels.

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome! Feel free to open an issue or submit a pull request on GitHub.

---

## 📄 License

Copio Documents is open-source software licensed under the [MIT License](LICENSE).
