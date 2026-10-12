/* V98.13.6: opt-in, same-origin, idempotent TOEIC v0.5 ingestion.
 * Never reads another origin; never writes unless a valid trainer consent exists.
 * The Goal Manager's own save() and history guard remain the only DB writer.
 */
(function(){
  'use strict';
  const policy=window.GoalToeicSyncPolicy;
  if(!policy)return;
  let busy=false,lastSummary=null;
  let externalMainChanged=false;
  function safeJSON(key){
    const raw=localStorage.getItem(key);
    if(!raw)return null;
    if(raw.length>3*1024*1024)throw new Error('訓練資料檔超過安全上限');
    return JSON.parse(raw);
  }
  function recordSummary(summary){
    lastSummary=summary;
    try{localStorage.setItem(policy.STATUS_KEY,JSON.stringify(summary))}catch(e){console.warn('TOEIC 狀態回報無法永久保存',e)}
    updateUI();
  }
  function updateUI(){
    const panel=document.getElementById('goalBrowsePanel');
    if(!panel)return;
    let el=document.getElementById('gmToeicBridgeEntry');
    if(!el){
      el=document.createElement('div');el.id='gmToeicBridgeEntry';
      el.style.cssText='display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:9px;padding:10px 12px;margin:6px 0 12px;border:1px solid var(--gm-line,#dae1e7);border-radius:12px;background:var(--gm-surface-elevated,#fff)';
      const msg=document.createElement('span');msg.id='gmToeicBridgeStatus';msg.style.cssText='font-size:12px;color:var(--gm-text-secondary,#667480)';
      const a=document.createElement('a');a.href='/toeic-trainer/';a.textContent='開始 TOEIC 訓練 →';a.style.cssText='font-size:13px;font-weight:700;color:var(--gm-primary-deep,#526d98)';
      el.append(msg,a);
      panel.insertBefore(el,panel.querySelector('#gmGoalSearchDisclosure')||panel.firstChild);
    }
    const msg=document.getElementById('gmToeicBridgeStatus');if(!msg)return;
    const s=lastSummary;
    if(!s){msg.textContent='TOEIC 學習連動 · 尚未檢查';return}
    if(s.blocked){msg.textContent='TOEIC 連動：'+s.blocked;return}
    msg.textContent=`TOEIC · 本次新增 ${s.added} 分（${s.addedCount} 筆），待核對 ${s.held} 筆，已處理 ${s.already} 筆`;
  }
  function isDatabaseCurrent(){
    // Avoid saving a stale in-memory tab over logs added in another tab.
    const raw=typeof storeGet==='function'?storeGet('lawLangGoalSystemV92'):null;
    if(!raw)throw new Error('主資料不存在，停止連動');
    if(externalMainChanged||typeof gmToeicLastCommittedRaw!=='string'||raw!==gmToeicLastCommittedRaw){
      throw new Error('另一分頁修改過目標資料（含目標、行事曆或執行安排）；自動連動已停止，請重新載入');
    }
    const parsed=typeof parseEnvelope==='function'?parseEnvelope(raw):null;
    if(!parsed||!parsed.data||!Array.isArray(parsed.data.logs))throw new Error('無法核對當前歷史資料');
    const disk=new Map(parsed.data.logs.map(l=>[String(l.id),l]));
    if(disk.size!==db.logs.length||disk.size!==parsed.data.logs.length)throw new Error('其他分頁已更新歷史紀錄，請重新載入目標系統');
    for(const l of db.logs){
      const stored=disk.get(String(l.id));
      const before=stored&&typeof StudyLogDomain!=='undefined' ? StudyLogDomain.normalizeLog(stored) : stored;
      if(!before||JSON.stringify([before.taskId,before.time,before.minutes,before.actual,before.kind])!==
        JSON.stringify([l.taskId,l.time,l.minutes,l.actual,l.kind]))throw new Error('其他分頁正在修改學習紀錄，請重新載入');
    }
  }
  function sync(reason='manual'){
    if(busy)return lastSummary;
    busy=true;
    try{
      if(typeof db==='undefined'||!db||!Array.isArray(db.tasks)||!Array.isArray(db.logs)||typeof save!=='function')return null;
      if(typeof timer!=='undefined'&&timer?.running){
        recordSummary({blocked:'目標系統正在計時，暫停自動連動以避免重複計時',added:0,addedCount:0,held:0,already:0});return lastSummary;
      }
      if(typeof persistenceRecoveryBlocked!=='undefined'&&persistenceRecoveryBlocked){
        recordSummary({blocked:'主資料處於救援保護模式；沒有寫入',added:0,addedCount:0,held:0,already:0});return lastSummary;
      }
      const consent=safeJSON(policy.CONSENT_KEY),trainer=safeJSON(policy.TRAINER_KEY);
      const report=policy.reconcile(trainer,consent,{tasks:db.tasks,logs:db.logs,now:new Date()});
      if(report.blocked){recordSummary({blocked:report.blocked,added:0,addedCount:0,held:report.held.length,already:report.already.length});return lastSummary}
      const unique=report.eligible.map(x=>x.log);
      let added=0;
      if(unique.length){
        isDatabaseCurrent();
        const original=db.logs;
        db.logs=[...unique,...original];
        // save() writes through Goal Manager DataPersistence; if it fails,
        // restore the original memory reference without touching any old log.
        if(!save({backup:true})){
          db.logs=original;
          throw new Error('目標系統永久寫入驗證失敗；已還原操作前紀錄');
        }
        added=unique.reduce((sum,x)=>sum+x.minutes,0);
        if(typeof renderAll==='function')renderAll();
      }
      recordSummary({version:1,lastCheckedAt:new Date().toISOString(),reason,blocked:'',added,addedCount:unique.length,
        held:report.held.length,excluded:report.excluded.length,already:report.already.length,
        // No personal records or complete goal backup in status receipt.
        heldReasons:report.held.slice(0,4).map(x=>x.reason)});
      return lastSummary;
    }catch(e){
      console.error('[TOEIC v0.5] Safe sync stopped:',e);
      recordSummary({blocked:String(e?.message||e),added:0,addedCount:0,held:0,already:0});
      return lastSummary;
    }finally{busy=false}
  }
  function boot(){
    updateUI();
    sync('goal-manager-open');
    window.addEventListener('storage',event=>{
      if(event.key==='lawLangGoalSystemV92'&&event.newValue!==gmToeicLastCommittedRaw){
        externalMainChanged=true;
        recordSummary({blocked:'目標系統另有分頁更新資料；請重新載入再連動',added:0,addedCount:0,held:0,already:0});
        return;
      }
      if(event.key===policy.TRAINER_KEY||event.key===policy.CONSENT_KEY)sync('other-tab-write');
    });
    window.addEventListener('focus',()=>sync('focus'));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync('resume')});
    if(typeof BroadcastChannel==='function'){
      const channel=new BroadcastChannel('toeic-trainer-v05');
      channel.onmessage=event=>{if(event.data?.type==='new-submitted-session')sync('completed-session')};
    }
  }
  if(document.readyState==='complete')boot();else window.addEventListener('load',boot,{once:true});
  window.GoalToeicSyncRuntime=Object.freeze({sync,status:()=>lastSummary});
})();
