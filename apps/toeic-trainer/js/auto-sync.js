/* TOEIC Trainer V0.5.0 — opt-in same-origin automatic learning sync.
 * Trainer never opens, alters or replaces Goal Manager's database.
 * Goal Manager alone reads this app's saved sessions and ingests eligible logs.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicTrainerAutoSync=api;
  if(typeof document!=='undefined'){
    const boot=()=>api.attach({window:root,document});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='toeic-trainer:v051-link-settings';
  const STATUS_KEY='goal-manager:toeic-sync-status-v1';
  const PAGE_PATH_RX=/\/apps\/toeic-trainer\/(?:index\.html)?$/;
  function hosted(location){
    const local=!!location&&location.protocol==='http:'&&
      ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
    return !!location&&(location.protocol==='https:'||local)&&PAGE_PATH_RX.test(location.pathname);
  }
  function read(store){try{const raw=store.getItem(KEY);return raw?JSON.parse(raw):null}catch(_){return null}}
  function save(store,record){
    const raw=JSON.stringify(record);
    store.setItem(KEY,raw);
    if(store.getItem(KEY)!==raw)throw new Error('連動設定無法永久保存');
    return record;
  }
  function enable(store,{now=new Date(),location=null}={}){
    if(!hosted(location))throw new Error('僅能在 Goal Manager 同網域的 TOEIC Trainer 啟用同步');
    const before=read(store)||{};
    if(before.enabled===true&&before.version===1)return before;
    const consent={version:1,enabled:true,enabledAt:now.toISOString()};
    return save(store,consent);
  }
  function disable(store){
    const before=read(store)||{};
    return save(store,{version:1,enabled:false,enabledAt:before.enabledAt||new Date().toISOString()});
  }
  function statusText(window){
    if(!hosted(window.location))return '請從 Goal Manager 同網域開啟 TOEIC Trainer，才能啟用自動連動。';
    const settings=read(window.localStorage);
    if(!settings?.enabled)return '尚未啟用。啟用後只同步此時間點以後完成、達 60 秒的正式交卷紀錄。';
    let receipt=null;
    try{receipt=JSON.parse(window.localStorage.getItem(STATUS_KEY)||'null')}catch(_){}
    if(!receipt)return '自動連動已啟用；請開啟 Goal Manager 接收新完成的訓練。';
    if(receipt.blocked)return '目標系統尚未接收：'+receipt.blocked;
    return `連動已啟用 · 目標端上次接收 ${Number(receipt.addedCount)||0} 筆、${Number(receipt.added)||0} 分；待核對 ${Number(receipt.held)||0} 筆。`;
  }
  function notifyCompleted(event,{window}={}){
    // Called ONLY AFTER the Trainer state passed its durable write verification.
    if(!window||!hosted(window.location))return false;
    const consent=read(window.localStorage);
    if(!consent?.enabled||consent.version!==1)return false;
    const end=Date.parse(event?.createdAt||''),cutoff=Date.parse(consent.enabledAt||'');
    if(!Number.isFinite(end)||!Number.isFinite(cutoff)||end<=cutoff)return false;
    try{
      const bc=typeof window.BroadcastChannel==='function'?new window.BroadcastChannel('toeic-trainer-v05'):null;
      bc?.postMessage({type:'new-submitted-session'});
      bc?.close();
    }catch(_){ /* GM also watches storage events and the next page open. */ }
    return true;
  }
  function attach({window,document}){
    const status=document.getElementById('autoSyncStatus'),toggle=document.getElementById('autoSyncToggle'),jump=document.getElementById('autoSyncOpenGoal');
    if(!status||!toggle)return;
    const paint=()=>{
      status.textContent=statusText(window);
      toggle.textContent=read(window.localStorage)?.enabled?'暫停自動連動':'啟用新練習自動連動';
      toggle.disabled=!hosted(window.location);
      if(jump)jump.href=new URL('../../',window.location.href).href;
    };
    toggle.addEventListener('click',()=>{
      try{
        if(read(window.localStorage)?.enabled){disable(window.localStorage)}
        else{
          const ok=window.confirm('啟用後，只有此刻以後完成、且經驗證的訓練 Session 才會在 Goal Manager 開啟時自動計入。\n\n舊紀錄不會被自動補登。重複或疑似重疊的事件會暫停核對。\n\n確定啟用嗎？');
          if(!ok)return;
          enable(window.localStorage,{location:window.location});
        }
        paint();
      }catch(error){status.textContent='設定未保存：'+String(error?.message||error)}
    });
    window.addEventListener('storage',event=>{if(event.key===STATUS_KEY||event.key===KEY)paint()});
    window.addEventListener('focus',paint);
    paint();
  }
  return Object.freeze({KEY,STATUS_KEY,hosted,read,enable,disable,statusText,notifyCompleted,attach});
});
