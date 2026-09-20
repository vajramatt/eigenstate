// SPDX-License-Identifier: MIT
import { readdir, readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist/assets')).map(file => `/assets/${file}`);
await mkdir('dist/docs', { recursive: true });
await cp('docs/licenses', 'dist/docs/licenses', { recursive: true });
await cp('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
await cp('LICENSE', 'dist/LICENSE');
const html = await readFile('dist/index.html', 'utf8');
const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
const paths = ['/', '/favicon.svg', '/manifest.webmanifest', ...assets];
await writeFile('dist/sw.js', `// SPDX-License-Identifier: MIT
const CACHE = 'eigenstate-${version}';
const ASSETS = ${JSON.stringify(paths)};
self.addEventListener('install', event => { event.waitUntil((async () => {
  await (await caches.open(CACHE)).addAll(ASSETS);
  await self.skipWaiting();
})()); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('eigenstate-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type: 'window' });
  await Promise.all(windows.map(client => client.navigate(client.url)));
})()); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put('/', response.clone());
        return response;
      } catch { return cache.match('/'); }
    }
    const cached = await cache.match(url.pathname);
    return cached || fetch(event.request);
  }));
});
`);
console.log(`Offline shell: ${paths.length} assets, cache eigenstate-${version}`);
