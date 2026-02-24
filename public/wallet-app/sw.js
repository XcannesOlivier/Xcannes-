/**
 * Xcannes Wallet — Service Worker
 * 
 * Enables offline support and "Add to Home Screen" (PWA install).
 * Caches the app shell so the wallet loads even without internet.
 * The actual signing is always online (needs relay).
 */

const CACHE_NAME = 'xcannes-wallet-v5';
// Paths relative to SW scope (/wallet-app/)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/main.css',
  './src/components/App.js',
  './src/services/bip39.js',
  './src/services/cryptoService.js',
  './src/services/webauthnService.js',
  './src/services/walletService.js',
  './src/services/storageService.js',
  './src/services/qrService.js',
  './src/services/relayService.js',
  './lib/xrpl-4.4.3.min.js',
  './lib/jsQR-1.4.0.js',
];

// Install: cache all app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls (relay) — always network
  if (url.pathname.startsWith('/wallet-relay/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests (opening the app) — network first, fallback to cached index.html
  // This avoids the Safari "Response served by service worker has redirections" error
  // which happens when a cached 301 redirect is served for a navigation request.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache non-redirect, successful responses
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve cached index.html
          return caches.match('./index.html');
        })
    );
    return;
  }

  // App shell assets — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && !response.redirected) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
