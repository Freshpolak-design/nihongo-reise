/* Offline-Spracherkennung: Whisper base (q8, ~77 MB) läuft komplett im Browser.
 * Die Modelldateien speichert transformers.js selbst im Cache "transformers-cache",
 * danach funktioniert die Erkennung ohne Internet. */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL = 'onnx-community/whisper-base';
let asr = null;

async function load() {
  if (!asr) {
    asr = pipeline('automatic-speech-recognition', MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: p => {
        if (p.status === 'progress') postMessage({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
      },
    });
    asr.catch(() => { asr = null; });
  }
  return asr;
}

onmessage = async e => {
  const { type, id, audio } = e.data;
  try {
    if (type === 'load') {
      const a = await load();
      // Aufwärmen, damit die erste echte Bewertung nicht zusätzlich Initialisierung kostet
      await a(new Float32Array(16000), { language: 'japanese', task: 'transcribe' });
      postMessage({ type: 'ready' });
    } else if (type === 'transcribe') {
      const a = await load();
      const t0 = performance.now();
      const out = await a(audio, { language: 'japanese', task: 'transcribe' });
      postMessage({ type: 'result', id, text: out.text.trim(), ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
