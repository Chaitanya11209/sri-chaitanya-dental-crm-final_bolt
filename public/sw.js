// ==============================================================================
// Sri Chaitanya Dental Care CRM — Offline Service Worker Caching Strategy
// Enables staff to access existing patient listings, appointment books,
// and system assets when their internet connection goes down.
// ==============================================================================

const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE_NAME = `sdc-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `sdc-dynamic-${CACHE_VERSION}`;
const API_CACHE_NAME = `sdc-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

// 1. Installation: Pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core application shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation: Clean up stale caches from previous builds
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== DYNAMIC_CACHE_NAME &&
            cacheName !== API_CACHE_NAME
          ) {
            console.log('[Service Worker] Purging outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Interceptor: Network-First with Cache Fallback for maximum durability
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // We only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle Supabase and custom CRM database endpoints (JSON listings)
  const isSupabaseRequest = url.host.includes('supabase.co') || url.pathname.includes('/rest/v1/');
  
  if (isSupabaseRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If response is valid, clone and save in API cache
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.warn('[Service Worker] Offline detected. Retrieving cached clinical registry for:', url.pathname);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback JSON if absolutely nothing is cached
            return new Response(
              JSON.stringify({
                error: 'offline',
                message: 'Clinic is currently offline. No cached records match this exact query.',
                data: []
              }),
              {
                status: 200, // Return 200 so listing panels don't crash but show explanatory empty state
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Handle Static & Application Shell Assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        // If response is valid and from our origin, clone and store it in dynamic assets cache
        if (response && (response.status === 200 || response.status === 0) && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Retrieve from any of our core caches if offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it is a navigation request (HTML/pages router) and offline, return the root of the SPA (index.html)
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
        });
      })
  );
});
