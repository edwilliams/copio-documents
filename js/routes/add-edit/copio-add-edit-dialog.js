// @ts-nocheck
import { LitElement, html } from '../../lib/lit-core.min.js';
import { randomId } from '../../utils/utils.js';
import { notify } from '../../services/notify.js';

export class CopioAddEditDialog extends LitElement {
  #scannerInitialized = false;

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    this.#initScanner();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#clearValidation();
  }

  #initScanner = () => {
    if (this.#scannerInitialized) return;
    const scanner = this.querySelector('copio-scanner');
    if (!scanner) return;

    scanner.addEventListener('copio:scan-complete', (e) => {
      const detail = e.detail || {};
      const scannedPages = detail.pages || (detail.page ? [detail.page] : []);
      this.#syncScannerPages(scannedPages);
      const inputName = this.querySelector('.dialog-add-edit-input-name');
      if (inputName && !inputName.value.trim()) {
        const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        inputName.value = `Scan ${dateStr}`;
        this.#clearValidation();
      }
      notify.success(`✓ Scanned ${scannedPages.length} page${scannedPages.length !== 1 ? 's' : ''}`);
    });

    scanner.addEventListener('copio:pages-changed', (e) => {
      const pages = e.detail?.pages;
      if (Array.isArray(pages) && pages.length > 0) {
        this.#syncScannerPages(pages);
      }
    });

    this.#scannerInitialized = true;
  };

  #syncScannerPages = (scannedPages) => {
    if (!Array.isArray(scannedPages) || scannedPages.length === 0) return;
    const copioImages = this.querySelector('copio-images');
    if (!copioImages) return;

    const existing = copioImages.images || [];
    const existingIds = new Set(existing.map((p) => p.id));
    const newItems = [];

    for (let idx = 0; idx < scannedPages.length; idx++) {
      const p = scannedPages[idx];
      if (!existingIds.has(p.id)) {
        newItems.push({
          id: p.id || randomId(),
          src: p.src,
          originalSrc: p.originalSrc || p.src,
          edits: p.edits || { crop: null, rotation: 0, filter: 'none' },
          exif: p.exif || null,
          type: 'image',
          name: p.label || p.name || `Page ${existing.length + newItems.length + 1}`,
          content: null,
        });
      }
    }

    if (newItems.length > 0) {
      copioImages.images = [...existing, ...newItems];
    }
  };

  #clearValidation = () => {
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const nameError = this.querySelector('.dialog-name-error');
    if (nameError) nameError.style.display = 'none';
    if (inputName) {
      inputName.classList.remove('input-invalid');
      inputName.style.removeProperty('--sl-input-border-color');
      inputName.style.removeProperty('--sl-input-border-color-focus');
      if (typeof inputName.setCustomValidity === 'function') {
        try {
          inputName.setCustomValidity('');
        } catch {}
      }
    }
  };

  #handleNameInput = (e) => {
    if (e.target?.value?.trim()) {
      this.#clearValidation();
    }
  };

  #handleHide = (event) => {
    if (event.target !== event.currentTarget) return;
    
    this.#clearValidation();
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');
    const scanner = this.querySelector('copio-scanner');

    if (inputId) inputId.value = '';
    if (inputName) inputName.value = '';
    if (copioImages) copioImages.images = [];
    if (scanner && typeof scanner.clear === 'function') {
      scanner.clear().catch(() => {});
    }
    
    this.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, composed: false }));
  };

  #handleKeydown = (e) => {
    if (e.key !== 'Enter') return;
    // Don't intercept Enter when a nested dialog/modal is open (note editor, cropper, etc.)
    if (this.querySelector('sl-dialog[open]')) return;
    if (e.target?.classList?.contains('dialog-add-edit-input-name')) {
      e.preventDefault();
      this.#handleSave();
      return;
    }
    // Don't intercept Enter from text inputs or textareas
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SL-TEXTAREA' || tag === 'INPUT' || tag === 'SL-INPUT') return;
    if (e.target?.tagName === 'SL-BUTTON' || e.target?.tagName === 'BUTTON') return;
    e.preventDefault();
    this.#handleSave();
  };

  async open() {
    await this.updateComplete;
    this.#initScanner();
    this.#clearValidation();
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;

    const scanner = this.querySelector('copio-scanner');
    if (scanner) {
      scanner.stage = 'viewfinder';
      if (typeof scanner.clear === 'function') {
        scanner.clear().catch(() => {});
      }
    }

    await dialog.show();
    this.querySelector('.dialog-add-edit-input-name')?.focus();
  }

  async openEdit(id, name, pages) {
    await this.updateComplete;
    this.#initScanner();
    this.#clearValidation();
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');
    const scanner = this.querySelector('copio-scanner');

    inputId.value = id;
    inputName.value = name;

    if (scanner && typeof scanner.clear === 'function') {
      scanner.clear().catch(() => {});
    }

    await customElements.whenDefined('copio-images');
    copioImages.images = pages.map(({ id, src, originalSrc, edits, exif, type, name, content }) => ({
      id,
      src,
      originalSrc: originalSrc || src,
      edits: edits || { crop: null, rotation: 0, filter: 'none' },
      exif,
      type,
      name,
      content,
    }));

    if (!dialog.open) {
      await dialog.show();
      inputName.focus();
    }
  }

  #handleSave = () => {
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const nameError = this.querySelector('.dialog-name-error');
    const copioImages = this.querySelector('copio-images');

    const name = inputName?.value?.trim();
    if (!name) {
      if (nameError) {
        nameError.style.display = 'block';
      }
      if (inputName) {
        inputName.classList.add('input-invalid');
        inputName.style.setProperty('--sl-input-border-color', '#ef4444');
        inputName.style.setProperty('--sl-input-border-color-focus', '#ef4444');
        if (typeof inputName.setCustomValidity === 'function') {
          inputName.setCustomValidity('Please enter a document name');
          inputName.reportValidity?.();
        }
        inputName.focus();
      }
      return;
    }

    const pages = (copioImages?.images || []).map(({ id, src, originalSrc, edits, exif, type, name, content }) => ({
      id,
      src,
      originalSrc: originalSrc || src,
      edits: edits || { crop: null, rotation: 0, filter: 'none' },
      exif,
      type,
      name,
      content,
    }));

    const id = inputId?.value || randomId();

    this.dispatchEvent(new CustomEvent('dialog:save', {
      bubbles: true,
      composed: false,
      detail: { id, name, pages }
    }));

    this.querySelector('.dialog-add-edit')?.hide();
  };

  render() {
    return html`
      <sl-dialog
        label="Add / Edit Document"
        class="dialog-add-edit"
        style="--width: min(96%, 720px)"
        @sl-after-hide=${this.#handleHide}
        @keydown=${this.#handleKeydown}
      >
        <div style="min-height: min(65cqh, 420px); min-height: 350px;">
          <sl-input
            disabled
            class="dialog-add-edit-input-id"
            placeholder="id"
            style="display: none"
          ></sl-input>
          <div class="dialog-name-field" style="max-width: 320px">
            <sl-input
              class="dialog-add-edit-input-name"
              placeholder="Enter name of document or image"
              @sl-input=${this.#handleNameInput}
            ></sl-input>
            <div
              class="dialog-name-error"
              style="color: #ef4444; font-size: 0.8rem; margin-top: 4px; display: none;"
            >
              Please enter a document name
            </div>
          </div>

          <div class="copio-scanner-host modal-scanner-host">
            <copio-scanner
              class="dialog-copio-scanner"
              mode="batch"
              aspect="a4"
              features="crop rotate filter ocr export"
            ></copio-scanner>
          </div>

          <copio-images
            style="display: block; margin-top: 1.5rem"
          ></copio-images>

          <br />

          <sl-button
            class="dialog-add-edit-savebtn"
            style="width: 100%; margin-top: auto;"
            slot="footer"
            variant="primary"
            @click=${this.#handleSave}
            >Save</sl-button
          >
        </div>
      </sl-dialog>
    `;
  }
}

if (!customElements.get('copio-add-edit-dialog')) {
  customElements.define('copio-add-edit-dialog', CopioAddEditDialog);
}
