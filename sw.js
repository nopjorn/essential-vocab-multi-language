// Offline support: precache the app shell and vocabulary, then serve
// stale-while-revalidate. The cache name comes from version.js, so every
// deploy (new version or build number) installs a fresh cache and the app
// shows an "update ready" prompt.
importScripts('version.js');
const CACHE = `evocab-${self.APP_VERSION}-${self.APP_BUILD}`;
// Keep in sync with the files the app loads (scripts/validate.mjs checks this).
const CORE = [
  './',
  'index.html',
  'version.js',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/app.js',
  'assets/js/app-info.js',
  'assets/js/badges.js',
  'assets/js/engage.js',
  'assets/js/core.js',
  'assets/js/game.js',
  'assets/js/guide.js',
  'assets/js/i18n.js',
  'assets/js/icons.js',
  'assets/js/info.js',
  'assets/js/practice.js',
  'assets/js/progress.js',
  'assets/js/settings.js',
  'assets/js/sound.js',
  'assets/js/speech.js',
  'assets/js/store.js',
  'assets/js/theme.js',
  'assets/js/welcome.js',
  'assets/js/words.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-64.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'data/languages.json',
  'data/changelog.json',
  'data/vocab/en.json',
  'data/vocab/ko.json',
  'data/vocab/ja.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // bypass the HTTP cache so a new version never precaches stale files
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('evocab-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
