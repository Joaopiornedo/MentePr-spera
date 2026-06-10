// ─────────────────────────────────────────────────────────────────
//  SERVICE WORKER — Calculadora da Virada
//
//  Estratégia:
//  • index.html → Network-first (tenta rede, fallback para cache)
//    Garante que o utilizador receba sempre a versão mais recente
//    quando online, mesmo com a app instalada.
//  • Outros assets (icons, manifest, ebooks) → Cache-first
//    Ficheiros que mudam raramente: servidos do cache para velocidade.
//
//  Actualização automática:
//  • O SW verifica a rede a cada activação.
//  • Quando um novo SW é instalado, envia mensagem "UPDATE_AVAILABLE"
//    para a página, que mostra um toast e recarrega automaticamente.
//  • O localStorage NÃO é apagado — os dados do utilizador são preservados.
// ─────────────────────────────────────────────────────────────────

// Muda este valor a cada deploy para forçar o SW a actualizar.
// Pode ser feito manualmente ou via script de build (ex: vite, gh-actions).
const CACHE_VERSION = 'v10'; // ← incrementa a cada push
const CACHE_NAME    = 'calculadora-virada-' + CACHE_VERSION;

// Assets que vão para cache na instalação
const PRECACHE_ASSETS = [
  'index.html',
  'manifest.json',
  'sw.js',
];

// ── INSTALL ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // activa imediatamente sem esperar tabs fecharem
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k)) // apaga caches antigos
      ))
      .then(() => self.clients.claim()) // toma controlo de todas as tabs abertas
      .then(() => {
        // Avisa todas as tabs que há uma actualização disponível
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora requests que não são GET ou que são de outras origens
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isHTML = event.request.destination === 'document'
              || url.pathname.endsWith('.html')
              || url.pathname === '/'
              || url.pathname === '';

  if (isHTML) {
    // ── Network-first para HTML ──────────────────────────────────
    // Tenta sempre a rede. Se falhar (offline), serve do cache.
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Actualiza o cache com a versão mais recente
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // ── Cache-first para outros assets (icons, ebooks, etc.) ─────
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkResponse;
        });
      })
    );
  }
});
