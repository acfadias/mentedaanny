// Service worker: rede primeiro (pega sempre a versão nova), cache como reserva para abrir sem internet.
const CACHE = 'mda-v14';
const BASE = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/rotina.js', 'js/config.js', 'js/devocional-plano.js', 'js/afirmacoes.js', 'js/efeitos.js', 'js/agenda.js', 'js/dia.js', 'js/financas.js', 'manifest.webmanifest', 'icons/favicon.svg', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (url.origin === location.origin || url.hostname.includes('fonts') || url.hostname.includes('jsdelivr'))) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
