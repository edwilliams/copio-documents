import { expect } from '@esm-bundle/chai';
import '../vendor/copio.0.1.2.js';

describe('Copio Documents — Vendor SDK Integration', () => {
  it('registers <copio-scanner> custom element from vendor/copio.0.1.2.js', () => {
    expect(customElements.get('copio-scanner')).to.be.a('function');
  });

  it('mounts <copio-scanner> with encapsulated shadow DOM', () => {
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
    expect(scanner.shadowRoot).to.exist;
    expect(scanner.shadowRoot.querySelector('.copio-scanner-container')).to.exist;
    document.body.removeChild(scanner);
  });
});
