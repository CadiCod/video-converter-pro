/**
 * Video Converter Pro (Web) - Service Worker
 * Handles: App shell caching + offline support
 *
 * Note: COOP/COEP headers removed intentionally.
 * GitHub Pages doesn't support custom headers, and injecting them via SW
 * causes cross-origin resource blocking for CDN assets (wasm, fonts, etc.).
 * Single-threaded ffmpeg.wasm works without SharedArrayBuffer.
 */

const CACHE_NAME = 'vcp-web-v6';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/presets.js',
  './js/converter.js',
  './js/theme.js',
  './js/analytics.js',
  './js/ffmpeg/index.js',
  './js/ffmpeg/classes.js',
  './js/ffmpeg/const.js',
  './js/ffmpeg/errors.js',
  './js/ffmpeg/utils.js',
  './js/ffmpeg/worker.js',
  './js/ffmpeg/ffmpeg-core.js',
  './manifest.json',
  './assets/icons/favicon.svg'
];

// ═══════════════════════════════════════════════════════════
// INSTALL — Pre-cache app shell
// ═══════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════════
// FETCH — Cache-first for app shell, network-first for CDN
// ═══════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    // Same-origin: cache-first (app shell)
    event.respondWith(cacheFirst(event.request));
  } else {
    // Cross-origin: network-first, cache CDN resources
    event.respondWith(networkFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache ffmpeg WASM binary and CDN resources for offline use
    if (response.ok && request.method === 'GET' &&
        (request.url.includes('cdn.jsdelivr.net') || request.url.includes('fonts.googleapis.com'))) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Network error', { status: 503 });
  }
}
