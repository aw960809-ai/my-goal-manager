/* V96.8.1 PWA lifecycle */
window.PWA=(function(){
  let deferredPrompt=null;
  let registration=null;
  let reloading=false;
  let lastUpdateCheck=0;

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches===true ||
      window.navigator.standalone===true;
  }
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent||'')}
  function isOnline(){return navigator.onLine!==false}
  function toastSafe(msg){
    try{
      if(typeof window.toast==='function')window.toast(msg);
      else console.info('[PWA]',msg);
    }catch(_){}
  }
  function refreshSettings(){
    try{
      const modal=document.getElementById('settingsModal');
      if(modal?.classList.contains('show')&&typeof window.renderSettings==='function')window.renderSettings();
    }catch(_){}
  }
  function status(){
    if(isStandalone())return {kind:'installed',label:'已安裝',detail:'目前正以獨立應用程式模式執行'};
    if(deferredPrompt)return {kind:'ready',label:'可以安裝',detail:'可直接安裝到手機桌面或電腦應用程式'};
    if(isIOS())return {kind:'ios',label:'可加入主畫面',detail:'Safari：分享 → 加入主畫面'};
    return {kind:'browser',label:'瀏覽器模式',detail:'Chrome／Edge 可由瀏覽器選單安裝應用程式'};
  }
  function settingsPanelHTML(){
    const s=status();
    const installText=s.kind==='installed'?'已安裝':s.kind==='ios'?'加入主畫面說明':'安裝到桌面';
    return `<div class="settings-section pwa-settings-section">
      <div class="settings-section-head"><div><h3>桌面應用程式</h3><p>把這個網站安裝成獨立 App；資料仍保存在本機，AutoFetch 與 GitHub Pages 照常更新。</p></div></div>
      <div class="pwa-settings-status ${s.kind}">
        <div><b>${s.label}</b><small>${s.detail}</small></div>
        <span>${isOnline()?'● 線上':'○ 離線'}</span>
      </div>
      <div class="settings-action-grid">
        <button class="btn primary" type="button" onclick="pwaInstall()" ${s.kind==='installed'?'disabled':''}>⌂ ${installText}</button>
        <button id="pwaUpdateCheckBtn" class="btn" type="button" onclick="pwaCheckForUpdate()">↻ 檢查程式更新</button>
      </div>
      <div id="pwaUpdateStatus" class="pwa-update-status idle" aria-live="polite"><span>●</span><b>尚未檢查更新</b></div>
      <div class="pwa-settings-note">版本 V96.8.1｜支援離線啟動；活動資料在有網路時採網路優先，以避免桌面 App 長期停留在舊資料。</div>
    </div>`;
  }
  function ensureUpdateBar(){
    let bar=document.getElementById('pwaUpdateBar');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.id='pwaUpdateBar';
    bar.className='pwa-update-bar';
    bar.setAttribute('role','status');
    bar.setAttribute('aria-live','polite');
    bar.innerHTML='<div><b>有新的程式版本</b><span>更新不會刪除你的本機目標與紀錄。</span></div><button type="button" onclick="pwaApplyUpdate()">立即更新</button>';
    document.body.appendChild(bar);
    return bar;
  }
  function showUpdate(){ensureUpdateBar().classList.add('show')}
  function hideUpdate(){document.getElementById('pwaUpdateBar')?.classList.remove('show')}
  function observeRegistration(reg){
    registration=reg;
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate();
      });
    });
  }
  async function register(){
    if(!('serviceWorker' in navigator))return null;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      observeRegistration(reg);
      setTimeout(()=>reg.update().catch(()=>{}),1500);
      return reg;
    }catch(e){
      console.warn('PWA service worker registration failed',e);
      return null;
    }
  }
  async function install(){
    if(isStandalone()){toastSafe('目前已經是桌面應用程式');return true}
    if(deferredPrompt){
      const prompt=deferredPrompt;
      deferredPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        refreshSettings();
        if(choice?.outcome==='accepted'){toastSafe('正在安裝到桌面');return true}
        toastSafe('已取消安裝');
        return false;
      }catch(e){
        console.warn(e);toastSafe('目前無法叫出安裝視窗');return false;
      }
    }
    if(isIOS()){
      alert('iPhone／iPad 安裝方式：\n\n1. 使用 Safari 開啟本網站\n2. 點「分享」\n3. 選「加入主畫面」\n4. 點「加入」');
      return false;
    }
    toastSafe('請使用 Chrome／Edge 選單中的「安裝應用程式」或「新增至主畫面」');
    return false;
  }
  /* V96.8.1.1 update feedback hotfix */
  function setUpdateCheckUI(state,message){
    const box=document.getElementById('pwaUpdateStatus');
    const btn=document.getElementById('pwaUpdateCheckBtn');
    if(box){
      box.className='pwa-update-status '+state;
      box.innerHTML=`<span>${state==='checking'?'◌':state==='ok'?'✓':state==='update'?'↑':'!'}</span><b>${message}</b>`;
    }
    if(btn){
      btn.disabled=state==='checking';
      btn.textContent=state==='checking'?'◌ 檢查中…':'↻ 檢查程式更新';
    }
  }
  async function checkForUpdate(){
    if(!('serviceWorker' in navigator)){
      setUpdateCheckUI('error','此瀏覽器不支援程式更新檢查');
      toastSafe('此瀏覽器不支援 Service Worker');
      return false;
    }
    setUpdateCheckUI('checking','正在向伺服器檢查新版本…');
    try{
      registration=registration||await navigator.serviceWorker.getRegistration('./')||await register();
      if(!registration){
        setUpdateCheckUI('error','尚未建立離線服務，請重新整理後再試');
        toastSafe('尚未建立離線服務');
        return false;
      }
      await registration.update();
      lastUpdateCheck=Date.now();
      await new Promise(resolve=>setTimeout(resolve,450));
      if(registration.waiting){
        showUpdate();
        setUpdateCheckUI('update','發現新版本，可以立即更新');
        toastSafe('發現新版本，可以立即更新');
        return true;
      }
      if(registration.installing){
        setUpdateCheckUI('update','發現新版本，正在下載…');
        const worker=registration.installing;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'){
            if(navigator.serviceWorker.controller){
              showUpdate();
              setUpdateCheckUI('update','新版本已下載，可以立即更新');
            }else{
              setUpdateCheckUI('ok','程式已準備完成');
            }
          }
        });
        return true;
      }
      const time=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
      setUpdateCheckUI('ok',`目前已是最新版本 · ${time}`);
      toastSafe('目前已是最新程式版本');
      return true;
    }catch(e){
      console.warn(e);
      setUpdateCheckUI('error',isOnline()?'檢查更新失敗，請稍後再試':'目前離線，無法檢查更新');
      toastSafe(isOnline()?'檢查更新失敗':'目前離線，無法檢查更新');
      return false;
    }
  }
  function applyUpdate(){
    if(registration?.waiting){
      registration.waiting.postMessage({type:'SKIP_WAITING'});
      hideUpdate();
      return;
    }
    checkForUpdate();
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    refreshSettings();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    refreshSettings();
    toastSafe('已安裝到桌面');
  });
  window.addEventListener('online',()=>{refreshSettings();toastSafe('網路已恢復')});
  window.addEventListener('offline',()=>{refreshSettings();toastSafe('目前離線，將使用已快取內容')});

  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(reloading)return;
      reloading=true;
      location.reload();
    });
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    if(Date.now()-lastUpdateCheck<30*60*1000)return;
    checkForUpdate();
  });

  return {register,install,checkForUpdate,applyUpdate,isStandalone,status,settingsPanelHTML};
})();

function pwaSettingsPanelHTML(){return window.PWA.settingsPanelHTML()}
function pwaInstall(){return window.PWA.install()}
function pwaCheckForUpdate(){return window.PWA.checkForUpdate()}
function pwaApplyUpdate(){return window.PWA.applyUpdate()}
