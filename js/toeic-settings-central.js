/* Goal Manager V98.13.9: the single owner of TOEIC settings on the same HTTPS origin.
 * No goal data writes; no direct imports without explicit user confirmation.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GoalToeicCentralSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STATE_KEY='toeic-trainer-v01:learning-state';
  const RESTORE_POINT_KEY='toeic-trainer:central-settings-restore-point-v1';
  const CONSENT_KEY='toeic-trainer:v051-link-settings';
  const DRAFT_KEY='toeic-trainer-v042:active-exam-draft';
  const MAX_BYTES=8_000_000;
  const APP_ID='toeic-trainer-standalone';
  const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  function hosted(location){
    return !!location&&location.protocol==='https:'&&location.hostname==='aw960809-ai.github.io'&&
      /^\/my-goal-manager\/(?:index\.html)?$/.test(String(location.pathname||''));
  }
  function stringBytes(x){return new TextEncoder().encode(x).byteLength;}
  function inspect(raw){
    if(typeof raw!=='string'||!raw||stringBytes(raw)>MAX_BYTES)throw new Error('TOEIC 備份為空或超過 8 MB');
    let data;
    try{data=JSON.parse(raw)}catch(_){throw new Error('不是有效的 JSON 檔案')}
    if(!plain(data)||data.appId!==APP_ID||data.schema!==1||!Array.isArray(data.sessions)||
      !plain(data.review)||!plain(data.questionStats)||
      (data.savedWordIds!==undefined&&!Array.isArray(data.savedWordIds))||
      (data.readingProgress!==undefined&&!plain(data.readingProgress)))
      throw new Error('不是獨立 TOEIC Trainer Schema 1 的完整備份');
    if(data.sessions.length>2000||Object.keys(data.review).length>15000||
       Object.keys(data.questionStats).length>15000||
       (data.savedWordIds||[]).length>1200||Object.keys(data.readingProgress||{}).length>500)
      throw new Error('備份資料量超出原有訓練系統限制');
    const ids=new Set();
    for(const s of data.sessions){
      if(!plain(s)||s.appId!==APP_ID||typeof s.id!=='string'||
         !Number.isFinite(Number(s.seconds))||ids.has(s.id))
        throw new Error('備份含來源不符、重複或不完整的 Session；沒有覆蓋原紀錄');
      ids.add(s.id);
    }
    return {count:data.sessions.length,wordReviews:Object.keys(data.review).length,raw};
  }
  function consent(storage){
    try{
      const raw=storage.getItem(CONSENT_KEY);
      if(!raw||raw.length>2048)return null;
      const x=JSON.parse(raw);
      return plain(x)&&x.version===1&&typeof x.enabled==='boolean'&&typeof x.enabledAt==='string'&&
        Number.isFinite(Date.parse(x.enabledAt))?x:null;
    }catch(_){return null}
  }
  function setConsent(storage,location,enabled,now=new Date()){
    if(!hosted(location))throw new Error('僅能在正式 Goal Manager 設定連動');
    if(typeof enabled!=='boolean'||!Number.isFinite(now.getTime()))throw new Error('連動狀態無效');
    const before=consent(storage);
    const record={version:1,enabled,enabledAt:enabled?now.toISOString():(before?.enabledAt||now.toISOString())};
    const raw=JSON.stringify(record);
    storage.setItem(CONSENT_KEY,raw);
    if(storage.getItem(CONSENT_KEY)!==raw)throw new Error('連動設定未能安全寫入');
    return record;
  }
  function currentBackup(storage){
    const raw=storage.getItem(STATE_KEY);
    if(!raw)throw new Error('尚無 TOEIC 學習紀錄可備份');
    return inspect(raw);
  }
  function restore(storage,location,incoming){
    if(!hosted(location))throw new Error('只能在正式 Goal Manager 還原 TOEIC 紀錄');
    const next=inspect(incoming);
    if(storage.getItem(DRAFT_KEY))throw new Error('尚有未交卷的 TOEIC 草稿，請先完成或放棄');
    const original=storage.getItem(STATE_KEY);
    if(original!==null)inspect(original); // Do not overwrite already damaged or unknown data.
    if(original===incoming)return {unchanged:true,count:next.count};
    if(original!==null){
      storage.setItem(RESTORE_POINT_KEY,original);
      if(storage.getItem(RESTORE_POINT_KEY)!==original)throw new Error('未建立復原點，已停止');
    }
    try{
      storage.setItem(STATE_KEY,incoming);
      if(storage.getItem(STATE_KEY)!==incoming)throw new Error('TOEIC 備份寫入驗證失敗');
    }catch(error){
      // Retain old source in RESTORE_POINT_KEY even if rollback cannot complete.
      try{
        if(original===null)storage.removeItem(STATE_KEY);
        else storage.setItem(STATE_KEY,original);
      }catch(_){/* Protected independent restore point remains. */}
      throw error;
    }
    return {unchanged:false,count:next.count,hadOriginal:original!==null};
  }
  return Object.freeze({STATE_KEY,CONSENT_KEY,RESTORE_POINT_KEY,DRAFT_KEY,hosted,inspect,consent,setConsent,currentBackup,restore});
});
