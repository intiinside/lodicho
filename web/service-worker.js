// App shell instalable. Regla dura: los datos (todo lo que cuelga de /api/)
// nunca se sirven desde cache — un informe o una cifra vieja mostrada como
// si fuera vigente es peor que no mostrar nada. Solo el shell estatico
// (HTML/CSS/JS/iconos) se cachea, con stale-while-revalidate.
const CACHE_VERSION = "lodicho-shell-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/api.js",
  "/js/state.js",
  "/js/vendor/marked.min.js",
  "/js/components/bottom-nav.js",
  "/js/components/top-header.js",
  "/js/components/voice-recorder.js",
  "/js/components/veredicto-badge.js",
  "/js/components/evidencia-sheet.js",
  "/js/components/banner-silencio.js",
  "/js/components/informe-card.js",
  "/js/views/home-view.js",
  "/js/views/resultado-view.js",
  "/js/views/historial-view.js",
  "/js/views/acerca-view.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Si un asset individual falla (p.ej. corriendo sin todas las
        // vistas todavia), no tumbar la instalacion completa del SW.
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// app.js pide skip-waiting explicitamente cuando el usuario acepta
// actualizar, para no recargarle la app a media consulta sin avisar.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match("/offline.html"));
      return cached || network;
    })
  );
});
