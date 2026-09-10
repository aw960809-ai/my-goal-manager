/* V97.3.0 THU personal service worker */
const PWA_VERSION='97.7.2';
const PWA_SIGNATURE='thu-personal-97.7.2-runtime-collision-cleanup';
const CACHE_PREFIX='thu-goal-personal-v';
const LEGACY_CACHE_PREFIX='law-goal-web-v';
const CACHE=CACHE_PREFIX+PWA_VERSION;
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./icon.svg',
  './icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png',
  './404.html','./css/base.css','./css/app-ui.css','./config/system-config.js',
  './config/profiles/personal-thu.js','./js/core/runtime-profile.js','./js/core/data-boundary.js',
  './js/security.js','./js/store.js','./js/settings.js','./js/activity.js',
  './js/scholarship.js','./js/app.js','./js/scholarship-lifecycle.js',
  './js/autofetch-health.js',
  './js/catalog-lifecycle.js','./js/navigation.js','./js/pwa.js','./js/bootstrap.js'
];
const MUTABLE_DATA=['./data/events.json','./data/activities.json','./data/scholarships.json',
  './data/activity-archive.json',
  './data/scholarship-archive.json'];

async function cacheResponse(request,response){
  if(!response||!response.ok||response.type==='opaque')return;
  const cache=await caches.open(CACHE);
  await cache.put(request,response.clone());
}
async function networkFirst(request,fallbackUrl){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)await cacheResponse(request,response);
    return response;
  }catch(_){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(fallbackUrl){
      const fallback=await caches.match(fallbackUrl);
      if(fallback)return fallback;
    }
    return Response.error();
  }
}
async function staleWhileRevalidate(request){
  const cached=await caches.match(request);
  const fresh=fetch(request,{cache:'no-store'})
    .then(async response=>{
      if(response&&response.ok)await cacheResponse(request,response);
      return response;
    }).catch(()=>null);
  return cached||await fresh||Response.error();
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    await Promise.allSettled(MUTABLE_DATA.map(url=>cache.add(url)));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith(LEGACY_CACHE_PREFIX))&&k!==CACHE)
        .map(k=>caches.delete(k))
    );
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION'&&event.ports?.[0]){
    event.ports[0].postMessage({version:PWA_VERSION,signature:PWA_SIGNATURE});
  }
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(networkFirst(request,'./index.html'));return}
  if(/\/data\/(?:activities|scholarships|events|activity-archive|scholarship-archive)\.json$/.test(url.pathname)){event.respondWith(networkFirst(request));return}
  if(/\.(?:js|css|webmanifest)$/.test(url.pathname)){event.respondWith(networkFirst(request));return}
  if(/\.(?:svg|png)$/.test(url.pathname)){event.respondWith(staleWhileRevalidate(request));return}
  event.respondWith(networkFirst(request));
});
