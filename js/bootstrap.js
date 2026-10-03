/* Application bootstrap: expose runtime APIs, render once, then register PWA. */
(function(){
  'use strict';

  function exposeRuntime(){
    window.AppCore={
      storage:{
        get:window.storeGet,
        set:window.storeSet,
        save:window.save,
        exportDB:window.exportDB,
        importDB:window.importDB
      },
      catalog:{
        activities:window.activityStore,
        scholarships:window.scholarshipStore,
        byId:window.catalogItemById
      },
      validation:{
        validateData:window.validateData,
        validateDB:window.validateDB,
        makeEnvelope:window.makeEnvelope,
        parseEnvelope:window.parseEnvelope,
        fnv1a:window.fnv1a,
        sha256Hex:window.sha256Hex,
        makeSecureBackupEnvelope:window.makeSecureBackupEnvelope,
        validateSecureBackupEnvelope:window.validateSecureBackupEnvelope
      },
      cache:{
        clear:window.clearApplicationCaches,
        clearOnly:window.clearCacheOnly
      },
      diagnostics:{
        run:window.runSelfTest,
        auditButtonHandlers:window.auditButtonHandlers,
        auditCoreModules:window.auditCoreModules,
        auditDataRoundTrip:window.auditDataRoundTrip,
        auditDOM:window.auditDOM
      }
    };

    window.AppModules={
      dashboard:{render:window.dashboard},
      goals:{render:window.renderGoalsPage},
      execution:{render:window.today},
      activities:{render:window.renderActivities},
      scholarships:{render:window.renderScholarships},
      calendar:{render:window.renderCalendar},
      analytics:{render:window.stats}
    };
  }

  function registerPWA(){
    if(window.PWA&&typeof window.PWA.register==='function'){
      window.PWA.register();
      return;
    }

    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }

  function goalManagerBootstrap(){
    if(window.__goalManagerBooted)return;
    window.__goalManagerBooted=true;

    exposeRuntime();

    if(typeof window.renderAll==='function'){
      window.renderAll();
    }

    registerPWA();

    if(typeof window.loadRemoteActivities==='function'){
      setTimeout(()=>window.loadRemoteActivities(),120);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      goalManagerBootstrap,
      {once:true}
    );
  }else{
    goalManagerBootstrap();
  }
})();
