const C='tehnika-v1';const F=['./','index.html','app.css','app.js','lib/xlsx.full.min.js','lib/exceljs.min.js','icon.png','icon-192.png','manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
