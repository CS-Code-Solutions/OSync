importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAAvE0Ag4Tx04KayQvlTCYTj4ncCFHl4Fo",
    authDomain: "osync-saas.firebaseapp.com",
    projectId: "osync-saas",
    storageBucket: "osync-saas.firebasestorage.app",
    messagingSenderId: "277448647968",
    appId: "1:277448647968:web:5bb8f05a4f2a15e143e345"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const titulo = payload?.notification?.title || payload?.data?.title || 'OSync';
    const corpo = payload?.notification?.body || payload?.data?.body || '';
    const url = payload?.data?.url || '/';

    self.registration.showNotification(titulo, {
        body: corpo,
        icon: '/images/ico192.png',
        badge: '/images/ico.png',
        vibrate: [200, 100, 200],
        data: { url }
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlDestino = event.notification?.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(urlDestino);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlDestino);
            }
        })
    );
});

const CACHE_NAME = 'osync-pwa-v2.1.0';
const ASSETS_ESSENCIAIS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './images/ico.png',
    './images/ico192.png',
    './images/ico512.png',
    './images/cabe.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_ESSENCIAIS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
