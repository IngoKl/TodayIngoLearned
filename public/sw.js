// Keep in sync with package.json version
const CACHE_VERSION = 'v1.1.1';
const CACHE_NAME = 'precache-' + CACHE_VERSION;

const PRECACHE_URLS = [
    '/login',
    '/favicon.ico',
    '/static/manifest.json',
    '/static/images/icons/app-icon-96.png',
    '/static/images/icons/app-icon-144.png',
    '/static/images/icons/app-icon-192.png',
    '/static/js/app.js',
    '/static/js/drawing.js',
    '/static/css/app.css',
    '/static/css/public.css',
    '/static/css/login.css',
    '/static/css/auto-complete.css',
    '/static/css/bootstrap.min.css',
    '/static/js/bootstrap.bundle.min.js',
    '/static/js/showdown.min.js',
    '/static/js/jquery.min.js',
    '/static/js/auto-complete.min.js',
    '/static/js/hljs/highlight.min.js',
    '/static/css/hljs/github-dark-dimmed.min.css',
];

self.addEventListener('install', function(event) {
    console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] Precaching');
                return cache.addAll(PRECACHE_URLS);
            })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function(name) { return name !== CACHE_NAME; })
                    .map(function(name) {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    // Network-first for HTML pages (navigation requests)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(function() {
                    return caches.match(event.request)
                        .then(function(cached) {
                            return cached || new Response(
                                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - TIL</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#2d3748;text-align:center}h1{color:#a25776}a{color:#a25776}</style></head><body><div><h1>You are offline</h1><p>Please check your connection and try again.</p><p><a href="/">Retry</a></p></div></body></html>',
                                { headers: { 'Content-Type': 'text/html' } }
                            );
                        });
                })
        );
        return;
    }

    // Stale-while-revalidate for static assets
    if (event.request.url.includes('/static/')) {
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                var fetchPromise = fetch(event.request).then(function(response) {
                    if (response.ok) {
                        var responseClone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                }).catch(function() {
                    return cached;
                });
                return cached || fetchPromise;
            })
        );
        return;
    }

    // Network-first for everything else
    event.respondWith(
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })
    );
});

// Notify clients when a new version is available
self.addEventListener('message', function(event) {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
