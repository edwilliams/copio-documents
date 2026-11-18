// SPDX-License-Identifier: AGPL-3.0
/**
 * ScanicWasmEdgeAdapter — Driven Adapter for Document Edge Detection
 * powered by Scanic v1.7.1 Classical (MIT-licensed Rust -> WebAssembly) (CPO-074).
 *
 * Runs Canny edge detection + morphological dilation + 4-pass adaptive cascade
 * inside a dedicated Web Worker (with automatic in-process fallback in headless
 * Node.js or restricted Worker environments), keeping the main thread at 60 fps
 * and adding 0 KB to the initial `<copio-scanner>` bundle.
 */
import { EdgeDetectorPort, DEFAULT_FALLBACK_QUAD, cloneQuad } from './edge-detector-port.js';
import { getAssetBase, resolveAssetUrl } from '../../utils/module-loader.js';

/**
 * Scale a normalized [0, 1] quad to pixel coordinates.
 * @param {import('./edge-detector-port.js').EdgeQuad} normQuad
 * @param {number} width
 * @param {number} height
 * @returns {import('./edge-detector-port.js').EdgeQuad}
 */
function denormalizeQuad(normQuad, width, height) {
  return {
    topLeft: { x: normQuad.topLeft.x * width, y: normQuad.topLeft.y * height },
    topRight: { x: normQuad.topRight.x * width, y: normQuad.topRight.y * height },
    bottomRight: { x: normQuad.bottomRight.x * width, y: normQuad.bottomRight.y * height },
    bottomLeft: { x: normQuad.bottomLeft.x * width, y: normQuad.bottomLeft.y * height },
  };
}

/**
 * Clamp a number to [0, 1].
 * @param {number} v
 * @returns {number}
 */
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/**
 * Ensure a normalized quad has clockwise corner ordering (`topLeft`, `topRight`, `bottomRight`, `bottomLeft`)
 * and coordinates clamped to `[0, 1]`.
 * @param {import('./edge-detector-port.js').EdgeQuad} quad
 * @returns {import('./edge-detector-port.js').EdgeQuad}
 */
function sanitizeNormalizedQuad(quad) {
  const pts = [
    { x: clamp01(quad.topLeft.x), y: clamp01(quad.topLeft.y) },
    { x: clamp01(quad.topRight.x), y: clamp01(quad.topRight.y) },
    { x: clamp01(quad.bottomRight.x), y: clamp01(quad.bottomRight.y) },
    { x: clamp01(quad.bottomLeft.x), y: clamp01(quad.bottomLeft.y) },
  ];
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let tlIndex = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = pts[i].x + pts[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIndex = i;
    }
  }
  return {
    topLeft: pts[tlIndex],
    topRight: pts[(tlIndex + 1) % 4],
    bottomRight: pts[(tlIndex + 2) % 4],
    bottomLeft: pts[(tlIndex + 3) % 4],
  };
}

let scratchCanvas = null;
let scratchCtx = null;

/**
 * Extract RGBA pixel buffer `{ data, width, height }` from supported image sources.
 * @param {any} source
 * @returns {Promise<{ data: Uint8ClampedArray|Uint8Array, width: number, height: number }>}
 */
