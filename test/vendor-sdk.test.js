import { expect } from '@esm-bundle/chai';
import { setAssetBase } from '../vendor/copio-sdk/cdn.js';

setAssetBase(new URL('../vendor/copio-sdk/', import.meta.url).href);

describe('Copio Documents — Vendor SDK Integration', () => {
  it('registers <copio-scanner> custom element from vendor/copio-sdk/cdn.js', () => {
    expect(customElements.get('copio-scanner')).to.be.a('function');
  });

  it('mounts <copio-scanner> with encapsulated shadow DOM', () => {
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
    expect(scanner.shadowRoot).to.exist;
    expect(scanner.shadowRoot.querySelector('.copio-scanner-container')).to.exist;
    document.body.removeChild(scanner);
  });

  it('registers ScanicWasmEdgeAdapter out of the box for live viewfinder edge detection', async function () {
    this.timeout(15000);
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);

    expect(scanner.engine.edgeDetector).to.exist;

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 400, 500);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, 60, 280, 380);

    const result = await scanner.engine.edgeDetector.detect(canvas, {
      detector: 'ml',
      fallbackOnLowConfidence: true,
    });
    expect(result).to.exist;
    expect(result.quad).to.exist;
    expect(result.quad.topLeft).to.have.all.keys('x', 'y');
    expect(result.quad.bottomRight).to.have.all.keys('x', 'y');

    document.body.removeChild(scanner);
  });
});
