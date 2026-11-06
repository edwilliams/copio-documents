import { expect } from '@esm-bundle/chai';
import { store } from '../js/core/store.js';

describe('store.js', () => {
  it('should initialize with docs table and mergeable capabilities', () => {
    expect(store).to.exist;
    expect(typeof store.isMergeable === 'function' && store.isMergeable()).to.be.true;
    const docs = store.getTable('docs');
    expect(docs).to.be.an('object');
  });

  it('should allow setting, reading and deleting doc rows in TinyBase', () => {
    const testDocId = 'test-doc-123';
    store.setRow('docs', testDocId, {
      name: 'Sample Test Doc',
      pages: JSON.stringify([{ id: 'p1', src: 'data:image/png;base64,sample' }]),
    });

    const row = store.getRow('docs', testDocId);
    expect(row).to.exist;
    expect(row.name).to.equal('Sample Test Doc');

    // Clean up
    store.delRow('docs', testDocId);
    expect(store.hasRow('docs', testDocId)).to.be.false;
  });
});
