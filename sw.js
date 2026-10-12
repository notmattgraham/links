// Network-first so a freshly deployed link list shows up immediately;
// falls back to the cached copy when offline or the network is slow.
var CACHE = 'links-v1';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (cached && !settled) { settled = true; resolve(cached); }
        });
      }, NETWORK_TIMEOUT_MS);

      fetch(req).then(function (res) {
        clearTimeout(timer);
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        if (!settled) { settled = true; resolve(res); }
      }).catch(function () {
        clearTimeout(timer);
        caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (!settled) { settled = true; resolve(cached || Response.error()); }
        });
      });
    })
  );
});
