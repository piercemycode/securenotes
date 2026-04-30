/**
 * SecureNotes Service Worker v2.0
 * PierceMyCode - 2026
 */
const CACHE_NAME = 'securenotes-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-512-maskable.png'
];

// Instalación - cachear assets estáticos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activación - limpiar caches viejos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptar fetch - servir desde cache, o red y cachear
self.addEventListener('fetch', event => {
    // Solo GET
    if (event.request.method !== 'GET') return;
    
    // No cachear Firebase
    if (event.request.url.includes('firebase')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                
                return fetch(event.request).then(response => {
                    // Solo cachear respuestas válidas
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    
                    return response;
                }).catch(() => {
                    // Si falla la red y tenemos cache, usar cache
                    return caches.match('/index.html');
                });
            })
    );
});

// Manejar mensajes del cliente
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});