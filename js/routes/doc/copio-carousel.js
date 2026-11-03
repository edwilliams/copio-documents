// @ts-nocheck
import { LitElement, html, css } from '../../lib/lit-core.min.js';
import { loadMarked } from '../../utils/module-loader.js';

export class CopioCarousel extends LitElement {
  disconnectedCallback() {
    super.disconnectedCallback();
    this.activeSlideIndex = 0;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('images') && Array.isArray(this.images)) {
      if (this.images.some((img) => img.type === 'markdown') && (!window.marked || !window.marked.parse)) {
        loadMarked().then(() => this.requestUpdate());
      }
    }
  }

  static properties = {
    docId: { type: String },
    docName: { type: String },
    images: { type: Array },
    activeSlideIndex: { type: Number, state: true },
    ocr: { type: Boolean },
    pdf: { type: Boolean },
  };

  get hasImages() {
    return (this.images || []).some((img) => img.type !== 'markdown' && !!img.src);
  }

  get hasMarkdown() {
    return (this.images || []).some((img) => img.type === 'markdown');
  }

  get pageCount() {
    return (this.images || []).length;
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      overflow: hidden;
      background: #000;
      box-sizing: border-box;
    }
    sl-carousel {
      position: absolute;
      top: 0;
      padding-top: 16px;
      background: white;
      z-index: 4;
      height: 100%;
      width: 100%;
    }
    sl-carousel-item {
      height: 100%;
    }
    .item {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      background-size: contain;
      background-position: center;
    }
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: linear-gradient(to bottom, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.3) 80%, transparent 100%);
      pointer-events: none;
      box-sizing: border-box;
    }
    .top-bar > * {
      pointer-events: auto;
    }
    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back {
      font-size: 26px;
      cursor: pointer;
      appearance: none;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .back:hover {
      background: rgba(15, 23, 42, 0.9);
    }
    .doc-heading {
      color: #f8fafc;
      font-size: 1.05rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }
    .ocr-btn, .export-btn {
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 6px 12px;
      height: 36px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      box-sizing: border-box;
    }
    .ocr-btn:hover, .export-btn:hover {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(255, 255, 255, 0.4);
    }
    .markdown-container {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 60px 24px 24px 24px;
      overflow-y: auto;
      background: #151f2a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    .markdown-body {
      max-width: 800px;
      margin: 0 auto;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
      color: #f1f5f9;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 0.3em;
    }
    .markdown-body h1 { font-size: 2em; }
    .markdown-body h2 { font-size: 1.5em; }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body p { margin-top: 0; margin-bottom: 1em; }
    .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 1em; }
    .markdown-body li { margin-bottom: 0.3em; }
    .markdown-body code {
      background: rgba(255,255,255,0.1);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .markdown-body pre {
      background: #0f172a;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .markdown-body pre code { background: none; padding: 0; }
    .markdown-body blockquote {
      border-left: 4px solid #38bdf8;
      margin: 1em 0;
      padding-left: 1em;
      color: #cbd5e1;
      font-style: italic;
    }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid rgba(255,255,255,0.15);
      padding: 8px 12px;
      text-align: left;
    }
    .markdown-body th {
      background: rgba(255,255,255,0.1);
    }
    .markdown-body img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }
  `;

  constructor() {
    super();
    this.docId = '';
    this.docName = '';
    this.images = [];
    this.activeSlideIndex = 0;
    this.ocr = true;
    this.pdf = true;
  }

  handleBackClick() {
    this.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, composed: false }));
  }

  handleOcrClick() {
    const activePage = this.images[this.activeSlideIndex];
    if (!activePage || activePage.type === 'markdown' || !activePage.src) return;

    this.dispatchEvent(
      new CustomEvent('copio:ocr-page', {
        bubbles: true,
        composed: true,
        detail: {
          page: activePage,
          pageIndex: this.activeSlideIndex,
        },
      }),
    );
  }

  handleExportSelect(e) {
    if (e.detail?.item?.disabled) return;
    const value = e.detail?.item?.value;
    const detail = {
      docId: this.docId,
      docName: this.docName,
      pages: this.images,
    };

    if (value === 'pdf') {
      this.dispatchEvent(new CustomEvent('doc:download-pdf', { bubbles: true, composed: false, detail }));
    } else if (value === 'images') {
      this.dispatchEvent(new CustomEvent('doc:download-images', { bubbles: true, composed: false, detail }));
    } else if (value === 'markdown') {
      this.dispatchEvent(new CustomEvent('doc:download-markdown', { bubbles: true, composed: false, detail }));
    }
  }

  handleSlideChange(e) {
    this.activeSlideIndex = e.detail?.index || 0;
  }

  renderItem(img) {
    if (img.type === 'markdown') {
      const rawContent = img.content || '';
      const htmlContent = window.marked && window.marked.parse ? window.marked.parse(rawContent) : rawContent;
      return html`
        <sl-carousel-item data-id="${img.id}">
          <div class="markdown-container">
            <div class="markdown-body" .innerHTML=${htmlContent}></div>
          </div>
        </sl-carousel-item>
      `;
    }
    return html`
      <sl-carousel-item data-id="${img.id}">
        <div class="item" style="background-image: url('${img.src}')"></div>
      </sl-carousel-item>
    `;
  }

  render() {
    const activePage = this.images[this.activeSlideIndex];
    const canOcr = this.ocr !== false && activePage && activePage.type !== 'markdown' && !!activePage.src;

    return html`
      <div class="top-bar">
        <div class="top-bar-left">
          <button class="back" @click=${this.handleBackClick} aria-label="Back">←</button>
          <span class="doc-heading">${this.docName || 'Document'}</span>
        </div>

        <div class="top-bar-right">
          ${canOcr
            ? html`
                <button class="ocr-btn" @click=${this.handleOcrClick} aria-label="Extract text">
                  <sl-icon name="card-text"></sl-icon>
                  <span>Extract Text</span>
                </button>
              `
            : ''}

          <sl-dropdown>
            <button slot="trigger" class="export-btn" aria-label="Export document">
              <sl-icon name="box-arrow-up"></sl-icon>
              <span>Export</span>
              <sl-icon name="chevron-down" style="font-size: 0.75rem;"></sl-icon>
            </button>
            <sl-menu @sl-select=${this.handleExportSelect}>
              ${this.pdf !== false
                ? html`
                    <sl-menu-item value="pdf" ?disabled=${this.pageCount === 0}>
                      <sl-icon slot="prefix" name="file-earmark-pdf"></sl-icon>
                      Download as PDF
                    </sl-menu-item>
                  `
                : ''}
              <sl-menu-item value="images" ?disabled=${this.pageCount === 0}>
                <sl-icon slot="prefix" name="images"></sl-icon>
                Download as Images (ZIP)
              </sl-menu-item>
              <sl-menu-item value="markdown" ?disabled=${!this.hasMarkdown}>
                <sl-icon slot="prefix" name="markdown"></sl-icon>
                Download as Markdown
              </sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        </div>
      </div>

      <sl-carousel
        class="sl-carousel"
        orientation="vertical"
        @sl-slide-change=${this.handleSlideChange}
      >
        ${this.images.map((img) => this.renderItem(img))}
      </sl-carousel>
    `;
  }
}

if (!customElements.get('copio-carousel')) {
  customElements.define('copio-carousel', CopioCarousel);
}
