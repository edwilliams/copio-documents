// @ts-nocheck
import { LitElement, html, css } from '../../lib/lit-core.min.js';

export class CopioRow extends LitElement {
  static properties = {
    name: { type: String },
    pages: { type: Array },
    isRenaming: { type: Boolean, state: true },
    renameValue: { type: String, state: true },
    ocr: { type: Boolean },
    pdf: { type: Boolean },
  };

  constructor() {
    super();
    this.name = '';
    this.pages = [];
    this.isRenaming = false;
    this.renameValue = '';
    this.ocr = true;
    this.pdf = true;
  }

  get hasImages() {
    return (this.pages || []).some((p) => p.type !== 'markdown' && !!p.src);
  }

  get hasMarkdown() {
    return (this.pages || []).some((p) => p.type === 'markdown');
  }

  get pageCount() {
    return (this.pages || []).length;
  }

  static styles = css`
    .wrapper {
      margin-left: auto;
      margin-right: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 768px;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      cursor: pointer;
      user-select: none;
    }
    .inner {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    }
    .titles {
      display: flex;
      flex-direction: column;
      margin-left: 12px;
      padding: 2px 0;
      flex: 1;
      min-width: 0;
    }
    .doc-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: #151f2a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }
    .doc-page-count {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 2px;
    }
    .rename-container {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      max-width: 320px;
    }
    .rename-container sl-input {
      flex: 1;
    }
    button {
      appearance: none;
      border: none;
      color: black;
      padding: 3px 4px 3px 7px;
      background: white;
      cursor: pointer;
    }
  `;

  #handleWrapperClick(e) {
    if (this.isRenaming) return;
    if (e.target.closest('sl-dropdown') || e.target.closest('.rename-container')) return;
    this.handleView();
  }

  #handleMenuSelect(e) {
    if (e.detail?.item?.disabled) return;
    const selected = e.detail?.item?.value;
    if (selected === 'delete') this.handleDelete();
    if (selected === 'rename') this.startRename();
    if (selected === 'edit') this.handleEdit();
    if (selected === 'extract-ocr') this.handleExtractOcr();
    if (selected === 'download') this.handleDownload();
    if (selected === 'download-images') this.handleDownloadImages();
    if (selected === 'download-markdown') this.handleDownloadMarkdown();
  }

  startRename(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.renameValue = this.name || '';
    this.isRenaming = true;
    this.updateComplete.then(() => {
      const input = this.shadowRoot.querySelector('.rename-input');
      if (input) {
        input.focus();
        if (typeof input.select === 'function') {
          input.select();
        }
      }
    });
  }

  cancelRename(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.isRenaming = false;
    this.renameValue = this.name || '';
  }

  commitRename(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = (this.renameValue || '').trim();
    if (!trimmed) {
      this.cancelRename();
      return;
    }

    if (trimmed !== this.name) {
      const detail = { id: this.getAttribute('id'), name: trimmed };
      this.dispatchEvent(new CustomEvent('doc:rename', { bubbles: true, composed: false, detail }));
      this.name = trimmed;
    }
    this.isRenaming = false;
  }

  handleRenameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelRename();
    }
  }

  handleExtractOcr() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:extract-ocr', { bubbles: true, composed: false, detail }));
  }

  handleView() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:view', { bubbles: true, composed: false, detail }));
  }

  handleDelete() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:delete', { bubbles: true, composed: false, detail }));
  }

  handleEdit() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:edit', { bubbles: true, composed: false, detail }));
  }

  handleDownload() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:download', { bubbles: true, composed: false, detail }));
  }

  handleDownloadImages() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:download-images', { bubbles: true, composed: false, detail }));
  }

  handleDownloadMarkdown() {
    const detail = { id: this.getAttribute('id') };
    this.dispatchEvent(new CustomEvent('doc:download-markdown', { bubbles: true, composed: false, detail }));
  }

  render() {
    return html`
      <div class="wrapper" @click=${this.#handleWrapperClick}>
        <div class="inner">
          <sl-avatar label="Document icon">
            <sl-icon slot="icon" name="file-earmark-text"></sl-icon>
          </sl-avatar>

          <div class="titles">
            ${this.isRenaming
              ? html`
                  <div class="rename-container" @click=${(e) => e.stopPropagation()}>
                    <sl-input
                      class="rename-input"
                      size="small"
                      .value=${this.renameValue}
                      @sl-input=${(e) => (this.renameValue = e.target.value)}
                      @keydown=${this.handleRenameKeyDown}
                    ></sl-input>
                    <sl-icon-button
                      name="check-lg"
                      label="Save rename"
                      @click=${this.commitRename}
                    ></sl-icon-button>
                    <sl-icon-button
                      name="x-lg"
                      label="Cancel rename"
                      @click=${this.cancelRename}
                    ></sl-icon-button>
                  </div>
                `
              : html`
                  <div class="doc-title">${this.name || 'Untitled Document'}</div>
                  <div class="doc-page-count">
                    ${this.pageCount} ${this.pageCount === 1 ? 'page' : 'pages'}
                  </div>
                `}
          </div>
        </div>

        <sl-dropdown>
          <sl-button slot="trigger" variant="default" size="small" circle>
            <sl-icon name="three-dots-vertical"></sl-icon>
          </sl-button>
          <sl-menu @sl-select=${this.#handleMenuSelect}>
            <sl-menu-item value="edit">
              <sl-icon slot="prefix" name="sliders"></sl-icon>
              Edit
            </sl-menu-item>
            <sl-menu-item value="rename">
              <sl-icon slot="prefix" name="pencil"></sl-icon>
              Rename
            </sl-menu-item>
            ${this.ocr !== false
              ? html`
                  <sl-menu-item
                    value="extract-ocr"
                    ?disabled=${!this.hasImages}
                    title=${!this.hasImages ? 'No image pages in document' : 'Extract text with OCR'}
                  >
                    <sl-icon slot="prefix" name="card-text"></sl-icon>
                    Extract All Text (OCR)
                  </sl-menu-item>
                `
              : ''}
            <sl-divider></sl-divider>
            ${this.pdf !== false
              ? html`
                  <sl-menu-item
                    value="download"
                    ?disabled=${this.pageCount === 0}
                    title=${this.pageCount === 0 ? 'Document is empty' : 'Download as PDF'}
                  >
                    <sl-icon slot="prefix" name="file-earmark-pdf"></sl-icon>
                    Download as PDF
                  </sl-menu-item>
                `
              : ''}
            <sl-menu-item
              value="download-images"
              ?disabled=${this.pageCount === 0}
              title=${this.pageCount === 0 ? 'Document is empty' : 'Download as Images'}
            >
              <sl-icon slot="prefix" name="images"></sl-icon>
              Download as Images
            </sl-menu-item>
            <sl-menu-item
              value="download-markdown"
              ?disabled=${!this.hasMarkdown}
              title=${!this.hasMarkdown ? 'No markdown notes in document' : 'Download as Markdown'}
            >
              <sl-icon slot="prefix" name="markdown"></sl-icon>
              Download as Markdown
            </sl-menu-item>
            <sl-divider></sl-divider>
            <sl-menu-item value="delete">
              <sl-icon slot="prefix" name="trash"></sl-icon>
              Delete
            </sl-menu-item>
          </sl-menu>
        </sl-dropdown>
      </div>
    `;
  }
}

if (!customElements.get('copio-row')) {
  customElements.define('copio-row', CopioRow);
}
