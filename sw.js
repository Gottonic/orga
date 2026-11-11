/* ORGA : un seul service worker pour l'accueil et toutes les apps (Établi, Cash…).
   Fonctionne hors ligne. Changer VERSION à chaque mise à jour du code. */
const VERSION = 'orga-2026-11-11-3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'commun/supabase.js',
  'commun/fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'commun/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'commun/fonts/jetbrains-mono-latin-400-normal.woff2', 'commun/fonts/jetbrains-mono-latin-600-normal.woff2',
  'etabli/', 'etabli/icons/icon-192.png',
  'cash/'
];
/* une page = une adresse ; « dossier/ » et « dossier/index.html » sont la même page */
const cle = url => { const p = new URL(url, self.location).pathname; return p.endsWith('/') ? p + 'index.html' : p; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u =>
    fetch(u, { cache: 'reload' }).then(r => r.ok ? c.put(cle(u), r) : null).catch(() => null)
  ))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  /* efface aussi l'ancien cache d'Établi (« etabli-… ») */
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; /* les données (Supabase) ne passent jamais par le cache */
  if (req.mode === 'navigate') {
    /* une page : toujours la plus récente si le réseau répond, sinon la copie locale */
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(cle(req.url), cp)); } return r; })
      .catch(() => caches.match(cle(req.url)).then(hit => hit || caches.match(cle('./')))));
    return;
  }
  e.respondWith(caches.match(cle(req.url)).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(cle(req.url), cp)); }
    return r;
  })));
});
