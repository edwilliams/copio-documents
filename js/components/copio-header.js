// @ts-nocheck
import { LitElement, html, css } from '../lib/lit-core.min.js';

export class CopioHeader extends LitElement {
  static styles = css`
    header {
      background-color: #151f2a;
      color: white;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 8px;
    }
    .header-left,
    .header-right {
      flex: 1;
      display: flex;
      align-items: center;
    }
    .header-right {
      justify-content: flex-end;
    }
    h1 {
      font-size: 24px;
      margin: 0;
    }
    sl-icon-button::part(base) {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `;

  static properties = {
    _storageEstimate: { state: true },
    _isPersisted: { state: true },
  };

  async connectedCallback() {
    super.connectedCallback();
    await this.#updateStorageInfo();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  async #updateStorageInfo() {
    if (navigator.storage) {
      if (navigator.storage.persisted) {
        this._isPersisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        this._storageEstimate = await navigator.storage.estimate();
      }
    }
  }

  _formatBytes(bytes) {
    if (bytes === undefined || bytes === null) return 'Unknown';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  #handleSelect(e) {
    if (e.detail.item.value === 'link-device') {
      this.dispatchEvent(new CustomEvent('header:link-device', { bubbles: true, composed: false }));
      return;
    }
    if (e.detail.item.value === 'clear-cache') {
      this.dispatchEvent(new CustomEvent('header:clear-cache', { bubbles: true, composed: false }));
    }
  }

  render() {
    return html`
      <header>
        <div class="header-left">
          <sl-dropdown @sl-show=${this.#updateStorageInfo}>
            <sl-icon-button
              slot="trigger"
              name="list"
              label="Menu"
              style="font-size: 1.5rem; color: white;"
            ></sl-icon-button>
            <sl-menu @sl-select=${this.#handleSelect}>
              <sl-menu-item value="link-device">Link another device</sl-menu-item>
              <sl-menu-item value="clear-cache">Clear cache &amp; update</sl-menu-item>
              <sl-divider></sl-divider>
              <sl-menu-item disabled>
                Storage: ${this._formatBytes(this._storageEstimate?.usage)} 
                (${this._isPersisted ? 'Persisted' : 'Volatile'})
              </sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        </div>
        <h1>Copio Documents</h1>
        <div class="header-right"></div>
      </header>
    `;
  }
}

customElements.define('copio-header', CopioHeader);
