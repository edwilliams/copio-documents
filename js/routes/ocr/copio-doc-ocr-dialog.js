// @ts-nocheck
import { LitElement, html } from '../../lib/lit-core.min.js';
import { recognizeDocumentPages, SUPPORTED_LANGUAGES, terminateOcrWorker } from '../../services/ocr-service.js';
import { notify } from '../../services/notify.js';

export class CopioDocOcrDialog extends LitElement {
  #abortController = null;

  static properties = {
    isOpen: { type: Boolean, state: true },
    docId: { type: String, state: true },
    docName: { type: String, state: true },
    pages: { type: Array, state: true },
    lang: { type: String, state: true },
    step: { type: String, state: true },
    progress: { type: Number, state: true },
    statusMessage: { type: String, state: true },
    resultText: { type: String, state: true },
    confidence: { type: Number, state: true },
    copied: { type: Boolean, state: true },
  };

  createRenderRoot() {
    return this; // Use Light DOM for Shoelace dialog compatibility
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    terminateOcrWorker();
    this.isOpen = false;
  }

  constructor() {
    super();
    this.isOpen = false;
    this.docId = '';
    this.docName = '';
    this.pages = [];
    this.lang = 'eng';
    this.step = 'processing';
    this.progress = 0;
    this.statusMessage = 'Starting OCR engine...';
    this.resultText = '';
    this.confidence = 0;
    this.copied = false;
    // Set in single-page mode so Save as Note inserts adjacent to the source image
    this._pageIndex = null;
    this.#abortController = null;
  }

  /**
   * Open for a full document (all image pages).
   * @param {string} docId
   * @param {string} docName
   * @param {Array} pages
   * @param {string} [lang]
   */
  open(docId, docName, pages, lang = 'eng') {
    this._pageIndex = null;
    this._openInternal(docId, docName, pages, lang);
  }

  /**
   * Open for a single page (from the page grid or carousel).
   * @param {string} docId
   * @param {string} docName
   * @param {{ id: string, src: string }} page   – the single image page object
   * @param {number} pageIndex                   – its index in the document pages array
   * @param {string} [lang]
   */
  openPage(docId, docName, page, pageIndex, lang = 'eng') {
    this._pageIndex = pageIndex;
    this._openInternal(docId, docName, [page], lang);
  }

  _openInternal(docId, docName, pages, lang) {
    // Abort any ongoing run first
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    this.docId = docId;
    this.docName = docName || 'Document';
    this.pages = pages || [];
    this.lang = lang;
    this.progress = 0;
    this.resultText = '';
    this.confidence = 0;
    this.copied = false;

    const imagePages = (this.pages || []).filter((p) => p.type !== 'markdown' && p.src);
    if (imagePages.length === 0) {
      this.step = 'empty';
      this.statusMessage = 'This document does not contain any image pages for text recognition.';
      this.isOpen = true;
      return;
    }

    this.step = 'processing';
    this.statusMessage = (typeof window !== 'undefined' && !window.Tesseract)
      ? 'Downloading OCR engine...'
      : 'Starting OCR engine...';
    this.isOpen = true;

    this.startOcr(lang);
  }

  cancel = () => {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    this.close();
  };

  close = () => {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    this.isOpen = false;
  };

  async startOcr(lang = 'eng') {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    try {
      const result = await recognizeDocumentPages(this.pages, {
        lang,
        abortSignal: signal,
        onPageProgress: ({ overallProgress, message }) => {
          if (this.isOpen && !signal.aborted) {
            this.progress = Math.round((overallProgress || 0) * 100);
            this.statusMessage = message;
          }
        },
      });

      if (this.isOpen && !signal.aborted) {
        this.step = 'done';
        this.resultText = result.combinedText || '';
        this.confidence = result.averageConfidence || 0;
        notify.success('Text recognition complete');
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) {
        // Cancelled by user - do not display as error
        return;
      }
      console.error('Document OCR Error:', err);
      if (this.isOpen) {
        this.step = 'error';
        this.statusMessage = err.message || 'Text recognition failed';
        notify.error(err.message || 'Text recognition failed');
      }
    } finally {
      if (this.#abortController?.signal === signal) {
        this.#abortController = null;
      }
    }
  }

  handleLangChange = (e) => {
    const newLang = e.target.value;
    this.lang = newLang;
    this.step = 'processing';
    this.progress = 0;
    this.statusMessage = 'Starting OCR engine with new language...';
    this.startOcr(newLang);
  };

  handleTextInput = (e) => {
    this.resultText = e.target.value;
  };

  copyText = async () => {
    if (!this.resultText) return;
    try {
      await navigator.clipboard.writeText(this.resultText);
      this.copied = true;
      notify.success('Copied text to clipboard');
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      notify.error('Failed to copy text to clipboard');
    }
  };

