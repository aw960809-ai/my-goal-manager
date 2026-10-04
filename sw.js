/* THU personal service worker */
importScripts('./config/version.js');
const PWA_VERSION=String(globalThis.GOAL_MANAGER_VERSION||'98.10.2');
const PWA_SIGNATURE='thu-personal-'+PWA_VERSION+'-core';
const CACHE_PREFIX='thu-goal-personal-v';
const LEGACY_CACHE_PREFIX='law-goal-web-v';
const CACHE=CACHE_PREFIX+PWA_VERSION;
const APP_SHELL=[
  './','./index.html','./manifest-original.webmanifest','./icon.svg','./icon-original-192.png','./icon-original-512.png','./apple-touch-original.png',
  './icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png',
  './404.html','./css/tokens.css','./css/base.css','./css/app-ui.css','./css/design-system.css','./config/version.js','./config/system-config.js',
  './config/profiles/personal-thu.js','./js/core/runtime-profile.js','./js/core/data-boundary.js',
  './js/security.js','./js/store.js','./js/domain/goals.js','./js/domain/study-logs.js','./js/domain/execution.js','./js/domain/toeic-plan.js','./js/domain/analytics.js','./js/domain/calendar.js','./js/domain/radar-policy.js','./js/services/timer-service.js','./js/services/execution-service.js','./js/data/normalization.js','./js/data/migrations.js','./js/data/repository.js','./js/data/persistence.js','./js/data/history-guard.js','./js/ui/pages/calendar-page.js','./js/ui/pages/execution-page.js','./js/ui/pages/goals-page.js','./js/ui/pages/analytics-page.js','./js/ui/pages/dashboard-page.js','./js/application/orchestrator.js','./js/settings.js','./js/activity.js',
  './js/scholarship.js','./js/app.js','./js/scholarship-lifecycle.js',
  './js/autofetch-health.js',
  './js/catalog-lifecycle.js',
  './js/autofetch-status.js',
  './js/toeic-goal-sync.js','./js/navigation.js','./js/pwa.js','./js/ui-feedback.js','./js/bootstrap.js'
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
const INSTALL_CACHE_TIMEOUT=8*1000;
const CRITICAL_SHELL=[
  './','./index.html','./config/version.js','./config/system-config.js',
  './css/tokens.css','./css/base.css','./css/app-ui.css','./css/design-system.css',
  './js/pwa.js','./js/app.js','./js/bootstrap.js'
];

async function warmInstallCache(urls){
  const cache=await caches.open(CACHE);
  const jobs=urls.map(async url=>{
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),5*1000);
    try{
      const response=await fetch(url,{
        cache:'no-store',
        signal:controller?.signal
      });
      if(response&&response.ok)await cache.put(url,response.clone());
    }catch(_){
      // Install must not be blocked by one slow or temporarily unavailable asset.
    }finally{
      clearTimeout(timer);
    }
  });

  await Promise.race([
    Promise.allSettled(jobs),
    new Promise(resolve=>setTimeout(resolve,INSTALL_CACHE_TIMEOUT))
  ]);
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(warmInstallCache(CRITICAL_SHELL));
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
