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

  it('renders Scan Document triggers in copio-app empty state and FAB', async () => {
    const app = document.createElement('copio-app');
    fixture.appendChild(app);
    await app.updateComplete;

    const emptyScanBtn = app.querySelector('.empty-state sl-button[variant="primary"]');
    expect(emptyScanBtn).to.exist;
    expect(emptyScanBtn.textContent).to.include('Scan Document');

    const fabScanBtn = app.querySelector('.dialog-scan-btn');
    expect(fabScanBtn).to.exist;
    expect(fabScanBtn.getAttribute('label')).to.equal('Scan Document');
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
});
