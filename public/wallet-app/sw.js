/**
 * Xcannes Wallet — Service Worker
 *
 * Enables offline support and "Add to Home Screen" (PWA install).
 * Caches the app shell so the wallet loads even without internet.
 * The actual signing is always online (needs relay).
 *
 * Strategy: stale-while-revalidate for JS/CSS (serve cached, update in background).
 * This ensures the user always gets the latest code on next load.
 */

const CACHE_NAME = 'xcannes-wallet-v11';
// Paths relative to SW scope (/wallet-app/)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/main.css',
  './src/components/App.js',
  './src/services/bip39.js',
  './src/services/pinService.js',
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

// Activate: clean up ALL old caches + claim clients immediately
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

// Fetch: network-first for API, stale-while-revalidate for app shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls (relay) — always network
  if (url.pathname.startsWith('/wallet-relay/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests — network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // App shell assets — STALE-WHILE-REVALIDATE
  // Serve cached immediately (fast), but fetch fresh copy in background.
  // Next load will always have the latest version.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok && !response.redirected) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached); // Offline → return cached

        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      });
    })
  );
});
