/* Offline-Cache: App-Dateien + alle MP3s vorab, Schriften bei erster Nutzung. */
const VERSION = 'nr-v9';
importScripts('data.js');

const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'whisper-worker.js'];
const AUDIO = [
  ...self.NR_DATA.phrases.map(p => `audio/${p.id}.mp3`),
  ...self.NR_DATA.phrases.map(p => `audio/de/${p.id}.mp3`), // Playlist: deutsche Ansage
  'audio/pause-short.mp3', 'audio/pause-long.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll([...CORE, ...AUDIO])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('nr-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isLib = url.hostname === 'cdn.jsdelivr.net'; // Whisper-Bibliothek + ONNX-Laufzeit (versioniert → unveränderlich)
  // Modelldateien (huggingface.co) cached transformers.js selbst – hier nicht doppelt speichern
  if (url.origin !== location.origin && !isFont && !isLib) return;
  const store = res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  };
  // Audio & Schriften ändern sich nie → Cache zuerst. App-Dateien → Netz zuerst, damit Updates ankommen.
  if (isFont || isLib || url.pathname.includes('/audio/')) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(store)));
    return;
  }
  e.respondWith(
    fetch(req).then(store).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
