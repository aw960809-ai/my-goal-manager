const CACHE='law-goal-web-v96-5';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./404.html','./css/base.css','./css/app-ui.css','./config/system-config.js','./js/security.js','./js/store.js','./js/settings.js','./js/activity.js','./js/scholarship.js','./js/app.js','./js/navigation.js','./js/bootstrap.js','./data/events.json','./data/activities.json','./data/scholarships.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET') return;
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>{if(e.request.mode==='navigate')return caches.match('./index.html');return Response.error();})));
});
