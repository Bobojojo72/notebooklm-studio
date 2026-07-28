var CACHE = 'nlm-studio-v2';
var ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/app.css', './assets/app.js', './assets/lib.js',
  './data/styles.js', './data/quick-styles.js', './data/chat-prompts.js',
  './data/studio-prompts.js', './data/workflows.js', './data/tips.js'
];

// Each asset is cached on its own. addAll is all-or-nothing, so a single failed
// request would leave the page with no offline copy at all.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (url) {
      return fetch(new Request(url, { cache: 'reload' }))
        .then(function (res) { if (res.ok) return c.put(url, res); })
        .catch(function () { /* this asset simply will not be available offline */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Network first, cache second. Cache first would keep serving yesterday's prompts
// after an update, because the cache name only changes when this file does.
// ignoreSearch matters on the fallback: a URL like index.html?v=2 would otherwise
// miss the cache entirely and leave a blank page with no network.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
