// SPDX-License-Identifier: AGPL-3.0
/**
 * EdgeDetectorPort — Outbound/Driven Port for Document Edge & Corner Detection
 * (Hexagonal Architecture / CPO-073, CPO-074).
 *
 * Defines the contract that all edge detection adapters (ScanicWasmEdgeAdapter,
 * NullEdgeDetectorAdapter, or optional ML detectors) must implement.
 *
 * Coordinates returned by `detect()` are normalized to `[0, 1]` in clockwise
 * traversal order (`topLeft`, `topRight`, `bottomRight`, `bottomLeft`), along
 * with pixel `corners`, a `confidence` score in `[0, 1]`, and `isFallback`.
 */

/**
 * @typedef {Object} EdgePoint
 * @property {number} x - Coordinate (normalized [0, 1] or pixel coordinate)
 * @property {number} y - Coordinate (normalized [0, 1] or pixel coordinate)
 */

/**
 * @typedef {Object} EdgeQuad
 * @property {EdgePoint} topLeft
 * @property {EdgePoint} topRight
 * @property {EdgePoint} bottomRight
 * @property {EdgePoint} bottomLeft
 */

/**
 * @typedef {Object} EdgeDetectOptions
 * @property {number} [maxProcessingDimension=800] - Maximum dimension for downscaled detection (800 for static capture, 480 for live viewfinder)
 * @property {boolean} [enableDetectionCascade=true] - Whether to run the 4-pass adaptive Canny cascade
 * @property {number} [minConfidence=0.55] - Minimum confidence threshold before falling back or returning null
 * @property {boolean} [fallbackOnLowConfidence=false] - If true, returns the 5%-inset full-frame quad with `isFallback: true` when confidence < minConfidence
 * @property {number} [lowThreshold] - Optional fixed Canny low threshold
 * @property {number} [highThreshold] - Optional fixed Canny high threshold
 * @property {number} [dilationKernelSize] - Optional morphological dilation kernel size
 * @property {boolean} [applyDilation] - Whether to apply morphological dilation
 */

/**
 * @typedef {Object} EdgeDetectionResult
 * @property {EdgeQuad} quad - Normalized [0, 1] clockwise 4-corner coordinates `{ topLeft, topRight, bottomRight, bottomLeft }`
 * @property {EdgeQuad} normalizedCorners - Alias of `quad` (normalized [0, 1] clockwise corners)
 * @property {EdgeQuad} corners - Normalized [0, 1] clockwise 4-corner coordinates `{ topLeft, topRight, bottomRight, bottomLeft }`
 * @property {EdgeQuad} pixelCorners - Pixel coordinates in the input image's coordinate space `{ topLeft, topRight, bottomRight, bottomLeft }`
 * @property {number} confidence - Detection confidence score in `[0, 1]`
 * @property {number} width - Input image width in pixels
 * @property {number} height - Input image height in pixels
 * @property {boolean} isFallback - True if a fallback inset quad was returned due to low confidence
 * @property {number} [durationMs] - Execution time in milliseconds
 */

/**
 * Default 5%-inset full-frame normalized quadrilateral used as fallback when no
 * high-confidence document boundary is found (per ADR 0002 / CPO-074).
 * @type {EdgeQuad}
 */
export const DEFAULT_FALLBACK_QUAD = Object.freeze({
  topLeft: Object.freeze({ x: 0.05, y: 0.05 }),
  topRight: Object.freeze({ x: 0.95, y: 0.05 }),
  bottomRight: Object.freeze({ x: 0.95, y: 0.95 }),
  bottomLeft: Object.freeze({ x: 0.05, y: 0.95 }),
});

/**
 * Clone a normalized or pixel quad.
 * @param {EdgeQuad} quad
 * @returns {EdgeQuad}
 */
export function cloneQuad(quad = DEFAULT_FALLBACK_QUAD) {
  return {
    topLeft: { x: Number(quad.topLeft?.x ?? 0.05), y: Number(quad.topLeft?.y ?? 0.05) },
    topRight: { x: Number(quad.topRight?.x ?? 0.95), y: Number(quad.topRight?.y ?? 0.05) },
    bottomRight: { x: Number(quad.bottomRight?.x ?? 0.95), y: Number(quad.bottomRight?.y ?? 0.95) },
    bottomLeft: { x: Number(quad.bottomLeft?.x ?? 0.05), y: Number(quad.bottomLeft?.y ?? 0.95) },
  };
}

/**
 * Convert a normalized quad to an axis-aligned normalized crop rectangle { x, y, w, h }.
 * @param {EdgeQuad} [quad]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function quadToCropRect(quad) {
  if (!quad) return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const minX = Math.max(0, Math.min(...pts.map((p) => Number(p?.x ?? 0))));
  const maxX = Math.min(1, Math.max(...pts.map((p) => Number(p?.x ?? 1))));
  const minY = Math.max(0, Math.min(...pts.map((p) => Number(p?.y ?? 0))));
  const maxY = Math.min(1, Math.max(...pts.map((p) => Number(p?.y ?? 1))));
  const w = Math.max(0.01, Math.min(1 - minX, maxX - minX));
  const h = Math.max(0.01, Math.min(1 - minY, maxY - minY));
  return {
    x: Math.round(minX * 1000) / 1000,
    y: Math.round(minY * 1000) / 1000,
    w: Math.round(w * 1000) / 1000,
    h: Math.round(h * 1000) / 1000,
  };
}

/**
 * Base contract for EdgeDetectorPort implementations.
 */
export class EdgeDetectorPort {
  /**
   * Detect 4 document corners in an image or video frame.
   * @param {ImageData|{ data: Uint8ClampedArray|Uint8Array, width: number, height: number }|HTMLCanvasElement|OffscreenCanvas|HTMLImageElement|HTMLVideoElement|ImageBitmap|Blob|string} _image
   * @param {EdgeDetectOptions} [_options]
   * @returns {Promise<EdgeDetectionResult|null>}
   */
  async detect(_image, _options = {}) {
    throw new Error('EdgeDetectorPort.detect() must be implemented by adapter');
  }

  /**
   * Obtain or initialize the underlying edge detection Web Worker / WASM runtime.
   * @returns {Promise<any>}
   */
  async getEdgeWorker() {
    throw new Error('EdgeDetectorPort.getEdgeWorker() must be implemented by adapter');
  }

  /**
   * Terminate the active edge detection worker and release memory.
   * @returns {Promise<void>}
   */
  async terminateEdgeWorker() {
    throw new Error('EdgeDetectorPort.terminateEdgeWorker() must be implemented by adapter');
  }
}
