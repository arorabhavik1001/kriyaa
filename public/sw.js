const CACHE_NAME = "Ekaagra-planner-static-v2";

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/logo.png",
  "/favicon.ico",
  "/index.html",
  "/",
];

const toNoCacheRequest = (req) => {
  try {
    return new Request(req, { cache: "no-cache" });
  } catch {
    return req;
  }
};

// Install
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const req = event.request;

  // 🟢 ALWAYS NETWORK-FIRST for SPA navigation / HTML
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(toNoCacheRequest(req)).catch(() => {
        return caches.match("/index.html");
      })
    );
    return;
  }

  // 🟡 Cache-first for other GET requests
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(toNoCacheRequest(req)).then((resp) => {
        if (resp && resp.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return resp;
      });
    })
  );
});

// Skip waiting support
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
