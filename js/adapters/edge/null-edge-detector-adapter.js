// SPDX-License-Identifier: AGPL-3.0
/**
 * NullEdgeDetectorAdapter — No-Op Driven Adapter for Document Edge Detection (CPO-074).
 *
 * Used when automatic edge detection is disabled or opted out by the developer,
 * or in headless environments where no detector is desired.
 * Guarantees ZERO dynamic imports, ZERO Worker instantiation, and ZERO WASM loads.
 */
import { EdgeDetectorPort } from './edge-detector-port.js';

export class NullEdgeDetectorAdapter extends EdgeDetectorPort {
  #throwOnDetect = false;

  /**
   * @param {Object} [options]
   * @param {boolean} [options.throwOnDetect=false] - Whether detect() should throw FEATURE_DISABLED instead of returning null
   */
  constructor(options = {}) {
    super();
    this.#throwOnDetect = Boolean(options.throwOnDetect);
  }

  /**
   * Returns null (or throws FEATURE_DISABLED when configured) without spawning any Worker or WASM.
   * @param {any} _image
   * @param {import('./edge-detector-port.js').EdgeDetectOptions} [_options]
   * @returns {Promise<import('./edge-detector-port.js').EdgeDetectionResult|null>}
   */
  async detect(_image, _options = {}) {
    if (this.#throwOnDetect) {
      const err = new Error('Feature "edge" is disabled or EdgeDetector module not opted in');
      // @ts-ignore
      err.code = 'FEATURE_DISABLED';
      throw err;
    }
    return null;
  }

  /**
   * Returns null without instantiating any WASM or Web Worker thread.
   * @returns {Promise<null>}
   */
  async getEdgeWorker() {
    return null;
  }

  /**
   * No-op termination.
   * @returns {Promise<void>}
   */
  async terminateEdgeWorker() {}
}
