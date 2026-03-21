const CACHE_VERSION = 'v1.0.9';
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
                'favicon.ico',
                '/static/manifest.json',
                '/static/images/icon/app-icon.png',
                '/static/images/icons/app-icon-96.png',
                '/static/images/icons/app-icon-144.png',
                '/static/js/app.js',
                '/static/css/app.css',
                '/static/css/login.css',
                '/static/css/auto-complete.css',
                '/static/css/bootstrap.min.css',
                '/static/js/bootstrap.bundle.min.js',
                '/static/js/showdown.min.js',
                '/static/js/jquery.min.js',
                '/static/js/auto-complete.min.js',
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
                    return caches.match(event.request);
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
