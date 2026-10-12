/* Strictly scoped to the new independent TOEIC Trainer PWA. */
const VERSION='toeic-trainer-v0.5.0';
const OWN_PREFIX='toeic-trainer-v';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./css/style.css','./css/layout-v043.css','./css/preferences-v0433.css','./data/content.js','./data/advanced.js','./data/v04_bank.js','./data/v041_progression.js','./data/v042_official.js','./js/core.js','./js/bridge.js','./js/bank-audit.js','./js/length-policy.js','./js/exam.js','./js/quality-review.js','./js/quality-v043.js','./js/preferences.js','./js/app.js','./js/auto-sync.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(OWN_PREFIX)&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  const url=new URL(e.request.url);
  if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  e.respondWith(fetch(e.request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(e.request,copy)).catch(()=>{})}
    return response;
  }).catch(()=>caches.match(e.request).then(cached=>cached||Response.error())));
});
