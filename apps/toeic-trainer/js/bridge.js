/* TOEIC Trainer V0.3 – pure, read-only Goal Manager reconciliation. No GM writes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicTrainerBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const APP_ID='toeic-trainer-standalone';
  const FORMAT='toeic-trainer-learning-events';
  const MAX_DURATION=6*60*60;
  const VALID_UNITS=new Set(['article','review','practice']);
  const MODES=new Set(['reading','guided-reading','grammar','mixed','mistakes','vocabulary','passage']);
  const RX_ID=/^tt-[a-z0-9-]{8,70}$/i;
  const RX_ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
  function list(x){return Array.isArray(x)?x:[]}
  function dateKey(x){
    const d=x instanceof Date?x:new Date(x);
    if(!Number.isFinite(d.getTime()))return '';
    const p=dateFormat.formatToParts(d);
    const get=k=>p.find(x=>x.type===k)?.value||'';
    return [get('year'),get('month'),get('day')].join('-');
  }
  function isDate(s){
    if(typeof s!=='string'||!/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(s))return false;
    const ms=Date.parse(s+'T12:00:00+08:00');
    return Number.isFinite(ms)&&dateKey(ms)===s;
  }
  function isISO(s){return typeof s==='string'&&RX_ISO.test(s)&&Number.isFinite(Date.parse(s))}
  function localMinutes(seconds){return Math.floor(seconds/60)}
  function stableSerialize(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(stableSerialize).join(',')+']';
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableSerialize(value[k])).join(',')+'}';
  }
  function fnv1a(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
  async function sha256(s){
    if(typeof crypto==='undefined'||!crypto.subtle)throw new Error('環境不支援 SHA-256 完整性檢查；請以 Chrome 的本機網址開啟。');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
    return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  }
  // A local user-selected GM backup is read into transient memory only.
  async function readGoalSnapshot(raw){
    if(typeof raw!=='string'||!raw||raw.length>2*1024*1024)throw new Error('目標備份為空或超過 2 MB 安全上限。');
    let doc;try{doc=JSON.parse(raw)}catch(_){throw new Error('目標備份不是有效 JSON。')}
    if(!doc||typeof doc!=='object'||Array.isArray(doc)||Number(doc.schemaVersion)!==6||!doc.data)
      throw new Error('請選擇 Goal Manager Schema 6 的完整備份；不可使用 TOEIC Trainer 備份。');
    const data=doc.data;
    if(!data||!Array.isArray(data.tasks)||!Array.isArray(data.logs)||data.tasks.length>5000||data.logs.length>5000)
      throw new Error('目標備份缺少 tasks／logs 或資料數量異常。');
    if(typeof doc.checksum!=='string'||!/^[a-f0-9]{8}$/i.test(doc.checksum))
      throw new Error('目標備份缺少可驗證的資料校驗碼。');
    const payload=stableSerialize(data);
    if(fnv1a(payload)!==doc.checksum.toLowerCase())throw new Error('目標備份完整性（checksum）驗證失敗。');
    if(doc.integrity){
      if(doc.integrity.algorithm!=='SHA-256'||doc.integrity.scope!=='dataPayload'||!/^[a-f0-9]{64}$/i.test(doc.integrity.digest||''))
        throw new Error('目標備份含未知的完整性簽章；拒絕讀取。');
      if(await sha256(payload)!==doc.integrity.digest.toLowerCase())throw new Error('目標備份 SHA-256 完整性驗證失敗。');
    }
    const tasks=new Map();
    for(const t of data.tasks){
      if(!t||typeof t.id!=='string'||tasks.has(t.id))throw new Error('備份中的目標 ID 重複或無效。');
      tasks.set(t.id,t);
    }
    // This is NOT a validated live database snapshot. It is reference material for preview only.
    return {source:'user-selected-backup',tasks,logs:data.logs,savedAt:typeof doc.savedAt==='string'?doc.savedAt:'',taskCount:data.tasks.length,logCount:data.logs.length};
  }
  function isCountable(log){return !!log&&log.actual!==false&&log.status!=='已刪除'&&log.kind!=='system'&&log.type!=='auto'&&Number(log.minutes)>0}
  function resolveTarget(session,snapshot){
    const taskId=String(session.suggestedGoalTaskId||'');
    const task=snapshot.tasks.get(taskId);
    if(!task||Number(task.level)!==4)return {reason:'目前目標備份找不到相應的 Level 4 行動；不可沿用過期的建議任務。'};
    if(task.status==='已封存'||!(Number(task.weeklyMinutes)>0))return {reason:'對應行動已封存或沒有有效每週投入設定。'};
    const parent=snapshot.tasks.get(String(task.parent||''));
    if(!parent||Number(parent.level)!==3||!isDate(parent.start)||!isDate(parent.due)||parent.start>parent.due)
      return {reason:'對應的 Level 3 子任務沒有有效期間。'};
    if(parent.status==='已封存'||session.date<parent.start||session.date>parent.due)
      return {reason:'學習日期不在目前子任務的有效期間內。'};
    const phase=snapshot.tasks.get(String(parent.parent||'')),direction=phase&&snapshot.tasks.get(String(phase.parent||''));
    if(!phase||Number(phase.level)!==2||phase.id!=='g3-2026-integrated'||phase.status==='已封存'||!direction||direction.id!=='g3'||Number(direction.level)!==1||direction.status==='已封存')
      return {reason:'目標階層與既有 TOEIC 整合準備計畫不符，請人工核對。'};
    if(!taskId.endsWith('-'+session.unit))return {reason:'訓練類別與目前 Level 4 目標不符。'};
    return {taskId,name:String(task.name||''),period:parent.start+' ～ '+parent.due};
  }
  function originRecordMatch(log,id){
    if(!log||typeof log!=='object')return false;
    return ['sourceEventId','eventId','sourceLearningEventId','externalEventId','sourceLegacyLogId'].some(k=>String(log[k]||'')===id)
      || String(log.id||'')==='toeic-import-'+id;
  }
  function analyzeOne(session,{nowMs,today,snapshot}){
    const problems=[],s=session&&typeof session==='object'?session:{};
    if(!RX_ID.test(String(s.id||'')))problems.push('事件 ID 格式不符');
    if(s.appId!==APP_ID||Number(s.schema)!==1)problems.push('來源或資料版本不符');
    if(!VALID_UNITS.has(s.unit))problems.push('不是閱讀、文法或單字複習事件');
    if(!MODES.has(s.mode)||Number(s.part)===2||Number(s.part)===3||Number(s.part)===4||
       list(s.questionIds).some(id=>/^p[234][-_]/i.test(String(id))))problems.push('舊版聽力或未知訓練型態不列入本次連結');
    if(!isDate(s.date)||s.date>today)problems.push('日期無效或在未來');
    if(!Number.isInteger(s.seconds)||s.seconds<60||s.seconds>MAX_DURATION)problems.push('實際專注需達 60 秒且不得超過 6 小時');
    if(!Number.isInteger(s.questionsAnswered)||s.questionsAnswered<1||s.questionsAnswered>200||
       !Number.isInteger(s.correct)||s.correct<0||s.correct>s.questionsAnswered)problems.push('練習／答題數據無效');
    if(!Array.isArray(s.questionIds)||s.questionIds.length!==s.questionsAnswered||
      s.questionIds.some(x=>typeof x!=='string'||x.length>90))problems.push('題目識別筆數與完成數量不一致');
    if(!isISO(s.createdAt))problems.push('缺少有效完成時間');
    else{
      const end=Date.parse(s.createdAt);
      if(end>nowMs+5*60000)problems.push('完成時間超過目前時間');
      if(isDate(s.date)&&dateKey(end)!==s.date)problems.push('完成時間與學習日期不一致');
      if(Number.isInteger(s.seconds)&&s.seconds>0&&isDate(s.date)&&dateKey(end-s.seconds*1000)!==s.date)
        problems.push('跨越臺灣日期邊界，需人工拆分時間');
    }
    if(s.goalImportStatus&&s.goalImportStatus!=='not-imported')problems.push('來源紀錄已有其他匯入狀態');
    if(problems.length)return {status:'excluded',reason:problems.join('；'),task:null};
    if(!snapshot)return {status:'review',reason:'本機資料合理；未提供目標備份，無法核對現有目標／補登紀錄。',task:null};
    const target=resolveTarget(s,snapshot);
    if(target.reason)return {status:'hold',reason:target.reason,task:null};
    if(snapshot.logs.some(log=>originRecordMatch(log,String(s.id))))
      return {status:'hold',reason:'目標歷史紀錄已有相同事件識別碼，禁止重複計入。',task:target};
    // A same-day goal-study log could already include some/all of this session.
    if(snapshot.logs.some(log=>isCountable(log)&&String(log.taskId)===target.taskId&&dateKey(log.time)===s.date))
      return {status:'hold',reason:'同一 Level 4 行動當日已有投入紀錄，無法排除與手動補登重疊。',task:target};
    return {status:'candidate',reason:'與所選目標備份沒有發現識別碼或同日任務衝突；仍非可直接匯入。',task:target};
  }
  function preview(sessions,{snapshot=null,now=new Date()}={}){
    const nowMs=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(nowMs))throw new Error('檢查時間無效');
    const today=dateKey(nowMs),items=list(sessions).slice(0,2000);
    const count=new Map();
    for(const s of items){const id=String(s?.id||'');count.set(id,(count.get(id)||0)+1)}
    const rows=items.map((s,index)=>{
      const x=analyzeOne(s,{nowMs,today,snapshot});
      if(count.get(String(s?.id||''))>1)return {index,session:s,status:'excluded',reason:'訓練端出現重複事件 ID，必須先檢查來源紀錄。',task:null};
      return {index,session:s,...x};
    });
    const candidate=rows.filter(r=>r.status==='review'||r.status==='candidate');
    // Approximate overlapping clock intervals: conservatively hold both, never double count.
    for(let i=0;i<candidate.length;i++){
      const a=candidate[i],as=Date.parse(a.session.createdAt),ab=as-a.session.seconds*1000;
      for(let j=i+1;j<candidate.length;j++){
        const b=candidate[j],bs=Date.parse(b.session.createdAt),bb=bs-b.session.seconds*1000;
        if(ab<bs&&bb<as){
          for(const x of [a,b]){x.status='hold';x.reason='兩筆 Session 的推估練習時間可能重疊，需人工核對；不能同時計入。'}
        }
      }
    }
    const selectable=rows.filter(r=>r.status==='review'||r.status==='candidate');
    return {rows,counts:{total:rows.length,review:rows.filter(x=>x.status==='review').length,
      candidate:rows.filter(x=>x.status==='candidate').length,hold:rows.filter(x=>x.status==='hold').length,
      excluded:rows.filter(x=>x.status==='excluded').length,selectable:selectable.length},
      totalCreditableMinutes:selectable.reduce((a,r)=>a+localMinutes(r.session.seconds),0),
      snapshotChecked:!!snapshot};
  }
  function buildPacket(report,ids,{exportedAt=new Date().toISOString()}={}){
    if(!report||!Array.isArray(report.rows)||!(ids instanceof Set))throw new Error('請先完成事件預覽。');
    if(!isISO(exportedAt))throw new Error('匯出日期無效');
    const selected=report.rows.filter(x=>ids.has(x.session?.id)&&['review','candidate'].includes(x.status));
    if(!selected.length)throw new Error('請先勾選至少一筆通過訓練端初步檢查的紀錄。');
    if(selected.length!==ids.size)throw new Error('部分勾選事件已不符合核對條件，請重新整理預覽。');
    return {format:FORMAT,version:1,exportedAt,goalManagerImportReady:false,manualReviewOnly:true,
      snapshotChecked:report.snapshotChecked,
      policy:'READ_ONLY_REVIEW_NO_GOAL_MANAGER_WRITES',
      creditedMinutesPolicy:'floor(actualSeconds/60); sum by unique session; recompute on target import',
      events:selected.map(({session:s})=>({
        eventId:s.id,sourceApp:APP_ID,schema:1,date:s.date,learningUnit:s.unit,
        actualSeconds:s.seconds,minutes:Math.round(s.seconds/60*100)/100,
        creditedMinutes:localMinutes(s.seconds),questionsAnswered:s.questionsAnswered,
        correct:s.correct,accuracy:Math.round(s.correct*100/s.questionsAnswered),
        suggestedTaskId:s.suggestedGoalTaskId||null,createdAt:s.createdAt
      }))};
  }
  return Object.freeze({APP_ID,FORMAT,MAX_DURATION,dateKey,isDate,fnv1a,stableSerialize,readGoalSnapshot,
    preview,buildPacket,resolveTarget,localMinutes});
});