  downloadMarkdown = () => {
    if (!this.resultText) return;
    const safeName = (this.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.resultText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported OCR markdown (${safeName}-ocr.md)`);
  };

  downloadText = () => {
    if (!this.resultText) return;
    const safeName = (this.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported OCR text (${safeName}-ocr.txt)`);
  };

  saveAsNote = () => {
    if (!this.resultText || !this.docId) return;

    const detail = {
      docId: this.docId,
      content: this.resultText,
      // pageIndex is set in single-page mode so the note is inserted adjacent to the source image
      pageIndex: this._pageIndex,
    };

    this.dispatchEvent(new CustomEvent('note:save', { bubbles: true, composed: false, detail }));

    notify.success('Saved OCR text as note');
    this.close();
  };

  get _isSinglePage() {
    return this._pageIndex !== null;
  }

  get _dialogLabel() {
    if (this._isSinglePage) {
      return `Extract Text — ${this.docName} (Page ${this._pageIndex + 1})`;
    }
    return `Extract All Text — ${this.docName}`;
  }

  render() {
    if (!this.isOpen) return '';

    return html`
      <sl-dialog
        label="${this._dialogLabel}"
        open
        style="--width: min(92%, 560px)"
        @sl-after-hide=${this.close}
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
          <sl-select
            size="small"
            value=${this.lang}
            @sl-change=${this.handleLangChange}
            style="min-width: 180px;"
          >
            ${SUPPORTED_LANGUAGES.map(
              (l) => html`<sl-option value=${l.code}>${l.flag} ${l.label}</sl-option>`,
            )}
          </sl-select>

          ${this.step === 'done'
            ? html`
                <sl-badge
                  variant=${this.confidence >= 75
                    ? 'success'
                    : this.confidence >= 50
                      ? 'warning'
                      : 'danger'}
                >
                  ${this.confidence}% Avg Confidence
                </sl-badge>
              `
            : ''}
        </div>

        ${this.step === 'empty'
          ? html`
              <div style="padding: 2.5rem 1rem; text-align: center; color: #64748b;">
                <sl-icon name="file-earmark-x" style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #94a3b8;"></sl-icon>
                <p style="margin: 0; font-size: 1rem; color: #334155; font-weight: 500;">${this.statusMessage}</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem; color: #64748b;">Add or import an image page before extracting text.</p>
              </div>
            `
          : ''}

        ${this.step === 'processing'
          ? html`
              <div style="padding: 2.5rem 1rem; text-align: center;">
                <div style="font-size: 1.1rem; color: #0284c7; font-weight: 600; margin-bottom: 1rem;">
                  ${this.statusMessage}
                </div>
                <sl-progress-bar value=${this.progress}></sl-progress-bar>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.75rem;">
                  100% Client-Side WebAssembly OCR — zero cloud servers
                </div>
              </div>
            `
          : ''}

        ${this.step === 'error'
          ? html`
              <div style="padding: 2rem; text-align: center; color: #ef4444;">
                <sl-icon name="x-circle-fill" style="font-size: 2rem;"></sl-icon>
                <p style="margin-top: 0.5rem;">${this.statusMessage}</p>
              </div>
            `
          : ''}

        ${this.step === 'done'
          ? html`
              <div>
                <sl-textarea
                  rows="14"
                  .value=${this.resultText}
                  @input=${this.handleTextInput}
                  placeholder="Extracted transcript..."
                ></sl-textarea>
              </div>
            `
          : ''}

        ${this.step === 'processing'
          ? html`
              <sl-button slot="footer" variant="default" @click=${this.cancel}>
                <sl-icon slot="prefix" name="x-lg"></sl-icon>
                Cancel
              </sl-button>
            `
          : ''}
        ${this.step === 'empty' || this.step === 'error'
          ? html`
              <sl-button slot="footer" variant="default" @click=${this.close}>
                Close
              </sl-button>
            `
          : ''}
        ${this.step === 'done'
          ? html`
              <sl-button slot="footer" variant="default" @click=${this.close}>
                Close
              </sl-button>
              <sl-button slot="footer" variant="default" @click=${this.copyText}>
                <sl-icon slot="prefix" name=${this.copied ? 'check' : 'clipboard'}></sl-icon>
                ${this.copied ? 'Copied!' : 'Copy All'}
              </sl-button>
              <sl-button slot="footer" variant="default" @click=${this.downloadText}>
                <sl-icon slot="prefix" name="download"></sl-icon>
                Download .txt
              </sl-button>
              <sl-button slot="footer" variant="default" @click=${this.downloadMarkdown}>
                <sl-icon slot="prefix" name="download"></sl-icon>
                Download .md
              </sl-button>
              <sl-button slot="footer" variant="primary" @click=${this.saveAsNote}>
                <sl-icon slot="prefix" name="file-earmark-plus"></sl-icon>
                Save as Note
              </sl-button>
            `
          : ''}
      </sl-dialog>
    `;
  }
}

if (!customElements.get('copio-doc-ocr-dialog')) {
  customElements.define('copio-doc-ocr-dialog', CopioDocOcrDialog);
}
