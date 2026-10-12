/* Goal Manager V98.13.6: pure TOEIC Trainer v0.5 session reconciliation.
 * No DOM, browser storage, timer, network, or mutation of input arrays.
 * This is NOT the retired News x TOEIC synchronization code.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GoalToeicSyncPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TRAINER_KEY='toeic-trainer-v01:learning-state';
  const CONSENT_KEY='toeic-trainer:v051-link-settings';
  const STATUS_KEY='goal-manager:toeic-sync-status-v1';
  const TRAINER_APP='toeic-trainer-standalone';
  const ID_RX=/^tt-[a-z0-9-]{8,70}$/i;
  const UNITS=new Set(['article','practice','review','mock']);
  const MODES=new Set(['reading','guided-reading','grammar','mixed','mistakes','vocabulary','passage','official-reading-mock']);
  const MAX_SESSIONS=2000;
  const MAX_SECONDS=6*3600;
  const toList=a=>Array.isArray(a)?a:[];
  function dateKey(input){
    const d=input instanceof Date?input:new Date(input);
    if(!Number.isFinite(d.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=type=>parts.find(p=>p.type===type)?.value||'';
    return [get('year'),get('month'),get('day')].join('-');
  }
  function validDate(s){
    if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;
    const time=Date.parse(s+'T12:00:00+08:00');
    return Number.isFinite(time)&&dateKey(time)===s;
  }
  function validISO(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));}
  function stamp(s){return validISO(s)?Date.parse(s):NaN}
  function matchExisting(l,sid){
    return String(l?.sourceEventId||'')===sid||String(l?.id||'')==='toeic-sync-'+sid;
  }
  function countable(l){return !!l&&l.actual!==false&&l.status!=='已刪除'&&l.kind!=='system'&&l.type!=='auto'&&Number(l.minutes)>0}
  function sameDayConflict(log,session,targetId,start,end){
    if(!countable(log)||String(log.taskId)!==targetId)return null;
    const logDay=dateKey(log.time);
    if(!logDay)return '既有學習紀錄缺少可判斷的日期，暫緩入帳';
    if(logDay!==session.date)return null;
    if(log.source==='toeic-trainer-v05'&&validISO(log.sourceStartedAt)&&validISO(log.sourceCompletedAt)){
      const a=stamp(log.sourceStartedAt),b=stamp(log.sourceCompletedAt);
      if(a<end&&start<b)return '與既有自動連動的專注時間重疊';
      return null;
    }
    return '同一目標同一天已有手動或其他來源的學習紀錄，無法排除時間重疊';
  }
  function overlap(a,b){return a.start<b.end&&b.start<a.end}
  function validateSession(s,{enabledAt,now,questionIdsRequired=true}={}){
    const errs=[];
    if(!s||typeof s!=='object'||Array.isArray(s))return {errors:['Session 不是物件']};
    if(!ID_RX.test(String(s.id||'')))errs.push('事件 ID 格式不符');
    if(s.appId!==TRAINER_APP||Number(s.schema)!==1)errs.push('學習程式來源或 Schema 不符');
    if(!UNITS.has(s.unit)||!MODES.has(s.mode))errs.push('不是支援的書面／單字訓練');
    if([2,3,4].includes(Number(s.part))||toList(s.questionIds).some(id=>/^p[234][-_]/i.test(String(id))))errs.push('不得匯入聽力');
    if(!validDate(s.date))errs.push('學習日期格式不符');
    if(!Number.isInteger(s.seconds)||s.seconds<60||s.seconds>MAX_SECONDS)errs.push('實際秒數未達 60 秒或超過 6 小時');
    if(!Number.isInteger(s.questionsAnswered)||s.questionsAnswered<1||s.questionsAnswered>200||!Number.isInteger(s.correct)||s.correct<0||s.correct>s.questionsAnswered)errs.push('作答數據不符');
    if(questionIdsRequired&&(!Array.isArray(s.questionIds)||s.questionIds.length!==s.questionsAnswered||s.questionIds.some(id=>typeof id!=='string'||id.length>90)))errs.push('題號數量或格式不符');
    if(s.goalImportStatus&&s.goalImportStatus!=='not-imported')errs.push('已有另一匯入狀態');
    const end=stamp(s.createdAt),start=end-Number(s.seconds)*1000;
    if(!Number.isFinite(end)||!Number.isFinite(start))errs.push('沒有有效完成時間');
    else{
      if(end>now+300000)errs.push('完成時間在未來');
      if(Number.isFinite(enabledAt)&&end<=enabledAt)errs.push('啟用連動之前的歷史事件不自動補登');
      if(validDate(s.date)&&(dateKey(end)!==s.date||dateKey(start)!==s.date))errs.push('跨日期或完成日期不同，需人工處理');
    }
    return {errors:errs,start,end};
  }
  function targetFor(s,tasks){
    const id=String(s.suggestedGoalTaskId||'');
    const byId=new Map(toList(tasks).map(t=>[String(t?.id||''),t]));
    const task=byId.get(id);
    if(!task||Number(task.level)!==4||task.status==='已封存'||!(Number(task.weeklyMinutes)>0))return {hold:'Level 4 目標不存在、已封存或無有效每週分鐘'};
    const parent=byId.get(String(task.parent||'')),phase=byId.get(String(parent?.parent||'')),direction=byId.get(String(phase?.parent||''));
    if(!parent||Number(parent.level)!==3||parent.status==='已封存'||!validDate(parent.start)||!validDate(parent.due)||parent.start>parent.due||s.date<parent.start||s.date>parent.due)return {hold:'不在 Level 3 子任務有效期間'};
    if(!phase||Number(phase.level)!==2||phase.id!=='g3-2026-integrated'||phase.status==='已封存'||!direction||Number(direction.level)!==1||direction.id!=='toeic-direction-2026'||direction.status==='已封存')return {hold:'不符合既有 TOEIC 四級目標結構'};
    // Recreate the built-in TOEIC plan routing, including a mock fallback to
    // practice before December. Never trust arbitrary unvalidated task IDs.
    const prefixes=[['2026-10-01','2026-11-01','g3-2026-10',['article','review','practice']],['2026-11-02','2026-11-29','g3-2026-11',['article','review','practice']],['2026-11-30','2026-12-19','g3-2026-12',['review','practice','mock']]];
    const rule=prefixes.find(([start,end])=>s.date>=start&&s.date<=end);
    if(!rule)return {hold:'未找到可對應的 TOEIC 整合計畫期間'};
    const desired=rule[3].includes(s.unit)?s.unit:rule[3].includes('practice')?'practice':'review';
    if(id!==rule[2]+'-'+desired||parent.id!==rule[2])return {hold:'事件建議目標與目前月份／學習類型不一致'};
    return {taskId:id,taskName:String(task.name||'')};
  }
  function reconcile(rawTrainer,rawConsent,{tasks=[],logs=[],now=new Date()}={}){
    const result={total:0,eligible:[],already:[],held:[],excluded:[],consent:false,blocked:''};
    const time=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(time)){result.blocked='無效的核對時間';return result}
    const consent=rawConsent&&typeof rawConsent==='object'&&!Array.isArray(rawConsent)?rawConsent:{};
    if(consent.enabled!==true||consent.version!==1||!validISO(consent.enabledAt)){result.blocked='尚未由訓練端啟用自動連動';return result}
    const enabledAt=stamp(consent.enabledAt);
    if(enabledAt>time+300000){result.blocked='啟用時間異常';return result}
    result.consent=true;
    const trainer=rawTrainer&&typeof rawTrainer==='object'&&!Array.isArray(rawTrainer)?rawTrainer:{};
    if(trainer.appId!==TRAINER_APP||Number(trainer.schema)!==1||!Array.isArray(trainer.sessions)||trainer.sessions.length>MAX_SESSIONS){result.blocked='訓練資料來源、結構或容量無效';return result}
    const occurrences=new Map();
    trainer.sessions.forEach(s=>occurrences.set(String(s?.id||''),(occurrences.get(String(s?.id||''))||0)+1));
    const previous=toList(logs);
    const accepted=[];
    // Reject *both* submissions when their inferred study intervals overlap.
    // A previously recorded event can never prove which overlap was genuine.
    const validIntervals=trainer.sessions.map(s=>{
      const v=validateSession(s,{enabledAt,now:time});
      return v.errors.length?null:{id:String(s.id),start:v.start,end:v.end};
    });
    const collisions=new Set();
    for(let i=0;i<validIntervals.length;i++){
      if(!validIntervals[i])continue;
      for(let j=i+1;j<validIntervals.length;j++){
        if(validIntervals[j]&&overlap(validIntervals[i],validIntervals[j])){
          collisions.add(validIntervals[i].id);collisions.add(validIntervals[j].id);
        }
      }
    }
    for(const s of trainer.sessions){
      result.total++;
      const id=String(s?.id||'');
      const v=validateSession(s,{enabledAt,now:time});
      if(occurrences.get(id)>1){result.excluded.push({id,reason:'重複 Session ID'});continue}
      if(v.errors.length){result.excluded.push({id,reason:v.errors.join('；')});continue}
      if(collisions.has(id)){result.held.push({id,reason:'Session 專注區間與另一筆紀錄重疊，需先人工核對'});continue}
      const target=targetFor(s,tasks);
      if(target.hold){result.held.push({id,reason:target.hold});continue}
      if(previous.some(log=>matchExisting(log,id))){result.already.push({id});continue}
      const conflict=[...previous,...accepted.map(x=>x.log)].map(l=>sameDayConflict(l,s,target.taskId,v.start,v.end)).find(Boolean);
      if(conflict){result.held.push({id,reason:conflict});continue}
      if(accepted.some(x=>overlap(x,s))){result.held.push({id,reason:'與另一筆待入帳事件的練習時間重疊'});continue}
      const minutes=Math.floor(s.seconds/60);
      const log={id:'toeic-sync-'+id,taskId:target.taskId,name:target.taskName,time:new Date(v.end).toISOString(),minutes,
        kind:'goal-study',type:'toeic-trainer',actual:true,source:'toeic-trainer-v05',sourceEventId:id,
        sourceStartedAt:new Date(v.start).toISOString(),sourceCompletedAt:new Date(v.end).toISOString(),
        sourceLearningUnit:s.unit,sourceAnswered:s.questionsAnswered,sourceCorrect:s.correct};
      accepted.push({id,taskId:target.taskId,start:v.start,end:v.end,log});
    }
    result.eligible=accepted;
    return result;
  }
  return Object.freeze({TRAINER_KEY,CONSENT_KEY,STATUS_KEY,TRAINER_APP,MAX_SESSIONS,dateKey,validISO,validDate,validateSession,targetFor,reconcile});
});
