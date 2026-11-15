/* ORGA : un seul service worker pour l'accueil et toutes les apps (l'Établi, la Banque, la Forge, le Marché, la Mine…).
   Fonctionne hors ligne. Changer VERSION à chaque mise à jour du code. */
const VERSION = 'orga-2026-11-15-19';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'commun/supabase.js', 'commun/projets.js', 'commun/dossier.js', 'commun/ampoule.js', 'commun/cadre.css', 'commun/cadre.js', 'commun/lieux.css', 'commun/pictos.js', 'reglages/',
  'commun/fonts/unbounded-latin-500-normal.woff2', 'commun/fonts/unbounded-latin-700-normal.woff2',
  'commun/fonts/space-grotesk-latin-400-normal.woff2', 'commun/fonts/space-grotesk-latin-500-normal.woff2', 'commun/fonts/space-grotesk-latin-600-normal.woff2', 'commun/fonts/space-grotesk-latin-700-normal.woff2',
  'commun/fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'commun/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'commun/fonts/jetbrains-mono-latin-400-normal.woff2', 'commun/fonts/jetbrains-mono-latin-600-normal.woff2',
  'etabli/', 'etabli/icons/icon-192.png',
  'banque/', 'banque/icons/icon-192.png',
  'commun/fonts/bricolage-grotesque-latin-600-normal.woff2', 'commun/fonts/bricolage-grotesque-latin-700-normal.woff2',
  'forge/', 'forge/icons/icon-192.png', 'forge/icons/apple-touch-icon.png',
  'forge/fonts/unbounded-latin-500-normal.woff2',
  'forge/fonts/unbounded-latin-700-normal.woff2',
  'forge/fonts/space-grotesk-latin-400-normal.woff2',
  'forge/fonts/space-grotesk-latin-500-normal.woff2',
  'forge/fonts/space-grotesk-latin-600-normal.woff2',
  'forge/fonts/space-grotesk-latin-700-normal.woff2',
  'forge/fonts/jetbrains-mono-latin-400-normal.woff2',
  'forge/fonts/jetbrains-mono-latin-500-normal.woff2',
  'marche/', 'marche/icons/icon-192.png', 'marche/icons/apple-touch-icon.png',
  'mine/', 'mine/icons/icon-192.png', 'mine/icons/apple-touch-icon.png', 'mine/lib/qrcode.js',
  'mine/fonts/big-shoulders-stencil-display-latin-800-normal.woff2',
  'bibliotheque/', 'bibliotheque/icons/icon-192.png', 'bibliotheque/icons/apple-touch-icon.png'
];
/* une page = une adresse ; « dossier/ » et « dossier/index.html » sont la même page */
const cle = url => { const p = new URL(url, self.location).pathname; return p.endsWith('/') ? p + 'index.html' : p; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u =>
    fetch(u, { cache: 'reload' }).then(r => r.ok ? c.put(cle(u), r) : null).catch(() => null)
  ))).then(() => self.skipWaiting()));
});
/* les caches d'images d'une app (« …-media », ex. carnet-media) ne sont jamais effacés */
const garder = k => k === VERSION || k.endsWith('-media');
self.addEventListener('activate', e => {
  /* efface les anciennes versions (y compris les anciens caches d'Établi et du carnet) */
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !garder(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; /* les données (Supabase) ne passent jamais par le cache */
  if (url.pathname.endsWith('/programme.json')) return;              /* le programme de Forge vient toujours du réseau */
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

/* Notifications (15.11, Bibliothèque) : le rappel du dimanche matin envoyé par .github/workflows/rappel-dimanche.yml.
   Message attendu : { title, body, url (depuis la racine, p. ex. « bibliotheque/?bilan=1 »), tag }. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Locus', {
    body: d.body || '', icon: d.icon || 'bibliotheque/icons/icon-192.png', tag: d.tag || 'locus', renotify: true,
    data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    const c = L.find(x => 'navigate' in x);
    if (c) return c.navigate(url).then(w => (w || c).focus()).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
