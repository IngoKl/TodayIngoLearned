// Keep in sync with package.json version
const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = 'precache-' + CACHE_VERSION;

self.addEventListener('install', function(event) {
    console.log('[SW] Install', event);

    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(function(cache) {
            console.log('[SW] Precaching');

            // Requests we're caching; be very careful to not cache protected content
            return cache.addAll([
                '/login',
                '/favicon.ico',
                '/static/manifest.json',
                '/static/images/icons/app-icon-96.png',
                '/static/images/icons/app-icon-144.png',
                '/static/images/icons/app-icon-192.png',
                '/static/js/app.js',
                '/static/css/app.css',
                '/static/css/login.css',
                '/static/css/auto-complete.css',
                '/static/css/bootstrap.min.css',
                '/static/js/bootstrap.bundle.min.js',
                '/static/js/showdown.min.js',
                '/static/js/jquery.min.js',
                '/static/js/auto-complete.min.js',
                '/static/js/hljs/highlight.min.js',
                '/static/css/hljs/github-dark-dimmed.min.css',
            ]);
        })
    );
});

self.addEventListener('activate', function (event) {
    // Clean up old caches
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
    const url = new URL(event.request.url);

    // Network-first for HTML pages (navigation requests)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(function() {
                    return caches.match(event.request)
                        .then(function(cached) {
                            return cached || new Response(
                                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - TIL</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#3b4045;color:#f5f5f5;text-align:center}a{color:#a25776}</style></head><body><div><h1>You are offline</h1><p>Please check your connection and try again.</p><p><a href="/">Retry</a></p></div></body></html>',
                                { headers: { 'Content-Type': 'text/html' } }
                            );
                        });
                })
        );
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
