import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { router } from '../js/core/router.js';
import { store, persister } from '../js/core/store.js';

describe('Copio Scanner Batch Mode Integration', () => {
  let fixture;

  beforeEach(async () => {
    store.delTable('docs');
    await persister.save();
    router.navigate('/');

    fixture = document.createElement('div');
    document.body.appendChild(fixture);
  });

  afterEach(async () => {
    fixture?.remove();
    store.delTable('docs');
    await persister.save();
    router.navigate('/');
  });

  it('embeds <copio-scanner> configured in batch mode with a4 aspect in copio-add-edit-dialog', async () => {
    const dialog = document.createElement('copio-add-edit-dialog');
    fixture.appendChild(dialog);
    await dialog.updateComplete;

    const scanner = dialog.querySelector('copio-scanner');
    expect(scanner).to.exist;
    expect(scanner.getAttribute('mode')).to.equal('batch');
    expect(scanner.getAttribute('aspect')).to.equal('a4');
    expect(scanner.getAttribute('features')).to.include('crop');
    expect(scanner.getAttribute('features')).to.include('rotate');
    expect(scanner.getAttribute('features')).to.include('filter');
    expect(scanner.getAttribute('features')).to.include('ocr');
  });

  it('syncs scanned pages from <copio-scanner> to copio-images on copio:scan-complete', async () => {
    const dialog = document.createElement('copio-add-edit-dialog');
    fixture.appendChild(dialog);
    await dialog.updateComplete;

    const scanner = dialog.querySelector('copio-scanner');
    const copioImages = dialog.querySelector('copio-images');
    const inputName = dialog.querySelector('.dialog-add-edit-input-name');

    expect(scanner).to.exist;
    expect(copioImages).to.exist;

    const testPages = [
      {
        id: 'scan_p1',
        label: 'Invoice Page 1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        edits: { crop: null, rotation: 0, filter: 'none' },
      },
      {
        id: 'scan_p2',
        label: 'Invoice Page 2',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        edits: { crop: null, rotation: 0, filter: 'none' },
      },
    ];

    scanner.dispatchEvent(
      new CustomEvent('copio:scan-complete', {
        bubbles: true,
        composed: true,
        detail: {
          mode: 'batch',
          aspect: 'a4',
          pageCount: 2,
          pages: testPages,
        },
      }),
    );

    await dialog.updateComplete;

    expect(copioImages.images).to.have.lengthOf(2);
    expect(copioImages.images[0].id).to.equal('scan_p1');
    expect(copioImages.images[1].id).to.equal('scan_p2');
    expect(inputName.value).to.include('Scan ');
  });

  it('renders a single Add Document button in empty state and single plus button in FAB', async () => {
    const app = document.createElement('copio-app');
    fixture.appendChild(app);
    await app.updateComplete;

    const emptyButtons = app.querySelectorAll('.empty-state sl-button');
    expect(emptyButtons).to.have.lengthOf(1);
    expect(emptyButtons[0].textContent).to.include('Add Document');

    const fabButtons = app.querySelectorAll('.copio-fab-wrap sl-icon-button');
    expect(fabButtons).to.have.lengthOf(1);
    expect(fabButtons[0].classList.contains('dialog-add-edit-btn')).to.be.true;
    expect(app.querySelector('.dialog-scan-btn')).to.not.exist;
  });

  it('hides scanner and reveals copio-images on copio:scan-complete', async () => {
    const dialog = document.createElement('copio-add-edit-dialog');
    fixture.appendChild(dialog);
    await dialog.updateComplete;
    await dialog.open();

    const scanner = dialog.querySelector('copio-scanner');
    const scannerHost = dialog.querySelector('.modal-scanner-host');
    const copioImages = dialog.querySelector('copio-images');
    const toggleBtn = dialog.querySelector('.btn-toggle-scanner');

    expect(scannerHost.style.display).to.equal('block');
    expect(copioImages.style.display).to.equal('none');
    expect(toggleBtn.style.display).to.equal('none');

    const testPages = [
      {
        id: 'scan_p1',
        label: 'Page 1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        edits: { crop: null, rotation: 0, filter: 'none' },
      },
    ];

    scanner.dispatchEvent(
      new CustomEvent('copio:scan-complete', {
        bubbles: true,
        composed: true,
        detail: {
          mode: 'batch',
          aspect: 'a4',
          pageCount: 1,
          pages: testPages,
        },
      }),
    );

    await dialog.updateComplete;

    expect(scannerHost.style.display).to.equal('none');
    expect(copioImages.style.display).to.equal('block');
    expect(toggleBtn.style.display).to.equal('inline-flex');
    expect(copioImages.images).to.have.lengthOf(1);
  });

  it('saves scanned document with pages correctly', async () => {
    const app = document.createElement('copio-app');
    fixture.appendChild(app);
    await app.updateComplete;

    router.navigate('/add');
    await new Promise((r) => setTimeout(r, 50));
    await app.updateComplete;

    const dialog = app.querySelector('copio-add-edit-dialog');
    const scanner = dialog.querySelector('copio-scanner');

    const testPages = [
      {
        id: 'p_save_1',
        label: 'Doc Page 1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        edits: { crop: null, rotation: 0, filter: 'none' },
      },
    ];

    scanner.dispatchEvent(
      new CustomEvent('copio:scan-complete', {
        bubbles: true,
        composed: true,
        detail: {
          mode: 'batch',
          aspect: 'a4',
          pageCount: 1,
          pages: testPages,
        },
      }),
    );

    const saveBtn = dialog.querySelector('.dialog-add-edit-savebtn');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 100));
    await app.updateComplete;

    const docs = store.getTable('docs');
    const docIds = Object.keys(docs);
    expect(docIds.length).to.be.greaterThan(0);
    const savedDoc = docs[docIds[0]];
    expect(savedDoc.name).to.include('Scan ');
    const savedPages = JSON.parse(savedDoc.pages);
    expect(savedPages).to.have.lengthOf(1);
    expect(savedPages[0].id).to.equal('p_save_1');
  });

  it('navigates to /scan and opens add/edit dialog with batch scanner', async () => {
    const app = document.createElement('copio-app');
    fixture.appendChild(app);
    await app.updateComplete;

    router.navigate('/scan');
    await new Promise((r) => setTimeout(r, 50));
    await app.updateComplete;

    const dialog = app.querySelector('copio-add-edit-dialog');
    const slDialog = dialog.querySelector('.dialog-add-edit');
    expect(slDialog.open).to.be.true;

    const scanner = dialog.querySelector('copio-scanner');
    expect(scanner.getAttribute('mode')).to.equal('batch');
    expect(scanner.getAttribute('aspect')).to.equal('a4');
  });

  it('does not create ghost "Scanned Document" in store while scanning and preserves saved doc "foo"', async () => {
    const app = document.createElement('copio-app');
    fixture.appendChild(app);
    await app.updateComplete;

    router.navigate('/add');
    await new Promise((r) => setTimeout(r, 50));
    await app.updateComplete;

    const dialog = app.querySelector('copio-add-edit-dialog');
    const scanner = dialog.querySelector('copio-scanner');
    const inputName = dialog.querySelector('.dialog-add-edit-input-name');

    // Simulate scanning pages into scanner
    const testPages = [
      {
        id: 'p_batch_1',
        label: 'Receipt Page 1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        edits: { crop: null, rotation: 0, filter: 'none' },
      },
    ];

    scanner.dispatchEvent(
      new CustomEvent('copio:pages-changed', {
        bubbles: true,
        composed: true,
        detail: { pages: testPages, docId: scanner.docId },
      }),
    );

    // Verify no ghost "Scanned Document" was injected into the app store
    expect(Object.keys(store.getTable('docs'))).to.have.lengthOf(0);

    // Complete scan
    scanner.dispatchEvent(
      new CustomEvent('copio:scan-complete', {
        bubbles: true,
        composed: true,
        detail: {
          mode: 'batch',
          aspect: 'a4',
          pageCount: 1,
          pages: testPages,
        },
      }),
    );

    // User types "foo" as doc name
    inputName.value = 'foo';

    const saveBtn = dialog.querySelector('.dialog-add-edit-savebtn');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 150));
    await app.updateComplete;

    // Verify "foo" is saved in store and no "Scanned Document" exists
    const docs = store.getTable('docs');
    const docEntries = Object.entries(docs);
    expect(docEntries).to.have.lengthOf(1);
    const [savedId, docData] = docEntries[0];
    expect(docData.name).to.equal('foo');
    expect(JSON.parse(docData.pages)).to.have.lengthOf(1);

    // Verify after another tick and storage persister cycles that "foo" is NOT deleted
    await new Promise((r) => setTimeout(r, 150));
    expect(store.getTable('docs')[savedId]).to.exist;
    expect(store.getTable('docs')[savedId].name).to.equal('foo');
  });
});
