# Copio Documents

<div align="center">
  <img style="margin: 0 auto; max-width: 512px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" src="https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F4eb7cf55-5d05-497a-8745-9002f292c32a_512x512.png" alt="Copio Logo" />

  <h3>The Private, Offline-First Document Scanner & Manager</h3>

  <p><i>Capture, enhance, organise, and export multi-page documents — 100% in your browser with zero cloud dependencies.</i></p>

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

## 🌟 Overview

**Copio** is a modern, lightweight, privacy-focused document scanning and document management application that runs entirely on your device.

Whether you're digitising paper receipts, creating multi-page document archives, importing existing PDFs, or taking Markdown notes alongside your scans — Copio gives you the full power of a desktop document management suite with **zero cloud servers, zero user accounts, and zero data tracking**.

> 📖 **Read the Story:** Learn about the vision and evolution of Copio in [Ed Williams' Substack post](https://edwilliams.substack.com/p/copio). Originally built in React in 2019, Copio was completely rebuilt in 2026 using Web Components (Lit) and TinyBase for ultimate performance and zero framework overhead.

---

## 🔥 Key Highlights

- 🔒 **100% Private & Serverless**: Your documents never leave your browser. Data is saved locally in IndexedDB using reactive storage.
- ⚡ **Works Everywhere Offline**: Service Worker pre-caches all assets. Load it once and use it forever without an internet connection.
- 🔤 **Client-Side OCR (Text Recognition)**: Extract text from scanned documents and images using WebAssembly (Tesseract.js WASM) with zero server uploads and multi-language support.
- 🔄 **Serverless Peer-to-Peer Sync**: Transfer documents directly between your phone, tablet, and laptop via WebRTC and instant QR code pairing — no cloud middleman.
- 📷 **Smart Camera & Ingestion**: Capture directly from your mobile or desktop camera with automatic EXIF orientation detection. Import existing images, multi-page PDFs, or Markdown files.
- 🎨 **Pro-Grade Page Enhancements**: Interactive precision cropping, 360° rotation, and a high-contrast **Black & White Threshold filter** for turning shadow-heavy photos into crisp scanned paper.
- 📑 **Hybrid Document Engine**: Combine camera scans, imported images, multi-page PDF pages, and Markdown notes seamlessly within a single document container.
- 📤 **Client-Side PDF & ZIP Export**: Convert your multi-page documents into clean A4 PDFs or download all pages as a ZIP bundle directly in the browser using WebAssembly and client-side PDFKit.
- 📱 **Native App Experience**: Install as a PWA on iOS, Desktop, and Android, or sideload the native-feeling Android Trusted Web Activity (TWA) APK.

---

## 🛠️ Features Breakdown

### 📷 1. Ingestion & Capture
- **Live Camera Capture**: Snap photos of documents directly within the web app.
- **EXIF Auto-Correction**: Automatic rotation detection based on image EXIF metadata.
- **Multi-Format Ingestion**: Upload images (`.jpg`, `.png`), multi-page PDF documents (`.pdf`), or Markdown files (`.md`, `.markdown`, `.txt`).
- **PDF Page Extraction**: Automatically renders uploaded PDF pages as editable document pages.

### 🔤 2. Client-Side OCR & Text Extraction
- **On-Device Text Recognition**: Powered by Tesseract.js WebAssembly running inside background Web Workers for smooth UI performance.
- **Per-Page & Full-Document OCR**: Extract text from single pages or batch-process entire multi-page documents with live progress indicators.
- **Convert to Markdown Note**: Turn any scanned page into an editable Markdown note with a single tap.
- **Multi-Language Support**: English pre-cached offline, with on-demand support for Spanish, French, German, Italian, Portuguese, Chinese, Japanese, and more.
- **One-Click Copy & Export**: Copy recognized text with confidence metrics or download as `.txt` / `.md`.

### ✂️ 3. Editing & Page Enhancement
- **Interactive Cropping**: Adjust boundaries easily using Cropper.js.
- **Rotation**: Rotate individual pages to correct orientation.
- **Black & White Filter**: Convert shaded photos into high-contrast document scans.
- **Drag-to-Reorder**: Reorder pages effortlessly using drag-and-drop.
- **Metadata Inspector**: View EXIF data and file properties on demand.

### 📝 4. Hybrid Markdown & Note Taking
- **Embedded Markdown Notes**: Mix text notes and document scans in the same document.
- **Live Markdown Previewer**: View rich rendered Markdown notes in a full-screen carousel viewer.
- **Markdown Text Editor**: Create and edit Markdown pages directly inside your document.

### 🔄 5. Serverless Peer-to-Peer Sync
- **WebRTC Data Channels**: Pair devices directly using PeerJS.
- **Instant QR Pairing**: Scan a QR code on your host device with your phone to link instantly.
- **Zero Cloud Storage**: Direct browser-to-browser transmission keeping your documents strictly private.

### 📤 6. Flexible Exporting
- **Client-Side PDF Generation**: Generate formatted multi-page A4 PDFs with proper margins and image scaling.
- **Bulk Image Download**: Download individual pages or package entire documents into a compressed ZIP file.
- **Markdown File Export**: Download Markdown components as `.md` files.

---

## 🏗️ Tech Stack & Architecture

Copio is designed with a lightweight, zero-framework-overhead philosophy for maximum speed, longevity, and offline reliability.

| Library / Tech | Purpose |
|---|---|
| 🧱 **[Lit](https://lit.dev)** | Ultra-fast Web Components base class & templating engine |
| 🗃️ **[TinyBase](https://tinybase.org)** | Reactive browser store with auto-persisted IndexedDB storage |
| 🔤 **[Tesseract.js](https://tesseract.projectnaptha.com/)** | Client-side WebAssembly Optical Character Recognition (OCR) |
| 🎨 **[Shoelace](https://shoelace.style)** | Accessible UI component library (dialogs, icons, buttons) |
| ✂️ **[Cropper.js](https://fengyuanchen.github.io/cropperjs/)** | Touch-friendly interactive image crop and rotation tool |
| 📄 **[PDFKit](https://pdfkit.org)** | In-browser client-side PDF document compiler |
| 📡 **[PeerJS](https://peerjs.com)** | WebRTC peer-to-peer data transport layer |
| 📷 **[Exifr](https://mutiny.cz/exifr/)** | High-performance EXIF image metadata parser |
| 🔀 **[Sortable.js](https://sortablejs.github.io/Sortable/)** | Touch & mouse drag-and-drop reordering |
| 📱 **[Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)** | Full offline asset caching & progressive web app shell |


---

## 🚀 Quick Start

### 📖 User Guide
1. **Create a Document**: Click the **+** button and enter a title for your document.
2. **Add Content**: Tap the upload button to capture photos, upload image files, import PDFs, or create Markdown notes.
3. **Enhance & Reorder**: Tap any page thumbnail to crop, rotate, apply black & white threshold filters, or edit text. Drag thumbnails to reorder pages.
4. **Export & Share**: Tap the document dropdown menu to download as a multi-page PDF, a ZIP image bundle, or a Markdown file.
5. **Sync Across Devices**: Click **Link Device** in the header to generate a QR code for instant peer-to-peer sync with another browser or phone.

---

### 💻 Developer Setup

#### Prerequisites
- **Node.js** (v18+ recommended — required for bundler scripts only; the web app has zero runtime server dependencies).
- A static HTTP/HTTPS server or `localhost` (HTTPS is required for Service Worker activation on non-localhost domains).

#### Installation

```bash
# Clone the repository
git clone https://github.com/edwilliams/copio-documents.git
cd copio-documents

# Install build dependencies
npm install
```

#### Build Bundles

```bash
# Bundle client libraries into js/
npm run build
```

#### Run Locally

Serve the project root using any static web server:

```bash
# Using npx serve
npx serve .

# Or using Python
python3 -m http.server 3000
```

Open `http://localhost:3000` in your web browser.

---

## 📱 Mobile Installation & Android APK (TWA)

### 📲 Progressive Web App (PWA)
Open Copio in your mobile browser (Safari on iOS, Chrome on Android/Desktop) and select **Add to Home Screen** or **Install App**. Copio installs as a standalone application that works 100% offline.

### 🤖 Android Trusted Web Activity (TWA)
Copio can be compiled into a lightweight native Android APK shell using [Bubblewrap](https://developer.chrome.com/docs/android/trusted-web-activity/).

#### Install Pre-Built APK
Download `app-release-signed.apk` from the [`copio-twa/`](../copio-twa/) directory, transfer it to your device, and tap to install (enable "Install from unknown sources" if prompted).

#### Build Custom APK
```bash
# Install Bubblewrap CLI globally
npm install -g @bubblewrap/cli

# Navigate to TWA directory
mkdir copio-twa && cd copio-twa

# Generate Android project from PWA manifest
bubblewrap update --skipVersionUpgrade

# Build signed APK and App Bundle
BUBBLEWRAP_KEYSTORE_PASSWORD=<your-password> \
BUBBLEWRAP_KEY_PASSWORD=<your-password> \
bubblewrap build
```

The output file `app-release-signed.apk` is ready for direct Android installation.

---

## 🔒 Privacy & Security Guarantee

- **Zero Remote Storage**: All documents, images, and notes are stored strictly inside your browser's local `IndexedDB`.
- **No Analytics / Telemetry**: No third-party trackers or external analytics scripts.
- **Direct P2P Connections**: WebRTC sync connects your devices directly end-to-end without uploading data to server storage.

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are warmly welcomed! Feel free to open an issue or submit a pull request on GitHub.

---

## 📄 License

Copio is open-source software released under the [MIT License](LICENSE).
