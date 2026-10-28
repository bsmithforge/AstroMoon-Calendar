/**
 * Web Worker for theme search: loads transformers.js and the embedding model,
 * then turns texts into unit-length sentence vectors. See utils/themeModel.ts.
 */

import { THEME_MODEL_ID, TRANSFORMERS_URL, WorkerRequest, WorkerResponse } from '../utils/themeModel';

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractor: Promise<Extractor> | null = null;
const fileProgress = new Map<string, { loaded: number; total: number }>();

const post = (message: WorkerResponse) => self.postMessage(message);

async function load(): Promise<Extractor> {
  // Pinned CDN build; @vite-ignore keeps Vite from trying to bundle it.
  const { pipeline } = await import(/* @vite-ignore */ TRANSFORMERS_URL);
  return pipeline('feature-extraction', THEME_MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (event: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (event.status !== 'progress' || !event.file) return;
      fileProgress.set(event.file, { loaded: event.loaded ?? 0, total: event.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const file of fileProgress.values()) {
        loaded += file.loaded;
        total += file.total;
      }
      post({ type: 'progress', loaded, total });
    },
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'load') {
    extractor ??= load();
    try {
      await extractor;
      post({ type: 'ready' });
    } catch (err) {
      extractor = null;
      post({ type: 'error', message: `The on-device model could not load: ${(err as Error).message}` });
    }
    return;
  }
  try {
    const run = await extractor!;
    const output = await run(message.texts, { pooling: 'mean', normalize: true });
    post({ type: 'embedded', id: message.id, vectors: output.tolist() });
  } catch (err) {
    post({ type: 'error', id: message.id, message: (err as Error).message });
  }
};
