import '../components/copio-app.js';
import '../components/copio-loader.js';
import '../components/copio-header.js';
import '../routes/home/copio-row.js';
import '../routes/doc/copio-images.js';
import '../routes/doc/copio-carousel.js';
import '../routes/ocr/copio-doc-ocr-dialog.js';
import '../routes/sync/copio-sync-dialog.js';
import '../routes/add-edit/copio-add-edit-dialog.js';
import '../../vendor/copio.0.1.2.js';

// =============================================
// Show UI when custom components are ready
// note: might not be great loading this before app.js
// =============================================

// trick borrow from shoelace; prevents flash of unstyled content
await Promise.allSettled([
  // shoelace
  customElements.whenDefined('sl-button'),
  customElements.whenDefined('sl-icon'),
  customElements.whenDefined('sl-input'),
  customElements.whenDefined('sl-dialog'),
  customElements.whenDefined('sl-menu'),
  customElements.whenDefined('sl-menu-item'),
  customElements.whenDefined('sl-dropdown'),
  customElements.whenDefined('sl-icon-button'),
  customElements.whenDefined('sl-alert'),
  customElements.whenDefined('sl-avatar'),
  customElements.whenDefined('sl-carousel'),
  customElements.whenDefined('sl-carousel-item'),
  customElements.whenDefined('sl-divider'),
  customElements.whenDefined('sl-spinner'),
  customElements.whenDefined('sl-textarea'),
  customElements.whenDefined('sl-progress-bar'),
  customElements.whenDefined('sl-badge'),
  customElements.whenDefined('sl-select'),
  customElements.whenDefined('sl-option'),
  customElements.whenDefined('sl-copy-button'),
  customElements.whenDefined('sl-tooltip'),
  customElements.whenDefined('sl-tab-group'),
  customElements.whenDefined('sl-tab'),
  customElements.whenDefined('sl-tab-panel'),
  // copio
  customElements.whenDefined('copio-scanner'),
  customElements.whenDefined('copio-app'),
  customElements.whenDefined('copio-loader'),
  customElements.whenDefined('copio-header'),
  customElements.whenDefined('copio-row'),
  customElements.whenDefined('copio-images'),
  customElements.whenDefined('copio-carousel'),
  customElements.whenDefined('copio-doc-ocr-dialog'),
  customElements.whenDefined('copio-sync-dialog'),
  customElements.whenDefined('copio-add-edit-dialog'),
]);

document.body.classList.add('ready');