async function extractRgbaFromSource(source) {
  if (!source) {
    throw new Error('ScanicWasmEdgeAdapter.detect(): No image source provided');
  }

  // 1. ImageData or raw pixel object `{ data, width, height }`
  if (
    typeof source.width === 'number' &&
    typeof source.height === 'number' &&
    source.data &&
    (source.data instanceof Uint8ClampedArray || source.data instanceof Uint8Array)
  ) {
    if (!(source.width > 0 && source.height > 0)) {
      throw new Error('ScanicWasmEdgeAdapter.detect(): Image has invalid dimensions');
    }
    return {
      data: source.data,
      width: source.width,
      height: source.height,
    };
  }

  // 2. String URL / Data URL or Blob -> decode to HTMLImageElement / ImageBitmap
  let drawable = source;
  if (typeof source === 'string') {
    if (typeof Image === 'undefined') {
      throw new Error('ScanicWasmEdgeAdapter.detect(): Cannot decode image URL without browser Image API');
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(null);
      img.onerror = () => reject(new Error('Failed to load image for edge detection'));
      img.src = source;
    });
    drawable = img;
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
    if (typeof createImageBitmap === 'function') {
      drawable = await createImageBitmap(source);
    } else if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
      const objUrl = URL.createObjectURL(source);
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(null);
          img.onerror = () => reject(new Error('Failed to decode Blob for edge detection'));
          img.src = objUrl;
        });
        drawable = img;
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    } else {
      throw new Error('ScanicWasmEdgeAdapter.detect(): Cannot decode Blob in this environment');
    }
  }

  // 3. Canvas element with 2D context
  if (typeof drawable.getContext === 'function' && drawable.width > 0 && drawable.height > 0) {
    const ctx = drawable.getContext('2d', { willReadFrequently: true });
    if (ctx && typeof ctx.getImageData === 'function') {
      const imgData = ctx.getImageData(0, 0, drawable.width, drawable.height);
      return {
        data: imgData.data,
        width: drawable.width,
        height: drawable.height,
      };
    }
  }

  // 4. Drawable element (HTMLImageElement, HTMLVideoElement, ImageBitmap)
  const width =
    drawable.naturalWidth || drawable.videoWidth || drawable.displayWidth || drawable.width || 0;
  const height =
    drawable.naturalHeight || drawable.videoHeight || drawable.displayHeight || drawable.height || 0;

  if (!(width > 0 && height > 0)) {
    throw new Error('ScanicWasmEdgeAdapter.detect(): Source image has zero width or height');
  }

  if (!scratchCanvas) {
    if (typeof OffscreenCanvas !== 'undefined') {
      scratchCanvas = new OffscreenCanvas(width, height);
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      scratchCanvas = document.createElement('canvas');
    } else {
      throw new Error('ScanicWasmEdgeAdapter.detect(): No Canvas implementation available');
    }
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  }

  if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas.width = width;
    scratchCanvas.height = height;
  } else {
    scratchCtx.clearRect(0, 0, width, height);
  }

  scratchCtx.drawImage(drawable, 0, 0, width, height);
  const imageData = scratchCtx.getImageData(0, 0, width, height);

  if (typeof ImageBitmap !== 'undefined' && drawable instanceof ImageBitmap && drawable !== source) {
    drawable.close?.();
  }

  return {
    data: imageData.data,
    width,
    height,
  };
}

/**
 * Scanic WASM edge detection adapter.
 * @experimental
 */
export class ScanicWasmEdgeAdapter extends EdgeDetectorPort {
  #defaultOptions;
  #worker = null;
  #initPromise = null;
  #inlineModule = null;
  #nextRequestId = 1;
  #pendingRequests = new Map();

