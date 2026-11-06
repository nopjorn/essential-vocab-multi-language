// Offline support: precache the app shell and vocabulary, then serve cache-first.
// The shell cache name comes from version.js, so every deploy (new version or build number)
// installs a fresh cache and the app shows an "update ready" prompt. Files in CORE never
// hit the network after install (they are exactly the version this cache was built for);
// anything else is fetched and kept.
// Vocabulary (≈1.6 MB) lives in its own cache that survives deploys: the app asks for
// data/vocab/<code>.json?rev=<content hash> (rev from languages.json), so a new deploy only
// downloads the languages whose words changed.
importScripts('version.js');
const CACHE = `evocab-${self.APP_VERSION}-${self.APP_BUILD}`;
const VOCAB = 'evocab-vocab';
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
  'assets/js/placement.js',
  'assets/js/rules.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-64.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'data/languages.json',
  'data/changelog.json',
];

// Vocabulary URLs of this version, read from the languages.json just cached.
async function vocabUrls(cache) {
  const index = await (await cache.match('data/languages.json')).json();
  return index.learn.map((l) => new URL(`data/${l.file}?rev=${l.rev}`, self.registration.scope).href);
}

const isVocab = (url) => url.pathname.includes('/data/vocab/');

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // bypass the HTTP cache so a new version never precaches stale files
      .then(async (c) => {
        await c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
        // only the languages whose rev is not cached yet are downloaded
        const vocab = await caches.open(VOCAB);
        for (const url of await vocabUrls(c)) {
          if (!(await vocab.match(url))) await vocab.add(new Request(url, { cache: 'reload' }));
        }
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('evocab-') && k !== CACHE && k !== VOCAB).map((k) => caches.delete(k))))
      // drop vocabulary revs this version no longer uses
      .then(async () => {
        const keep = new Set(await vocabUrls(await caches.open(CACHE)));
        const vocab = await caches.open(VOCAB);
        for (const req of await vocab.keys()) if (!keep.has(req.url)) await vocab.delete(req);
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (isVocab(url)) {
    // exact match: the rev in the query names the content
    e.respondWith(
      caches.open(VOCAB).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok && url.searchParams.has('rev')) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
