/* Goal Manager TOEIC immersive view: presentation-only; no storage writes. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GoalToeicEmbed=api;
  if(typeof document!=='undefined'){
    const boot=()=>api.attach({window:root,document});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TRAINER_PATH='/toeic-trainer/';
  // Static content revision only; never used as a data or storage version.
  const FRAME_REV='98.13.10';
  function isHosted(loc){
    return !!loc&&loc.protocol==='https:'&&loc.hostname==='aw960809-ai.github.io'&&
      /^\/my-goal-manager\/(?:index\.html)?$/.test(String(loc.pathname||''));
  }
  function attach({window,document}={}){
    const launcher=document?.getElementById('homeToeicTraining');
    const overlay=document?.getElementById('gmToeicImmersive');
    const frame=document?.getElementById('gmToeicFrame');
    const back=document?.getElementById('gmToeicBack');
    const settingsButton=document?.getElementById('gmToeicSettings');
    const fallback=document?.getElementById('gmToeicFallback');
    const fallbackText=document?.getElementById('gmToeicFallbackText');
    const app=document?.querySelector('.app');
    if(!window||!launcher||!overlay||!frame||!back||!fallback||!app)return null;
    let open=false,ownsHistory=false,previousFocus=null;
    let frameReloads=0,frameNonce=0;
    function frameUrl(force=false){
      const url=new URL(TRAINER_PATH,window.location.origin);
      // A distinct document URL bypasses stale in-memory / HTTP HTML entries.
      url.searchParams.set('gm_rev',FRAME_REV);
      if(force)url.searchParams.set('_fresh',Date.now()+'-'+(++frameNonce));
      return url.href;
    }
    function isOldFrame(child){
      return !!child?.querySelector?.('.main-nav [data-tab="settings"]');
    }
    function hasActiveExam(child){
      // Do NOT reload an in-progress test (only submitted/draft state is durable).
      return !!child?.querySelector?.('#vocabSession:not([hidden]) .exam-panel, #practiceSession:not([hidden]) .exam-panel, #readingLessonPanel:not([hidden]) .reading-study');
    }
    function refreshTrainerWorker(){
      try{
        const sw=window.navigator?.serviceWorker;
        if(sw?.getRegistration)Promise.resolve(sw.getRegistration(TRAINER_PATH))
          .then(reg=>reg?.update?.()).catch(()=>{});
      }catch(_){/* Offline and unsupported browsers retain the existing iframe fallback. */}
    }
    function failed(message){
      frame.hidden=true;
      fallback.hidden=false;
      if(fallbackText)fallbackText.textContent=message;
      const safeLink=fallback.querySelector?.('a[href]');
      if(safeLink)safeLink.href=frameUrl(true);
    }
    function restore(fromPop=false){
      if(!open)return;
      open=false;
      overlay.hidden=true;
      app.inert=false;
      document.body.classList.remove('gm-toeic-immersive');
      document.documentElement.classList.remove('gm-toeic-immersive');
      if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus();
      const shouldBack=!fromPop&&ownsHistory&&window.history?.state?.gmToeicImmersive===true;
      ownsHistory=false;
      if(shouldBack)window.history.back();
      // The existing Goal Manager runtime remains the only writer of goal logs.
      window.GoalToeicSyncRuntime?.sync?.('trainer-embedded-return');
    }
    function launch(){
      if(open)return;
      previousFocus=document.activeElement;
      open=true;
      overlay.hidden=false;
      app.inert=true;
      document.body.classList.add('gm-toeic-immersive');
      document.documentElement.classList.add('gm-toeic-immersive');
      if(!isHosted(window.location)){
        failed('此預覽環境無法共享兩套系統的本機資料；請至正式網站使用內嵌訓練。');
      }else if(frame.dataset.activated!=='1'){
        refreshTrainerWorker();
        frame.dataset.activated='1';
        frame.src=frameUrl();
      }else{
        // Previous mobile WebViews can survive app switching and keep old DOM.
        // Revalidate an idle legacy iframe instead of reusing its 6-tab page.
        refreshTrainerWorker();
        try{
          const child=frame.contentDocument;
          if(isOldFrame(child)&&!hasActiveExam(child)){
            frameReloads=0;
            frame.src=frameUrl(true);
          }
        }catch(_){/* Do not read from or mutate another origin. */}
      }
      try{
        window.history.pushState({gmToeicImmersive:true},'',window.location.href);
        ownsHistory=true;
      }catch(_){ownsHistory=false;}
      back.focus();
    }
    function onFrameLoaded(){
      if(!open)return;
      let child=null;
      try{child=frame.contentDocument}catch(_){/* Browser denied embedding. */}
      if(!child?.querySelector('.main-nav')){
        failed('無法在 App 內顯示 TOEIC Trainer，請使用下方的獨立網頁備援入口。');
        return;
      }
      if(isOldFrame(child)){
        if(hasActiveExam(child)){
          // Preserve work in progress, even when the frame is an older build.
          fallback.hidden=true;
          frame.hidden=false;
          return;
        }
        if(frameReloads<1){
          frameReloads++;
          refreshTrainerWorker();
          frame.src=frameUrl(true);
          return;
        }
        failed('偵測到舊版 TOEIC 快取；請使用備援連結開啟最新頁面。不必清除學習資料。');
        const link=fallback.querySelector?.('a[href]');
        if(link)link.href=frameUrl(true);
        return;
      }
      frameReloads=0;
      fallback.hidden=true;
      frame.hidden=false;
      // Same-origin iframe only: hide the duplicate masthead without changing
      // the independent TOEIC PWA, learning records or its local preferences.
      const skinId='gmToeicEmbeddedChromeV1';
      if(child.head&&!child.getElementById(skinId)){
        const skin=child.createElement('style');
        skin.id=skinId;
        skin.textContent='.masthead{display:none!important}';
        child.head.appendChild(skin);
      }
      // The Trainer retains its separate code and storage. This only maps the
      // existing "Open Goal Manager" link to the immersive view's back action.
      child.addEventListener('click',event=>{
        const anchor=event.target?.closest?.('a[href]');
        if(!anchor)return;
        try{
          const url=new URL(anchor.href,frame.contentWindow.location.href);
          if(url.origin===window.location.origin&&url.pathname.startsWith('/my-goal-manager/')){
            event.preventDefault();restore(false);
          }
        }catch(_){/* Keep Trainer's own navigation on parsing failures. */}
      },true);
    }
    launcher.addEventListener('click',launch);
    back.addEventListener('click',()=>restore(false));
    if(settingsButton)settingsButton.addEventListener('click',()=>{
      restore(false);
      const openPanel=()=>{try{window.openSettings?.()}catch(_){}};
      if(typeof window.setTimeout==='function')window.setTimeout(openPanel,0);else openPanel();
    });
    frame.addEventListener('load',onFrameLoaded);
    frame.addEventListener('error',()=>{if(open)failed('TOEIC 訓練頁載入失敗，請使用備援入口。')});
    window.addEventListener('popstate',()=>{if(open)restore(true)});
    return Object.freeze({launch,close:restore,isOpen:()=>open});
  }
  return Object.freeze({TRAINER_PATH,isHosted,attach});
});
