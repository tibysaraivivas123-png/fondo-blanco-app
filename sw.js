const CACHE_NAME = 'fondo-blanco-bar-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    // 'reload' salta la cache HTTP del navegador: sin esto la instalación
    // podía guardar un index.html viejo que el navegador tenía guardado.
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Para llamadas a APIs externas como Supabase o CDN, usar network first
  if (event.request.url.includes('supabase.co') || event.request.url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  // Recursos locales: red primero, cache solo como respaldo sin conexión.
  // Con cache-first, un index.html corregido nunca llegaba a quien ya tenía
  // la PWA instalada salvo que alguien recordara subir CACHE_NAME.
  // 'no-cache' obliga a revalidar con el servidor (304 si no cambió): la
  // cache HTTP del navegador por sí sola seguía entregando la versión vieja.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('./index.html'))
    )
  );
});