  /**
   * @param {import('./edge-detector-port.js').EdgeDetectOptions & { workerPath?: string, useWorker?: boolean, detector?: 'classical' | 'ml' }} [options]
   */
  constructor(options = {}) {
    super();
    const isNode = typeof window === 'undefined' && typeof Worker === 'undefined';
    this.#defaultOptions = {
      maxProcessingDimension: 800,
      enableDetectionCascade: true,
      minConfidence: 0.55,
      fallbackOnLowConfidence: false,
      useWorker: true,
      detector: isNode ? 'classical' : 'ml',
      ...options,
    };
  }

  get detector() {
    return this.#defaultOptions.detector || 'classical';
  }

  set detector(val) {
    this.#defaultOptions.detector = val === 'ml' ? 'ml' : 'classical';
  }

  /**
   * Warm up / preload the ML neural model (DocCornerNet) ahead of time.
   * @param {Object} [mlOptions]
   * @returns {Promise<void>}
   */
  async preloadMl(mlOptions = {}) {
    const worker = await this.getEdgeWorker();
    if (worker && !('isInlineFallback' in worker)) {
      const res = await this.#sendWorkerRequest({ type: 'init', preloadMl: true, mlOptions });
      if (res && res.mlReady === false && res.mlError) {
        throw new Error(res.mlError);
      }
    } else {
      const mlMod = await import('../../lib/scanic-mlDetector.js');
      await mlMod.initializeMl(mlOptions);
    }
  }

  /**
   * Resolve the URL for the Scanic Web Worker script.
   * @returns {string}
   */
  #resolveWorkerUrl() {
    if (this.#defaultOptions.workerPath) {
      return resolveAssetUrl(this.#defaultOptions.workerPath);
    }
    const base = getAssetBase();
    const resolved = resolveAssetUrl('js/lib/scanic-detector.js');
    if (
      base === '.' &&
      typeof location !== 'undefined' &&
      location.pathname &&
      location.pathname !== '/' &&
      !location.pathname.endsWith('/index.html') &&
      !resolved.startsWith('/') &&
      !/^(https?:|blob:|data:)/i.test(resolved)
    ) {
      return `/${resolved}`;
    }
    return resolved;
  }

  /**
   * Load the detector module directly in-process (fallback for Node.js or when Web Workers are disabled).
   * @returns {Promise<any>}
   */
  async #getInlineModule() {
    if (this.#inlineModule) {
      return this.#inlineModule;
    }
    const modulePath = '../../lib/scanic-detector.js';
    const mod = await import(/* @vite-ignore */ modulePath);
    await mod.initialize();
    this.#inlineModule = mod;
    return mod;
  }

  /**
   * Send a message to the active Web Worker and await its correlated response.
   * @param {Object} payload
   * @param {Transferable[]} [transfer]
   * @returns {Promise<any>}
   */
  #sendWorkerRequest(payload, transfer = []) {
    return new Promise((resolve, reject) => {
      if (!this.#worker || this.#worker.isInlineFallback) {
        reject(new Error('Web Worker is not active'));
        return;
      }
      const id = this.#nextRequestId++;
      this.#pendingRequests.set(id, { resolve, reject });
      try {
        this.#worker.postMessage({ ...payload, id }, transfer);
      } catch (err) {
        this.#pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Obtain or lazily initialize the dedicated Scanic Web Worker (or inline fallback in Node.js).
   * @returns {Promise<Worker|{ isInlineFallback: true, terminate: () => void }>}
   */
  async getEdgeWorker() {
    if (this.#worker) {
      return this.#worker;
    }
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = (async () => {
      const canUseWorker =
        this.#defaultOptions.useWorker !== false && typeof Worker === 'function';

      if (canUseWorker) {
        try {
          const workerUrl = this.#resolveWorkerUrl();
          const worker = new Worker(workerUrl, { type: 'module' });

          worker.addEventListener('message', (event) => {
            const msg = event?.data;
            if (!msg || typeof msg.id !== 'number') return;
            const pending = this.#pendingRequests.get(msg.id);
            if (!pending) return;
            this.#pendingRequests.delete(msg.id);
            if (msg.ok) {
              pending.resolve(msg);
            } else {
              pending.reject(new Error(msg.error || 'Edge detector worker error'));
            }
          });

          worker.addEventListener('error', (event) => {
            const err = new Error(event?.message || 'Edge detector Web Worker error');
            for (const [, pending] of this.#pendingRequests) {
              pending.reject(err);
            }
            this.#pendingRequests.clear();
          });

          this.#worker = worker;
          await this.#sendWorkerRequest({ type: 'init' });
          return this.#worker;
        } catch {
          if (this.#worker && typeof this.#worker.terminate === 'function') {
            try {
              this.#worker.terminate();
            } catch {}
          }
          this.#worker = null;
        }
      }

      // Automatic fallback for headless Node.js or restricted Worker environments
      await this.#getInlineModule();
      this.#worker = {
        isInlineFallback: true,
        terminate: () => {},
      };
      return this.#worker;
    })();

    try {
      return await this.#initPromise;
    } finally {
      this.#initPromise = null;
    }
  }

  /**
   * Detect the 4 corners of a document in the given image or video frame.
   *
   * @param {ImageData|{ data: Uint8ClampedArray|Uint8Array, width: number, height: number }|HTMLCanvasElement|OffscreenCanvas|HTMLImageElement|HTMLVideoElement|ImageBitmap|Blob|string} image
   * @param {import('./edge-detector-port.js').EdgeDetectOptions} [options]
   * @returns {Promise<import('./edge-detector-port.js').EdgeDetectionResult|null>}
   */
  async detect(image, options = {}) {
    const mergedOptions = {
      ...this.#defaultOptions,
      ...options,
    };
    const minConfidence =
      typeof mergedOptions.minConfidence === 'number' ? mergedOptions.minConfidence : 0.55;
    const fallbackOnLowConfidence = Boolean(mergedOptions.fallbackOnLowConfidence);

    const { data, width, height } = await extractRgbaFromSource(image);
    const worker = await this.getEdgeWorker();

    const detectorBackend = mergedOptions.detector || this.#defaultOptions.detector || 'classical';
    const detectorOptions = {
      maxProcessingDimension: mergedOptions.maxProcessingDimension ?? 800,
      enableDetectionCascade: mergedOptions.enableDetectionCascade ?? true,
      lowThreshold: mergedOptions.lowThreshold,
      highThreshold: mergedOptions.highThreshold,
      dilationKernelSize: mergedOptions.dilationKernelSize,
      applyDilation: mergedOptions.applyDilation,
      detector: detectorBackend,
      ml: mergedOptions.ml,
    };

    let rawResult;
    if (worker && !('isInlineFallback' in worker)) {
      // Copy buffer before transferring so we never neuter a caller-owned ImageData.data.buffer
      const copy = new Uint8ClampedArray(data);
      const response = await this.#sendWorkerRequest(
        {
          type: 'detect',
          buffer: copy.buffer,
          width,
          height,
          options: detectorOptions,
        },
        [copy.buffer]
      );
      rawResult = response.result;
    } else {
      const mod = await this.#getInlineModule();
      if (detectorOptions.detector === 'ml') {
        try {
          const mlMod = await import('../../lib/scanic-mlDetector.js');
          const imgData = typeof ImageData !== 'undefined'
            ? new ImageData(/** @type {any} */ (data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data)), width, height)
            : { data, width, height };
          const det = await mlMod.detectDocumentMl(imgData, detectorOptions.ml || detectorOptions);
          const corners = det.success && det.corners ? det.corners : null;
          const normalizedCorners = corners ? mod.normalizeCornerQuad(corners, width, height) : null;
          rawResult = {
            success: Boolean(det.success && corners),
            corners,
            normalizedCorners,
            confidence: det.confidence ?? det.score ?? 0,
            width,
            height,
            detector: 'ml',
            durationMs: 0,
          };
        } catch {
          rawResult = await mod.detectEdgesFromRgba(data, width, height, detectorOptions);
        }
      } else {
        rawResult = await mod.detectEdgesFromRgba(data, width, height, detectorOptions);
      }
    }

    const confidence = typeof rawResult?.confidence === 'number' ? rawResult.confidence : 0;

    if (rawResult?.success && rawResult?.normalizedCorners && confidence >= minConfidence) {
      const quad = sanitizeNormalizedQuad(rawResult.normalizedCorners);
      const pixelCorners = denormalizeQuad(quad, width, height);
      return {
        quad,
        normalizedCorners: cloneQuad(quad),
        corners: cloneQuad(quad),
        pixelCorners,
        confidence,
        width,
        height,
        isFallback: false,
        durationMs: rawResult.durationMs,
      };
    }

    if (fallbackOnLowConfidence) {
      const quad = cloneQuad(DEFAULT_FALLBACK_QUAD);
      return {
        quad,
        normalizedCorners: cloneQuad(quad),
        corners: cloneQuad(quad),
        pixelCorners: denormalizeQuad(quad, width, height),
        confidence,
        width,
        height,
        isFallback: true,
        durationMs: rawResult?.durationMs ?? 0,
      };
    }

    return null;
  }

  /**
   * Terminate the active Web Worker and release WASM memory.
   * @returns {Promise<void>}
   */
  async terminateEdgeWorker() {
    this.#initPromise = null;
    for (const [, pending] of this.#pendingRequests) {
      pending.reject(new Error('Edge detector worker terminated'));
    }
    this.#pendingRequests.clear();

    if (this.#worker) {
      try {
        this.#worker.terminate?.();
      } catch {}
      this.#worker = null;
    }
  }
}
