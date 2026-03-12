/**
 * Video Converter Pro (Web) - Service Worker
 * Handles: COOP/COEP header injection + App shell caching
 */

const CACHE_NAME = 'vcp-web-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/presets.js',
  './js/converter.js',
  './js/theme.js',
  './js/analytics.js',
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
// FETCH — COOP/COEP header injection + caching
// ═══════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests for COOP/COEP injection
  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOrigin(event.request));
  } else {
    // Cross-origin: try cache first (for ffmpeg.wasm CDN resources)
    event.respondWith(handleCrossOrigin(event.request));
  }
});

async function handleSameOrigin(request) {
  // Try cache first for app shell resources
  const cached = await caches.match(request);

  let response;
  if (cached) {
    response = cached;
  } else {
    try {
      response = await fetch(request);
      // Cache successful GET responses
      if (response.ok && request.method === 'GET') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
    } catch {
      // Offline fallback for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('Offline', { status: 503 });
    }
  }

  // Inject COOP/COEP headers for SharedArrayBuffer support
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleCrossOrigin(request) {
  // Check cache first (ffmpeg.wasm files are large, worth caching)
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Cache ffmpeg CDN resources for offline reuse
    if (response.ok && request.url.includes('cdn.jsdelivr.net') && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network error', { status: 503 });
  }
}
