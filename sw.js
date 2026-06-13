// ─────────────────────────────────────────────────────────────────
//  SERVICE WORKER — Calculadora da Virada
//
//  Regras:
//  1. index.html  → Network-first  (sempre busca versão nova da rede)
//  2. Outros      → Cache-first    (icons, manifest, ebooks)
//  3. Notifica a página SÓ quando havia um SW anterior (update real)
//  4. NUNCA faz reload automático — o utilizador decide quando atualizar
//  5. localStorage nunca é tocado — dados do utilizador sempre seguros
// ─────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v11';
const CACHE_NAME    = 'calculadora-virada-' + CACHE_VERSION;

const PRECACHE = [
  'index.html',
  'manifest.json',
];

// ── INSTALL ───────────────────────────────────────────────────────
// Pré-carrega os assets essenciais e activa imediatamente
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
// Limpa caches antigos. Só notifica se havia SW anterior (update real).
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const oldCaches = keys.filter(k => k !== CACHE_NAME);
      const hadPreviousSW = oldCaches.length > 0;

      return Promise.all(oldCaches.map(k => caches.delete(k)))
        .then(() => self.clients.claim())
        .then(() => {
          // Só avisa se havia versão anterior instalada (update genuíno)
          if (!hadPreviousSW) return;
          return self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(client =>
              client.postMessage({ type: 'SW_UPDATED' })
            );
          });
        });
    })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Só intercepta GET da mesma origem
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isHTML =
    event.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname === '';

  if (isHTML) {
    // Network-first: tenta rede, fallback cache se offline
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first para tudo o resto
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
  }
});

// ── MENSAGENS DA PÁGINA ───────────────────────────────────────────
// A página pode pedir para activar o novo SW imediatamente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
