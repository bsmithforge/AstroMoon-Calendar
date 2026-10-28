/**
 * Loads the on-device embedding model for theme search, in a Web Worker so
 * inference never blocks taps or scrolling. Nothing a user types leaves the
 * device; the browser downloads the model once and caches it.
 *
 * transformers.js is imported from jsDelivr at an exact version rather than
 * installed from npm: the npm package pulls in ~480 MB of native Node
 * binaries (onnxruntime-node, sharp) that a browser feature never uses, and
 * the library fetches its WebAssembly runtime from jsDelivr either way.
 */

import { Embedder } from './themeSearch';

export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm';
export const THEME_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** Measured transfer: model 23 MB, WebAssembly runtime ~5 MB, tokenizer and library ~0.3 MB. */
export const THEME_MODEL_DOWNLOAD_MB = 29;
const MODEL_FILE_URL = `https://huggingface.co/${THEME_MODEL_ID}/resolve/main/onnx/model_quantized.onnx`;

export type WorkerRequest = { type: 'load' } | { type: 'embed'; id: number; texts: string[] };
export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'embedded'; id: number; vectors: number[][] }
  | { type: 'error'; id?: number; message: string };

/** 0-1 while files download; null once they have and the runtime is starting. */
export type LoadProgress = (fraction: number | null) => void;

/** True if this browser already holds the model file, so loading costs no download. */
export async function isThemeModelCached(): Promise<boolean> {
  try {
    if (!('caches' in window)) return false;
    const cache = await caches.open('transformers-cache');
    return (await cache.match(MODEL_FILE_URL)) !== undefined;
  } catch {
    return false;
  }
}

let embedderPromise: Promise<Embedder> | null = null;
const progressListeners = new Set<LoadProgress>();

/**
 * Starts the worker and loads the model, once per page; later calls share the
 * same load. A failed load can be retried.
 */
export function loadThemeEmbedder(onProgress?: LoadProgress): Promise<Embedder> {
  if (onProgress) progressListeners.add(onProgress);
  if (embedderPromise) return embedderPromise;

  embedderPromise = new Promise<Embedder>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/themeWorker.ts', import.meta.url), { type: 'module' });
    const pending = new Map<number, { resolve: (vectors: number[][]) => void; reject: (error: Error) => void }>();
    let nextId = 0;

    const embed: Embedder = (texts) =>
      new Promise((resolveEmbed, rejectEmbed) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveEmbed, reject: rejectEmbed });
        worker.postMessage({ type: 'embed', id, texts } satisfies WorkerRequest);
      });

    const fail = (message: string) => {
      worker.terminate();
      embedderPromise = null;
      progressListeners.clear();
      for (const request of pending.values()) request.reject(new Error(message));
      reject(new Error(message));
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        const fraction = message.total > 0 && message.loaded < message.total ? message.loaded / message.total : null;
        progressListeners.forEach((listener) => listener(fraction));
      } else if (message.type === 'ready') {
        progressListeners.clear();
        resolve(embed);
      } else if (message.type === 'embedded') {
        pending.get(message.id)?.resolve(message.vectors);
        pending.delete(message.id);
      } else if (message.id !== undefined) {
        pending.get(message.id)?.reject(new Error(message.message));
        pending.delete(message.id);
      } else {
        fail(message.message);
      }
    };
    worker.onerror = () => fail('The on-device model could not start in this browser.');
    worker.postMessage({ type: 'load' } satisfies WorkerRequest);
  });
  return embedderPromise;
}
