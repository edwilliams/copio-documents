// @ts-nocheck
/*
this doesn't convert nicely to lit-html
The issue is a fundamental incompatibility between Sortable and lit-html. When Sortable physically moves a DOM node, it moves the element but
leaves lit-html's comment markers (used to track ChildParts) in their original positions. On re-render, lit-html finds an empty slot where
the element was and creates a duplicate — the moved node becomes orphaned.
*/

import Sortable from '../../lib/sortable.esm.js';
import {
  randomId,
  fileToBase64,
  extractExif,
  applyEdits,
  normalizeEdits,
  hasActiveEdits,
  renderEditsToCanvas,
} from '../../utils/utils.js';
import { renderPdfPagesToDataUrls } from '../../utils/pdf-utils.js';
import { notify } from '../../services/notify.js';
import { loadCropper } from '../../utils/module-loader.js';
import { cropperCss } from '../../styles/cropper-styles.js';
export class CopioImages extends HTMLElement {
  #images = [];
  #cropper = null;
  #sortable = null;
  #cropIndex = null;
  #textIndex = null;
  #isInitialized = false;
  #abortController = null;
  #createdObjectUrls = new Set();
  #activeCameraStream = null;
  #ocr = true;
  #pdf = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.#isInitialized) {
      this.#initShell();
      this.#isInitialized = true;
    }
    this.#renderGrid();
  }

  disconnectedCallback() {
    // 1. Destroy Sortable instance
    if (this.#sortable) {
      try {
        this.#sortable.destroy();
      } catch (err) {
        console.warn('Error destroying Sortable:', err);
      }
      this.#sortable = null;
    }

    // 2. Destroy Cropper instance
    if (this.#cropper) {
      try {
        this.#cropper.destroy();
      } catch (err) {
        console.warn('Error destroying Cropper:', err);
      }
      this.#cropper = null;
    }
    this.#cropIndex = null;
    this.#textIndex = null;

    // 3. Stop camera tracks
    this.stopCamera();

    // 4. Revoke created object URLs
    this.#revokeAllObjectUrls();

    // 5. Abort and clean up container and DOM event listeners
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    const fileInput = this.shadowRoot.querySelector('.file-input');
    const cameraInput = this.shadowRoot.querySelector('.camera-input');
    if (fileInput) fileInput.onchange = null;
    if (cameraInput) cameraInput.onchange = null;

    this.#isInitialized = false;
  }

  setCameraStream(stream) {
    this.stopCamera();
    this.#activeCameraStream = stream || null;
  }

  stopCamera() {
    if (this.#activeCameraStream) {
      try {
        const tracks = typeof this.#activeCameraStream.getTracks === 'function'
          ? this.#activeCameraStream.getTracks()
          : [];
        tracks.forEach((track) => {
          if (typeof track.stop === 'function') track.stop();
        });
      } catch (err) {
        console.warn('Error stopping camera tracks:', err);
      }
      this.#activeCameraStream = null;
    }
  }

  #trackObjectUrl(url) {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      this.#createdObjectUrls.add(url);
    }
    return url;
  }

  #revokeObjectUrl(url) {
    if (this.#createdObjectUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      this.#createdObjectUrls.delete(url);
    }
  }

  #revokeAllObjectUrls() {
    for (const url of this.#createdObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.#createdObjectUrls.clear();
  }

  #initShell() {
    const styles = `
      <style>
        ${cropperCss}
      </style>
      <style>
        .container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.75rem;
          max-width: 100%;
          min-height: 140px;
          padding: 0.5rem;
          border-radius: 8px;
          border: 2px dashed transparent;
          box-sizing: border-box;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .container.drag-over {
          border-color: #3b82f6;
          background-color: rgba(59, 130, 246, 0.08);
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
        }
        @container copio-scanner (max-width: 400px) {
          .container {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
            padding: 0.25rem;
          }
        }
        @container copio-scanner (min-width: 401px) and (max-width: 767px) {
          .container {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
          }
        }
        @container copio-scanner (min-width: 768px) {
          .container {
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
          }
        }
        /* Fallbacks if container queries are unsupported or outside named container */
        @supports not (container-type: size) {
          @media (min-width: 640px) {
            .container {
              grid-template-columns: repeat(3, 1fr);
            }
          }
          @media (min-width: 1024px) {
            .container {
              grid-template-columns: repeat(4, 1fr);
            }
          }
        }
        .image-wrapper {
          cursor: grab;
          position: relative;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          aspect-ratio: 1;
        }
        .image-wrapper:active {
          cursor: grabbing;
        }
        .image-wrapper.dragging {
          opacity: 0.4;
          cursor: grabbing;
        }
        .image-wrapper.sortable-ghost {
          opacity: 0.2;
        }
        .image-menu {
          position: absolute;
          top: 4px;
          right: 4px;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border: 1px solid #ccc;
          border-radius: 4px;
          display: block;
        }
        #crop-image {
          max-width: 100%;
          max-height: 100%;
          display: block;
        }
        .crop-wrapper {
          width: 100%;
          height: 360px;
          max-height: min(50vh, 380px);
          min-height: 200px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          box-sizing: border-box;
          margin-bottom: 0.5rem;
        }
        sl-dialog::part(base) {
          position: absolute;
        }
        sl-dialog::part(overlay) {
          position: absolute;
        }
        sl-dialog::part(panel) {
          max-width: calc(100% - 20px);
          max-height: calc(100% - 20px);
        }
        .crop-dialog::part(panel) {
          max-width: min(94%, 560px);
          max-height: calc(100% - 16px);
          display: flex;
          flex-direction: column;
        }
        .crop-dialog::part(body) {
          padding: 24px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
          min-height: 0;
        }
        @container copio-scanner (max-width: 400px) {
          .crop-wrapper {
            height: 240px;
            max-height: 42cqh;
            min-height: 160px;
          }
          .crop-dialog::part(panel) {
            max-width: calc(100% - 12px);
            max-height: calc(100% - 12px);
          }
          .crop-dialog::part(body) {
            padding: 16px;
          }
          .crop-dialog::part(header) {
            padding: 0.5rem 0.75rem;
          }
          .crop-dialog::part(footer) {
            padding: 0.5rem 0.75rem;
          }
        }
        .markdown-card {
          width: 100%;
          height: 100%;
          border: 1px solid #334155;
          border-radius: 4px;
          background: #0f172a;
          color: #f8fafc;
          padding: 10px;
          box-sizing: border-box;
          font-family: monospace;
          font-size: 0.72rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .markdown-card-header {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: bold;
          font-size: 0.75rem;
          color: #38bdf8;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .markdown-card-body {
          flex: 1;
          opacity: 0.8;
          word-break: break-word;
          overflow: hidden;
          line-height: 1.35;
        }
        button.add-btn {
          width: 100%;
          aspect-ratio: 1;
          font-size: 1.6rem;
          border: 2px dashed #888;
          border-radius: 4px;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: border-color 0.15s, color 0.15s, background-color 0.15s;
        }
        button.add-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background-color: rgba(59, 130, 246, 0.04);
        }
        dialog {
          border: none;
          border-radius: 6px;
          padding: 1rem;
        }
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.3);
        }
      </style>
    `;

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="container"></div>

      <input type="file" class="file-input" accept="image/*,application/pdf,.md,.markdown,text/plain" multiple style="display: none">
      <input type="file" class="camera-input" accept="image/*" capture="environment" style="display: none">

      <sl-dialog label="Edit Markdown Text" class="text-dialog" style="--width: min(92%, 560px)">
        <div style="margin-bottom: 1rem;">
          <sl-textarea class="text-editor" rows="12" placeholder="Enter markdown content..."></sl-textarea>
        </div>
        <sl-button slot="footer" variant="default" class="cancel-text">Cancel</sl-button>
        <sl-button slot="footer" variant="primary" class="apply-text">Save Text</sl-button>
      </sl-dialog>

      <sl-dialog label="Image Data" class="data-dialog">
        <div class="exif-data" style="font-size: 0.85rem; line-height: 1.6;"></div>
        <sl-button slot="footer" variant="primary" class="close-data">Close</sl-button>
      </sl-dialog>

      <sl-dialog label="Crop Image" class="crop-dialog" style="--width: min(94%, 560px)">
        <div class="crop-wrapper">
          <img id="crop-image" />
        </div>
        <sl-button slot="footer" variant="default" class="cancel-crop">Cancel</sl-button>
        <sl-button slot="footer" variant="primary" class="apply-crop">Apply</sl-button>
      </sl-dialog>
    `;

    if (this.#abortController) {
      this.#abortController.abort();
    }
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const closeDataBtn = this.shadowRoot.querySelector('.close-data');
    if (closeDataBtn) {
      closeDataBtn.addEventListener('click', () => {
        this.shadowRoot.querySelector('.data-dialog')?.hide();
      }, { signal });
    }

    const fileInput = this.shadowRoot.querySelector('.file-input');
    const cameraInput = this.shadowRoot.querySelector('.camera-input');

    let isProcessingFiles = false;
    const handleFileChange = async (event) => {
      if (isProcessingFiles) return;
      const files = Array.from(event.target?.files || []);
      if (files.length === 0) return;
      isProcessingFiles = true;
      try {
        await this.addFiles(files);
      } finally {
        if (event.target) {
          event.target.value = '';
        }
        isProcessingFiles = false;
      }
    };

    if (fileInput) {
      fileInput.onchange = handleFileChange;
      fileInput.addEventListener('change', handleFileChange, { signal });
    }
    if (cameraInput) {
      cameraInput.onchange = handleFileChange;
      cameraInput.addEventListener('change', handleFileChange, { signal });
    }

    let dragCounter = 0;

    const isPotentialFileDrag = (event) => {
      const dt = event.dataTransfer;
      if (!dt) return false;
      if (!dt.types || dt.types.length === 0) return true;
      const types = Array.from(dt.types);
      return (
        types.includes('Files') ||
        types.some(
          (t) =>
            t.startsWith('image/') ||
            t.startsWith('public.') ||
            t.includes('pdf') ||
            t.includes('file') ||
            t === 'text/uri-list',
        )
      );
    };

    const handleDragEnter = (event) => {
      if (isPotentialFileDrag(event)) {
        event.preventDefault();
        dragCounter++;
        container.classList.add('drag-over');
      }
    };

    const handleDragOver = (event) => {
      if (isPotentialFileDrag(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        container.classList.add('drag-over');
      }
    };

    const handleDragLeave = () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        container.classList.remove('drag-over');
      }
    };

    const handleDrop = async (event) => {
      dragCounter = 0;
      container.classList.remove('drag-over');
      event.preventDefault();
      event.stopPropagation();

      let files = [];
      if (event.dataTransfer?.files?.length > 0) {
        files = Array.from(event.dataTransfer.files);
      } else if (event.dataTransfer?.items?.length > 0) {
        for (const item of event.dataTransfer.items) {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      } else if (event.detail?.files) {
        files = Array.from(event.detail.files);
      }

      if (files.length > 0) {
        await this.addFiles(files);
      }
    };

    const container = this.shadowRoot.querySelector('.container');
    if (container) {
      container.addEventListener('dragenter', handleDragEnter, { signal });
      container.addEventListener('dragover', handleDragOver, { signal });
      container.addEventListener('dragleave', handleDragLeave, { signal });
      container.addEventListener('drop', handleDrop, { signal });
      container.addEventListener('dragend', () => {
        dragCounter = 0;
        container.classList.remove('drag-over');
      }, { signal });

      container.addEventListener('click', (event) => {
        if (event.target === container) {
          fileInput?.click();
        }
      }, { signal });
    }

    const cancelCropBtn = this.shadowRoot.querySelector('.cancel-crop');
    const applyCropBtn = this.shadowRoot.querySelector('.apply-crop');
    const cancelTextBtn = this.shadowRoot.querySelector('.cancel-text');
    const applyTextBtn = this.shadowRoot.querySelector('.apply-text');

    if (cancelCropBtn) cancelCropBtn.addEventListener('click', () => this.closeCropDialog(), { signal });
    if (applyCropBtn) applyCropBtn.addEventListener('click', () => this.applyCrop(), { signal });
    if (cancelTextBtn) cancelTextBtn.addEventListener('click', () => this.closeTextDialog(), { signal });
    if (applyTextBtn) applyTextBtn.addEventListener('click', () => this.applyTextEdit(), { signal });

    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    if (cropDialog) {
      cropDialog.addEventListener('sl-hide', () => {
        if (this.#cropper) {
          this.#cropper.destroy();
          this.#cropper = null;
        }
        this.#cropIndex = null;
      }, { signal });
    }
  }


  #renderGrid() {
    const container = this.shadowRoot.querySelector('.container');
    if (!container) return;

    const imageHtml = this.#images
      .map((item, index) => {
        if (item.type === 'markdown') {
          const title = item.name || 'Markdown Note';
          const snippet = (item.content || '').slice(0, 120);
          return `
            <div class="image-wrapper" data-index="${index}">
              <div class="markdown-card">
                <div class="markdown-card-header">
                  <sl-icon name="file-earmark-text"></sl-icon> ${title}
                </div>
                <div class="markdown-card-body">${snippet}</div>
              </div>
              <sl-dropdown class="image-menu" data-index="${index}">
                <sl-button slot="trigger" variant="default" size="small" circle>
                  <sl-icon name="three-dots-vertical"></sl-icon>
                </sl-button>
                <sl-menu>
                  <sl-menu-item value="edittext">Edit Text</sl-menu-item>
                  <sl-menu-item value="download">Download Markdown</sl-menu-item>
                  <sl-divider></sl-divider>
                  <sl-menu-item value="delete">Delete</sl-menu-item>
                </sl-menu>
              </sl-dropdown>
            </div>
          `;
        }
        const hasEdits = hasActiveEdits(item.edits);
        const isBw = item.edits?.filter === 'bw';
        return `
          <div class="image-wrapper" data-index="${index}">
            <img src="${item.src}" draggable="false">
            <sl-dropdown class="image-menu" data-index="${index}">
              <sl-button slot="trigger" variant="default" size="small" circle>
                <sl-icon name="three-dots-vertical"></sl-icon>
              </sl-button>
              <sl-menu>
                ${this.ocr !== false ? `
                <sl-menu-item value="ocr">
                  <sl-icon slot="prefix" name="card-text"></sl-icon> Extract Text
                </sl-menu-item>
                <sl-divider></sl-divider>
                ` : ''}
                <sl-menu-item value="crop">Crop</sl-menu-item>
                <sl-menu-item value="rotate">Rotate</sl-menu-item>
                <sl-menu-item value="threshold">
                  <sl-icon slot="prefix" name="${isBw ? 'check-lg' : 'circle'}"></sl-icon>
                  ${isBw ? 'Remove Black &amp; White' : 'Black &amp; White'}
                </sl-menu-item>
                <sl-menu-item value="reset" ?disabled=${!hasEdits}>
                  <sl-icon slot="prefix" name="arrow-counterclockwise"></sl-icon>
                  Reset to Original
                </sl-menu-item>
                <sl-menu-item value="showdata">Show Data</sl-menu-item>
                <sl-menu-item value="download">Download Image</sl-menu-item>
                <sl-divider></sl-divider>
                <sl-menu-item value="delete">Delete</sl-menu-item>
              </sl-menu>
            </sl-dropdown>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      ${imageHtml}
      <button class="add-btn add-image-btn" title="Add image, PDF, or Markdown" aria-label="Add image or PDF">
        <sl-icon name="plus-lg"></sl-icon>
      </button>
      <button class="add-btn add-camera-btn" title="Capture from camera" aria-label="Capture from camera">
        <sl-icon name="camera"></sl-icon>
      </button>
      <button class="add-btn add-note-btn" title="New blank note" aria-label="New blank note">
        <sl-icon name="file-earmark-plus"></sl-icon>
      </button>
    `;

    const addImageBtn = container.querySelector('.add-image-btn');
    if (addImageBtn) {
      addImageBtn.onclick = () => {
        this.shadowRoot.querySelector('.file-input').click();
      };
    }

    const addCameraBtn = container.querySelector('.add-camera-btn');
    if (addCameraBtn) {
      addCameraBtn.onclick = () => {
        this.shadowRoot.querySelector('.camera-input').click();
      };
    }

    const addNoteBtn = container.querySelector('.add-note-btn');
    if (addNoteBtn) {
      addNoteBtn.onclick = () => {
        this.addBlankNote();
      };
    }

    container.querySelectorAll('.image-menu').forEach((dropdown) => {
      const menu = dropdown.querySelector('sl-menu');
      menu.addEventListener('sl-select', (event) => {
        event.stopPropagation();
        const index = parseInt(dropdown.dataset.index);
        const action = event.detail.item.value;

        if (action === 'ocr') {
          dropdown.hide();
          // Bubble up to copio-app, which opens the shared copio-doc-ocr-dialog
          this.dispatchEvent(
            new CustomEvent('copio:ocr-page', {
              bubbles: true,
              composed: true,
              detail: {
                page: this.#images[index],
                pageIndex: index,
              },
            }),
          );
        } else if (action === 'crop') {
          dropdown.hide();
          this.openCropDialog(index);
        } else if (action === 'rotate') {
          this.rotateImage(index);
        } else if (action === 'threshold') {
          this.thresholdImage(index);
        } else if (action === 'reset') {
          dropdown.hide();
          this.resetImage(index);
        } else if (action === 'showdata') {
          dropdown.hide();
          this.showImageData(index);
        } else if (action === 'edittext') {
          dropdown.hide();
          this.openTextDialog(index);
        } else if (action === 'download') {
          this.downloadImage(index);
        } else if (action === 'delete') {
          const [deletedPage] = this.#images.splice(index, 1);
          this.#renderGrid();
          const pageName = deletedPage.name || (deletedPage.type === 'markdown' ? 'Markdown Note' : `Page ${index + 1}`);
          notify.undo(
            `Deleted ${pageName}`,
            () => {
              this.#images.splice(index, 0, deletedPage);
              this.#renderGrid();
              notify.success(`Restored ${pageName}`);
            },
            { duration: 5000 },
          );
        }
      });
    });

    this.#setupSortable(container);
  }

  #setupSortable(container) {
    if (this.#sortable) {
      try {
        this.#sortable.destroy();
      } catch (err) {
        console.warn('Error destroying Sortable:', err);
      }
      this.#sortable = null;
    }

    this.#sortable = Sortable.create(container, {
      animation: 150,
      draggable: '.image-wrapper',
      chosenClass: 'dragging',
      ghostClass: 'sortable-ghost',
      filter: 'sl-dropdown',
      preventOnFilter: false,
      delay: 150,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      onEnd: (evt) => {
        if (evt.to !== container) return;
        const oldIdx = evt.oldDraggableIndex;
        const newIdx = evt.newDraggableIndex;
        if (oldIdx === newIdx) return;
        const dragged = this.#images[oldIdx];
        this.#images.splice(oldIdx, 1);
        this.#images.splice(newIdx, 0, dragged);
        this.#renderGrid();
      },
    });
  }

  async openCropDialog(index) {
    this.#cropIndex = index;
    const page = this.#images[index];
    if (!page || page.type === 'markdown') return;

    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    const cropImage = this.shadowRoot.querySelector('#crop-image');

    page.originalSrc = page.originalSrc || page.src;
    page.edits = normalizeEdits(page.edits);

    // Re-cropping starts from the original image with the prior box pre-selected
    cropImage.src = page.originalSrc;
    cropDialog.show();

    const Cropper = await loadCropper();
    const priorCrop = page.edits?.crop;

    const initCropper = () => {
      if (this.#cropper) {
        this.#cropper.destroy();
      }
      this.#cropper = new Cropper(cropImage, {
        viewMode: 1,
        autoCropArea: 0.88,
        responsive: true,
        ready: () => {
          if (priorCrop) {
            try {
              if (priorCrop.width > 0 && priorCrop.height > 0) {
                this.#cropper.setData({
                  x: priorCrop.x,
                  y: priorCrop.y,
                  width: priorCrop.width,
                  height: priorCrop.height,
                });
              } else if (priorCrop.normalized && priorCrop.normalized.w > 0) {
                const img = this.#cropper.getImageData();
                this.#cropper.setData({
                  x: Math.round(priorCrop.normalized.x * img.naturalWidth),
                  y: Math.round(priorCrop.normalized.y * img.naturalHeight),
                  width: Math.round(priorCrop.normalized.w * img.naturalWidth),
                  height: Math.round(priorCrop.normalized.h * img.naturalHeight),
                });
              } else if (typeof priorCrop.w === 'number' && priorCrop.w > 0) {
                const img = this.#cropper.getImageData();
                this.#cropper.setData({
                  x: Math.round(priorCrop.x * img.naturalWidth),
                  y: Math.round(priorCrop.y * img.naturalHeight),
                  width: Math.round(priorCrop.w * img.naturalWidth),
                  height: Math.round(priorCrop.h * img.naturalHeight),
                });
              }
            } catch (e) {
              console.warn('Failed restoring prior crop box:', e);
            }
          }
        },
      });
    };

    cropImage.onload = initCropper;
    if (cropImage.complete && cropImage.naturalWidth > 0 && !this.#cropper) {
      initCropper();
    }
  }

  closeCropDialog() {
    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    const cropImage = this.shadowRoot.querySelector('#crop-image');
    if (cropImage) {
      cropImage.onload = null;
    }
    if (this.#cropper) {
      try {
        this.#cropper.destroy();
      } catch (err) {
        console.warn('Error destroying Cropper:', err);
      }
      this.#cropper = null;
    }
    this.#cropIndex = null;
    cropDialog?.hide();
  }

  applyCrop() {
    if (this.#cropper && this.#cropIndex !== null) {
      const page = this.#images[this.#cropIndex];
      if (!page) return;

      page.originalSrc = page.originalSrc || page.src || '';
      const cropData = this.#cropper.getData(true);
      const imgData = this.#cropper.getImageData();
      const naturalWidth = imgData?.naturalWidth || 1;
      const naturalHeight = imgData?.naturalHeight || 1;

      const normX = Math.max(0, Math.min(1, cropData.x / naturalWidth));
      const normY = Math.max(0, Math.min(1, cropData.y / naturalHeight));
      const normW = Math.max(0, Math.min(1, cropData.width / naturalWidth));
      const normH = Math.max(0, Math.min(1, cropData.height / naturalHeight));

      page.edits = {
        ...normalizeEdits(page.edits),
        crop: {
          x: Math.round(cropData.x),
          y: Math.round(cropData.y),
          width: Math.round(cropData.width),
          height: Math.round(cropData.height),
          normalized: {
            x: Number(normX.toFixed(4)),
            y: Number(normY.toFixed(4)),
            w: Number(normW.toFixed(4)),
            h: Number(normH.toFixed(4)),
          },
        },
      };

      const croppedCanvas = this.#cropper.getCroppedCanvas();
      if (croppedCanvas) {
        const finalCanvas = renderEditsToCanvas(croppedCanvas, {
          crop: null,
          rotation: page.edits.rotation,
          filter: page.edits.filter,
        });
        const isPng = page.originalSrc.startsWith('data:image/png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        page.src = finalCanvas.toDataURL(format, isPng ? undefined : 0.82);
      }

      this.#renderGrid();
      this.closeCropDialog();
    }
  }

  async rotateImage(index) {
    const page = this.#images[index];
    if (!page || page.type === 'markdown') return;
    page.originalSrc = page.originalSrc || page.src;
    page.edits = {
      ...normalizeEdits(page.edits),
      rotation: ((page.edits?.rotation || 0) + 90) % 360,
    };
    page.src = await applyEdits(page.originalSrc, page.edits);
    this.#renderGrid();
  }

  async thresholdImage(index) {
    const page = this.#images[index];
    if (!page || page.type === 'markdown') return;
    page.originalSrc = page.originalSrc || page.src;
    const isCurrentlyBw = page.edits?.filter === 'bw';
    page.edits = {
      ...normalizeEdits(page.edits),
      filter: isCurrentlyBw ? 'none' : 'bw',
    };
    page.src = await applyEdits(page.originalSrc, page.edits);
    this.#renderGrid();
    if (isCurrentlyBw) {
      notify.info('Restored color (removed B&W filter)');
    } else {
      notify.success('Applied B&W threshold filter');
    }
  }

  resetImage(index) {
    const page = this.#images[index];
    if (!page || page.type === 'markdown') return;
    page.edits = { crop: null, rotation: 0, filter: 'none' };
    page.src = page.originalSrc || page.src;
    this.#renderGrid();
    notify.success('Reset page to original');
  }

  addBlankNote() {
    const newNote = {
      id: randomId(),
      type: 'markdown',
      name: 'New Note',
      content: '',
    };
    this.#images.push(newNote);
    // Re-render the grid first, then open the editor on the new note
    this.#renderGrid();
    this.openTextDialog(this.#images.length - 1);
  }

  downloadImage(index) {
    const page = this.#images[index];
    if (!page) return;
    if (page.type === 'markdown') {
      const blob = new Blob([page.content || ''], { type: 'text/markdown;charset=utf-8' });
      const url = this.#trackObjectUrl(URL.createObjectURL(blob));
      const a = document.createElement('a');
      const filename = page.name || `document-${index + 1}.md`;
      a.href = url;
      a.download = filename;
      a.click();
      this.#revokeObjectUrl(url);
      notify.success(`Downloaded "${filename}"`);
      return;
    }
    if (!page.src) return;
    let ext = 'jpg';
    if (page.src.startsWith('data:')) {
      const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (match && match[1].includes('png')) ext = 'png';
    }
    const a = document.createElement('a');
    const filename = `image-${index + 1}.${ext}`;
    a.href = page.src;
    a.download = filename;
    a.click();
    notify.success(`Downloaded "${filename}"`);
  }

  openTextDialog(index) {
    this.#textIndex = index;
    const textDialog = this.shadowRoot.querySelector('.text-dialog');
    const textEditor = this.shadowRoot.querySelector('.text-editor');
    textEditor.value = this.#images[index].content || '';
    textDialog.label = this.#images[index].name || 'Note';
    textDialog.show();
  }

  applyTextEdit() {
    if (this.#textIndex !== null && this.#images[this.#textIndex]) {
      const textEditor = this.shadowRoot.querySelector('.text-editor');
      this.#images[this.#textIndex].content = textEditor.value;
      this.#renderGrid();
      this.closeTextDialog();
    }
  }

  closeTextDialog() {
    const textDialog = this.shadowRoot.querySelector('.text-dialog');
    this.#textIndex = null;
    textDialog.hide();
  }

  showImageData(index) {
    const { src, exif } = this.#images[index];
    const img = this.shadowRoot.querySelector(`img[src="${src}"]`);
    const rows = [];
    rows.push(`<strong>Dimensions:</strong> ${img ? `${img.naturalWidth} × ${img.naturalHeight}` : 'unknown'}`);
    if (exif) {
      const skip = new Set(['MakerNote', 'UserComment', 'FlashPixVersion', 'ExifVersion', 'ComponentsConfiguration', 'SceneType', 'thumbnail']);
      for (const [key, val] of Object.entries(exif)) {
        if (skip.has(key) || val === undefined || val === null) continue;
        let display = val instanceof Array ? val.join(', ') : String(val);
        if (display.length > 200) continue;
        rows.push(`<strong>${key}:</strong> ${display}`);
      }
    } else {
      rows.push('<em>No EXIF data available</em>');
    }
    this.shadowRoot.querySelector('.exif-data').innerHTML = rows.join('<br>');
    this.shadowRoot.querySelector('.data-dialog').show();
  }

  async pdfToImages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const dataUrls = await renderPdfPagesToDataUrls(arrayBuffer);
    return dataUrls.map((src) => ({
      id: randomId(),
      src,
      originalSrc: src,
      edits: { crop: null, rotation: 0, filter: 'none' },
    }));
  }

  async addFiles(files) {
    if (!files || files.length === 0) return;
    const allImages = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pdfImages = await this.pdfToImages(file);
          allImages.push(...pdfImages);
        } else if (
          file.name?.endsWith('.md') ||
          file.name?.endsWith('.markdown') ||
          file.type === 'text/markdown' ||
          file.type === 'text/plain'
        ) {
          const content = await file.text();
          allImages.push({
            id: randomId(),
            type: 'markdown',
            name: file.name,
            content,
          });
        } else {
          const [src, exif] = await Promise.all([fileToBase64(file), extractExif(file)]);
          allImages.push({
            id: randomId(),
            src,
            originalSrc: src,
            edits: { crop: null, rotation: 0, filter: 'none' },
            exif,
          });
        }
      }

      this.#images.push(...allImages);
      this.#renderGrid();
      const count = allImages.length;
      notify.success(`Imported ${count} page${count !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Failed to import files:', err);
      notify.error('Failed to import files');
    }
  }

  get ocr() {
    return this.#ocr !== false;
  }

  set ocr(val) {
    this.#ocr = Boolean(val);
    if (this.#isInitialized) {
      this.#renderGrid();
    }
  }

  get pdf() {
    return this.#pdf !== false;
  }

  set pdf(val) {
    this.#pdf = Boolean(val);
    if (this.#isInitialized) {
      this.#renderGrid();
    }
  }

  get images() {
    return this.#images;
  }

  set images(val) {
    const arr = Array.isArray(val) ? val : [];
    this.#images = arr.map((item) => {
      if (!item || item.type === 'markdown') return item;
      return {
        ...item,
        originalSrc: item.originalSrc || item.src || '',
        edits: normalizeEdits(item.edits),
      };
    });
    if (this.#isInitialized) {
      this.#renderGrid();
    }
  }
}

if (!customElements.get('copio-images')) {
  customElements.define('copio-images', CopioImages);
}
