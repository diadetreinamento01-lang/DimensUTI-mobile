const CACHE_NAME = "cade-a-escala-v411";

const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css?v=4.1.1",
  "./js/app.js?v=4.1.1",
  "./js/auth.js?v=4.1.1",
  "./js/supabase-config.js?v=4.1.1",
  "./manifest.json",
  "./assets/logo-dia-de-treinamento.jpeg"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Para arquivos do próprio aplicativo,
  // tenta buscar a versão mais nova primeiro.
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, copy);
            });
          }

          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );

    return;
  }

  // Recursos externos: rede primeiro.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
