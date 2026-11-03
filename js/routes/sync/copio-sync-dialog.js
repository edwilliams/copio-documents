// @ts-nocheck
import { LitElement, html } from '../../lib/lit-core.min.js';

export class CopioSyncDialog extends LitElement {
  static properties = {
    syncState: { type: Object }
  };

  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.closeSyncDialog();
  }

  handleCloseClick = () => {
    const dialog = this.querySelector('sl-dialog');
    if (dialog && typeof dialog.hide === 'function') {
      dialog.hide();
    } else {
      this.closeSyncDialog();
    }
  };

  closeSyncDialog = () => {
    this.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, composed: false }));
  };

  render() {
    if (!this.syncState) return '';
    const { step, qrSvg, url, added, message } = this.syncState;
    let body;
    if (step === 'init') {
      body = html`<sl-spinner></sl-spinner> Setting up…`;
    } else if (step === 'waiting') {
      body = html`
        <div .innerHTML=${qrSvg}></div>
        ${url
          ? html`
              <div style="margin: 0.75rem 0; word-break: break-all;">
                <a
                  class="sync-link"
                  href=${url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="color: var(--sl-color-primary-600, #0284c7); text-decoration: underline; font-size: 0.85rem;"
                >
                  ${url}
                </a>
              </div>
            `
          : ''}
        <p style="margin-top: 0.5rem; color: #6b7280; font-size: 0.9rem;">Waiting for other device…</p>
      `;
    } else if (step === 'connecting') {
      body = html`<sl-spinner></sl-spinner> Connecting…`;
    } else if (step === 'syncing') {
      body = html`<sl-spinner></sl-spinner> Syncing…`;
    } else if (step === 'done') {
      body = html`<p>
        Sync complete — ${added} doc${added !== 1 ? 's' : ''} added.
      </p>`;
    } else if (step === 'error') {
      body = html`<p style="color:var(--sl-color-danger-600)">
        Error: ${message}
      </p>`;
    }
    return html`
      <sl-dialog
        label="Link Device"
        open
        @sl-after-hide=${this.closeSyncDialog}
      >
        <div style="text-align:center;padding:1rem">${body}</div>
        <sl-button slot="footer" class="sync-close-btn" @click=${this.handleCloseClick}
          >Close</sl-button
        >
      </sl-dialog>
    `;
  }
}

if (!customElements.get('copio-sync-dialog')) {
  customElements.define('copio-sync-dialog', CopioSyncDialog);
}
