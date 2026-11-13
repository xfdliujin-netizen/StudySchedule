const CACHE = 'study-planner-v32';
const FILES = [
  './css/refinements.css',
  './css/daily.css',
  './',
  './index.html',
  './css/learning.css',
  './css/board.css',
  './js/app.js',
  './js/view-model.js',
  './js/home-board.js',
  './js/celebration.js',
  './js/database.js',
  './js/github-sync.js',
  './js/repeat-engine.js',
  './js/task-manager.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('study-planner-') && k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
