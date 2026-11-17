const CACHE_NAME = 'osync-pwa-v1';
const ASSETS_BASE = [
    './',
    './index.html',
    './css/style.css',
    './pages/login.html',
    './pages/os.html',
    './pages/solicitacoes.html',
    './pages/configuracoes.html',
    './pages/cad-ativos.html',
    './pages/cad-manutentores.html',
    './pages/cad-lideranca.html',
    './pages/saas-empresas.html'
];

// Instala e guarda a estrutura básica
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_BASE).catch(() => {}))
    );
});

// Limpa caches antigos automaticamente ao atualizar a versão
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Estratégia Network-First: busca sempre o código atualizado; se estiver offline, usa o cache
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Ignora requisições externas de API do Firebase/Google
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
