/* THU Goal Manager - News x TOEIC Goal Sync */
(function(){
  "use strict";
  const VERSION="97.9.2";
  const BRIDGE_ORIGIN="https://news-toeic-epmqi2.v2.appdeploy.ai";
  const BRIDGE_URL=BRIDGE_ORIGIN+"/?goalSyncBridge=1";
  const KEY="GoalManagerToeicSync::channel";
  const PROCESSED_KEY="GoalManagerToeicSync::processed";
  const STATUS_KEY="GoalManagerToeicSync::status";
  const MAX_PROCESSED=500;
  const state={running:false,last:null,error:""};

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const getCode=()=>{try{return String(localStorage.getItem(KEY)||"").trim()}catch(_){return""}};
  const setCode=v=>{try{localStorage.setItem(KEY,String(v||"").trim())}catch(_){}};
  const getProcessed=()=>{try{const x=JSON.parse(localStorage.getItem(PROCESSED_KEY)||"[]");return Array.isArray(x)?x.map(String):[]}catch(_){return[]}};
  const saveProcessed=a=>{try{localStorage.setItem(PROCESSED_KEY,JSON.stringify([...new Set(a.map(String))].slice(-MAX_PROCESSED)))}catch(_){}};
  const loadStatus=()=>{try{return JSON.parse(localStorage.getItem(STATUS_KEY)||"null")}catch(_){return null}};
  const saveStatus=s=>{state.last=s;try{localStorage.setItem(STATUS_KEY,JSON.stringify(s))}catch(_){}};
  const validCode=v=>/^gm-[a-f0-9]{32}$/.test(String(v||"").trim());
  const eventDate=e=>String(e?.endedAt||e?.startedAt||"").slice(0,10);

  function activeTask(id,date){
    try{
      const t=typeof getTask==="function"?getTask(id):null;
      if(!t||t.level!==4||t.status==="已封存")return null;
      const p=typeof periodForTask==="function"?periodForTask(t):null;
      if(!p?.start||!p?.due||date<p.start||date>p.due)return null;
      return t;
    }catch(_){return null}
  }

  function split(total,pairs){
    total=Math.max(1,Math.round(Number(total)||1));
    const usable=pairs.filter(x=>x.task&&x.weight>0);
    if(!usable.length)return[];
    if(total<usable.length)return[{task:usable[0].task,minutes:total}];
    let left=total;
    return usable.map((x,i)=>{
      let minutes=i===usable.length-1?left:Math.max(1,Math.floor(total*x.weight));
      minutes=Math.min(minutes,left-(usable.length-i-1));
      left-=minutes;
      return {task:x.task,minutes};
    }).filter(x=>x.minutes>0);
  }

  function allocationsFor(e){
    const date=eventDate(e),mins=Math.max(1,Math.round(Number(e?.durationMinutes)||1));
    if(!date)return[];

    const v=activeTask("g3-1-1-1",date),g=activeTask("g3-1-1-2",date);
    if(v||g)return split(mins,[{task:v,weight:.55},{task:g,weight:.45}]);

    const p56=activeTask("g3-2-2-1",date),p7=activeTask("g3-2-2-2",date);
    if(p56||p7)return split(mins,[{task:p56,weight:.25},{task:p7,weight:.75}]);

    const keep=activeTask("g3-3-1-1",date),err=activeTask("g3-3-1-2",date);
    if(keep||err)return split(mins,[{task:keep,weight:.6},{task:err,weight:.4}]);

    const timed=activeTask("g3-4-1-2",date);
    if(timed)return[{task:timed,minutes:mins}];

    const speed=activeTask("g3-5-1-2",date);
    if(speed)return[{task:speed,minutes:mins}];

    return[];
  }

  function pairExists(eventId,taskId){
    try{return Array.isArray(db?.logs)&&db.logs.some(l=>String(l?.sourceEventId||"")===String(eventId)&&String(l?.taskId||"")===String(taskId))}catch(_){return false}
  }

  function makeLog(e,a,index){
    return {
      id:`toeic-sync-${String(e.eventId).replace(/[^a-zA-Z0-9_-]/g,"-")}-${a.task.id}-${index}`,
      taskId:a.task.id,
      name:a.task.name,
      time:e.endedAt||e.startedAt||new Date().toISOString(),
      minutes:a.minutes,
      actual:true,
      planId:null,
      source:"news-toeic",
      sourceEventId:e.eventId,
      sourceArticleId:e.articleId||"",
      sourceArticleTitle:e.articleTitle||"",
      sourceAccuracy:Number(e.accuracy||0),
      sourceReadingWpm:Number(e.readingWpm||0),
      sourceQuestions:Number(e.questionsAnswered||0),
      sourceCorrect:Number(e.correctAnswers||0),
      sourcePart5:Number(e.part5Answered||0),
      sourcePart7:Number(e.part7Answered||0),
      sourceWrongSkills:Array.isArray(e.wrongSkills)?e.wrongSkills.slice(0,12):[]
    };
  }

  function bridgeFrame(){
    let frame=document.getElementById("gmToeicBridgeFrame");
    if(frame)return frame;
    frame=document.createElement("iframe");
    frame.id="gmToeicBridgeFrame";
    frame.src=BRIDGE_URL;
    frame.tabIndex=-1;
    frame.setAttribute("aria-hidden","true");
    frame.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px";
    document.body.appendChild(frame);
    return frame;
  }

  async function fetchEvents(code){
    const requestId="gmreq-"+Date.now()+"-"+Math.random().toString(36).slice(2);
    const frame=bridgeFrame();
    return new Promise((resolve,reject)=>{
      let sent=false;
      const cleanup=()=>{
        clearTimeout(timer);
        window.removeEventListener("message",onMessage);
      };
      const send=()=>{
        if(sent||!frame.contentWindow)return;
        sent=true;
        frame.contentWindow.postMessage({
          type:"news-toeic-goal-sync-request",
          requestId,
          channelId:code
        },BRIDGE_ORIGIN);
      };
      const onMessage=event=>{
        if(event.origin!==BRIDGE_ORIGIN)return;
        const d=event.data||{};
        if(d.type==="news-toeic-goal-sync-ready"){
          frame.dataset.ready="1";
          send();
          return;
        }
        if(d.type!=="news-toeic-goal-sync-response"||d.requestId!==requestId)return;
        cleanup();
        if(!d.ok){reject(new Error(d.error||"Goal Sync Bridge 失敗"));return}
        const payload=d.data;
        if(!payload?.ok||!Array.isArray(payload.events)){
          reject(new Error(payload?.error||"Goal Sync Bridge 回傳格式錯誤"));
          return;
        }
        resolve(payload.events);
      };
      const timer=setTimeout(()=>{
        cleanup();
        reject(new Error("Goal Sync Bridge 連線逾時"));
      },15000);
      window.addEventListener("message",onMessage);
      if(frame.dataset.ready==="1")send();
      else frame.addEventListener("load",()=>setTimeout(send,250),{once:true});
    });
  }

  async function sync(options={}){
    const silent=options.silent===true;
    if(state.running)return state.last;
    const code=getCode();
    if(!validCode(code)){
      if(!silent&&typeof toast==="function")toast("請先貼上 News x TOEIC 的目標同步碼");
      inject();
      return null;
    }
    state.running=true;state.error="";
    try{
      const events=await fetchEvents(code),processed=getProcessed(),done=new Set(processed);
      let imported=0,minutes=0,deferred=0,duplicate=0;
      for(const e of events){
        const id=String(e?.eventId||"");
        if(!id||done.has(id)){duplicate++;continue}
        const allocations=allocationsFor(e);
        if(!allocations.length){deferred++;continue}
        let wrote=0;
        allocations.forEach((a,i)=>{
          if(!a?.task||a.minutes<=0)return;
          if(pairExists(id,a.task.id))return;
          db.logs.unshift(makeLog(e,a,i));
          wrote+=a.minutes;
        });
        done.add(id);
        imported++;
        minutes+=wrote;
      }
      saveProcessed([...done]);
      if(imported){
        if(typeof save==="function"&&!save({backup:false}))throw new Error("Goal Manager 儲存失敗");
        if(typeof renderAll==="function")renderAll();
      }
      const summary={
        at:new Date().toISOString(),
        imported,minutes,deferred,duplicate,
        available:events.length,
        message:`已匯入 ${imported} 筆／${minutes} 分鐘${deferred?`；期間外 ${deferred} 筆未計入`:""}`
      };
      saveStatus(summary);
      if(!silent&&typeof toast==="function")toast(summary.message);
      inject();
      return summary;
    }catch(e){
      state.error=String(e?.message||e);
      saveStatus({at:new Date().toISOString(),error:state.error});
      if(!silent&&typeof toast==="function")toast("TOEIC 同步失敗："+state.error);
      inject();
      return null;
    }finally{
      state.running=false;
    }
  }

  function saveCodeAndSync(){
    const input=document.getElementById("gmToeicSyncCode");
    const code=String(input?.value||"").trim();
    if(!validCode(code)){if(typeof toast==="function")toast("同步碼格式不正確");return}
    setCode(code);
    sync({silent:false});
  }

  function clearCode(){
    if(!confirm("取消 News x TOEIC 與此目標系統的連動？既有實際投入紀錄會保留。"))return;
    setCode("");
    try{localStorage.removeItem(PROCESSED_KEY);localStorage.removeItem(STATUS_KEY)}catch(_){}
    state.last=null;state.error="";
    inject();
    if(typeof toast==="function")toast("已取消 TOEIC 連動；既有紀錄未刪除");
  }

  function panelHTML(){
    const code=getCode(),s=loadStatus()||state.last||{},linked=validCode(code);
    const status=s?.error?`同步異常：${s.error}`:s?.message||"尚無同步紀錄";
    return `<section id="gmToeicGoalSync" class="gm-toeic-sync">
      <div class="gm-toeic-head">
        <div><h3>News x TOEIC 自動連動</h3><p>完整學習後自動寫入「語言能力準備」的實際投入，不重複計算。</p></div>
        <span class="${linked?"ok":"warn"}">${linked?"已連結":"尚未連結"}</span>
      </div>
      <label>目標同步碼</label>
      <input id="gmToeicSyncCode" type="password" autocomplete="off" placeholder="gm-…" value="${esc(code)}">
      <div class="gm-toeic-actions">
        <button type="button" class="btn gold" onclick="window.GoalManagerToeicSync.saveCodeAndSync()">儲存並同步</button>
        <button type="button" class="btn" onclick="window.GoalManagerToeicSync.sync()">立即同步</button>
        ${linked?'<button type="button" class="btn" onclick="window.GoalManagerToeicSync.clearCode()">取消連動</button>':""}
      </div>
      <div class="gm-toeic-status">${esc(status)}</div>
      <div class="gm-toeic-note">只在 Level 3 子任務有效期間內寫入 Level 4 實際投入；事件以 sourceEventId + taskId 去重。期間外學習保留在 TOEIC 同步中心，但不計入完成度。</div>
    </section>`;
  }

  function styles(){
    if(document.getElementById("gmToeicGoalSyncStyle"))return;
    const s=document.createElement("style");s.id="gmToeicGoalSyncStyle";
    s.textContent='.gm-toeic-sync{margin-top:16px;padding:16px;border:1px solid #dce5e1;border-radius:18px;background:#fff}.gm-toeic-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.gm-toeic-head h3{margin:0;color:#075c42;font-size:19px}.gm-toeic-head p{margin:5px 0 0;color:#77827e;font-size:13px}.gm-toeic-head span{font-size:12px;font-weight:800}.gm-toeic-head .ok{color:#08764f}.gm-toeic-head .warn{color:#a46b00}.gm-toeic-sync label{display:block;margin:13px 0 5px;color:#65716d;font-size:12px;font-weight:800}.gm-toeic-sync input{width:100%;box-sizing:border-box;border:1px solid #dce5e1;border-radius:11px;padding:11px 12px;background:#f8faf9;color:#18362d}.gm-toeic-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.gm-toeic-status{margin-top:11px;padding:9px 11px;border-radius:12px;background:#f6f9f8;color:#29473e;font-size:12px}.gm-toeic-note{margin-top:9px;color:#89928f;font-size:11px;line-height:1.55}.app-dark .gm-toeic-sync{background:#17211e;border-color:#2a3833}.app-dark .gm-toeic-sync input,.app-dark .gm-toeic-status{background:#1e2a26;color:#e7efec;border-color:#34463f}@media(max-width:650px){.gm-toeic-actions .btn{flex:1;min-width:95px}}';
    document.head.appendChild(s);
  }

  function inject(){
    styles();
    const body=document.getElementById("settingsBody");
    if(!body)return;
    document.getElementById("gmToeicGoalSync")?.remove();
    const anchor=document.getElementById("gmAutoUpdateStatus")||document.getElementById("gmAutoFetchHealth")||document.getElementById("gmCatalogLifecyclePanel");
    if(anchor)anchor.insertAdjacentHTML("afterend",panelHTML());
    else body.insertAdjacentHTML("beforeend",panelHTML());
  }

  function hook(){
    if(typeof window.renderSettings!=="function"||window.renderSettings.__gmToeicGoalSyncWrapped)return;
    const original=window.renderSettings;
    const wrapped=function(){const r=original.apply(this,arguments);setTimeout(inject,0);return r};
    wrapped.__gmToeicGoalSyncWrapped=true;
    window.renderSettings=wrapped;
  }

  function boot(){
    styles();hook();inject();
    if(validCode(getCode()))sync({silent:true});
    window.addEventListener("online",()=>sync({silent:true}));
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sync({silent:true})});
    setInterval(()=>sync({silent:true}),10*60*1000);
  }

  window.GoalManagerToeicSync=Object.freeze({
    version:VERSION,
    sync,
    saveCodeAndSync,
    clearCode,
    status:()=>({codeLinked:validCode(getCode()),last:loadStatus(),running:state.running})
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();