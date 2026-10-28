/**
 * SW.JS v6.0
 * ✅ Estratégia Network First (mantida), agora SÓ para requisições do
 *    mesmo domínio (não intercepta CDN, Supabase, extensões etc.).
 * ✅ Pré-cache tolerante: um arquivo ausente não derruba o cache dos
 *    outros (antes cache.addAll falhava inteiro se 1 arquivo desse 404).
 * ✅ NOVO: handler de "push" (mostra a notificação mesmo com o app
 *    fechado) e "notificationclick" (abre/foca o app na aba certa).
 *    Payload esperado (JSON): { title, body, url, tag, icon }
 * ✅ Fallback offline de navegação: devolve o index.html em cache.
 */

const CACHE_VERSION = 'marketplace-v6.0';
const CACHE_NAME = CACHE_VERSION;

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',

    './style.css',
    './theme.css',
    './tailwind.built.css',

    './config.js',
    './storage.js',
    './wrapper.js',
    './auth.js',
    './store-status.js',
    './cart.js',
    './products.js',
    './ads.js',
    './bi.js',
    './navigation.js',
    './tenants.js',
    './orders.js',
    './order-management.js',
    './admin-warnings.js',
    './vendor-settings.js',
    './notifications.js',
    './moderation.js',
    './restock-alerts.js',
    './onboarding.js',
    './pwa.js',
    './app.js',
    './theme-toggle.js',

    './icon-192.png',
    './icon-512.png'
];

// ========================================
// INSTALAR
// ========================================
self.addEventListener('install', (event) => {
    console.log(`[SW] Instalando ${CACHE_VERSION}`);

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(
                ASSETS_TO_CACHE.map((asset) =>
                    cache.add(asset).catch((err) => {
                        console.warn(`[SW] Não cacheou ${asset}: ${err.message}`);
                    })
                )
            )
        )
    );

    self.skipWaiting();
});

// ========================================
// ATIVAR — limpa caches antigos
// ========================================
self.addEventListener('activate', (event) => {
    console.log(`[SW] Ativando ${CACHE_VERSION}`);

    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME && (name.startsWith('fadvendas-') || name.startsWith('marketplace-')))
                    .map((name) => caches.delete(name))
            )
        )
    );

    self.clients.claim();
});

// ========================================
// FETCH — NETWORK FIRST (somente mesmo domínio)
// ========================================
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (!url.protocol.startsWith('http')) return;
    if (url.origin !== self.location.origin) return; // CDN, Supabase, extensões: deixa passar direto

    event.respondWith(networkFirstStrategy(request));
});

function networkFirstStrategy(request) {
    return fetch(request, { signal: AbortSignal.timeout(5000) })
        .then((response) => {
            if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return response;
        })
        .catch((err) => {
            console.log(`[SW] Rede falhou para ${request.url}: ${err.message}`);

            return caches.match(request).then((cached) => {
                if (cached) return cached;

                if (request.mode === 'navigate') {
                    return caches.match('./index.html').then((page) => page || offlineResponse());
                }

                return offlineResponse();
            });
        });
}

function offlineResponse() {
    return new Response('⚠️ Você está offline e não há cache disponível.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
    });
}

// ========================================
// PUSH — notificação com o app fechado
// ========================================
self.addEventListener('push', (event) => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'Ityrapuã Store', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'Ityrapuã Store';
    const options = {
        body: data.body || '',
        icon: data.icon || './icon-192.png',
        badge: './icon-192.png',
        tag: data.tag || 'ityrapuan-aviso',
        renotify: true,
        data: { url: data.url || './index.html' }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const target = new URL(
        (event.notification.data && event.notification.data.url) || './index.html',
        self.location.origin
    ).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) client.navigate(target);
                    return client.focus();
                }
            }
            return self.clients.openWindow(target);
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log(`[SW] Service Worker ${CACHE_VERSION} carregado`);
