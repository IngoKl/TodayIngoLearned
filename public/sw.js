self.addEventListener('install', function(event) {
    console.log('[SW] Install', event);

    // Very basic caching that needs to be expanded in the future
    // Ensure that the cache is opened
    event.waitUntil(
        caches.open('precache')
        .then(function(cache) {
            console.log('[SW] Precaching');
            
            // Requests we're caching; be very careful to not cache protected content at this point
            cache.addAll([
                '/login',
                'favicon.ico',
                '/static/manifest.json',
                '/static/images/icons/app-icon-96.png',
                '/static/images/icons/app-icon-144.png',
                '/static/js/app.js',
                '/static/css/app.css',
                '/static/css/login.css',
                '/static/css/auto-complete.css',
                '/static/css/bootstrap.min.css',
                '/static/js/bootstrap.min.js',
                '/static/js/showdown.min.js',
                '/static/js/jquery.min.js',
                '/static/js/popper.min.js',
                '/static/js/auto-complete.min.js',
            ]);
        })
    )
});

self.addEventListener('activate', function (event) {
    return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Not null
                if (response) {
                    return response;
                } else {
                    return fetch(event.request);
                }
            })
    );
});