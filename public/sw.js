// SW mínimo; luego lo reemplazamos por Workbox
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
