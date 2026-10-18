/* TOEIC result-first Level 4 goals. Read-only join of already-credited logs to
 * independent TOEIC Trainer sessions. No storage writes and no speculative mastery.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicOutcomeDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ROOT='g3-2026-integrated';
 const RULES=Object.freeze({
  'g3-2026-10-review':{parent:'g3-2026-10',kind:'review',goal:15,old:['短時間複習'],name:'錯題鞏固'},
  'g3-2026-10-practice':{parent:'g3-2026-10',kind:'practice',goal:20,old:['題目＋檢討'],name:'題目練習與訂正'},
  'g3-2026-11-review':{parent:'g3-2026-11',kind:'review',goal:15,old:['短時間複習'],name:'錯題鞏固'},
  'g3-2026-11-practice':{parent:'g3-2026-11',kind:'practice',goal:30,old:['題目＋檢討'],name:'題目練習與訂正'},
  'g3-2026-12-review':{parent:'g3-2026-12',kind:'review',goal:15,old:['弱點快速複習'],name:'錯題鞏固'},
  'g3-2026-12-practice':{parent:'g3-2026-12',kind:'practice',goal:30,old:['題目＋檢討'],name:'題目練習與訂正'}
 });
 function list(v){return Array.isArray(v)?v:[]}
 function isOutcomeTask(t){return !!t&&Number(t.level)===4&&t.progressMetric==='questions'&&
   Number.isInteger(Number(t.weeklyTargetCount))&&Number(t.weeklyTargetCount)>0&&!!RULES[String(t.id)];}
 function migrate(tasks){
  const rows=list(tasks),byId=new Map(rows.map(t=>[String(t.id),t]));
  const integrated=byId.get(ROOT),direction=byId.get('toeic-direction-2026');
  if(!integrated||integrated.parent!=='toeic-direction-2026'||direction?.level!==1||
     integrated.status==='已封存'||direction.status==='已封存')return {changed:false,leaves:0,reason:'no-valid-direction'};
  let changed=false,leaves=0;
  const snapshot=id=>{
    const t=byId.get(id);
    if(t&&!Object.prototype.hasOwnProperty.call(t,'previousTimeProgress')){
      t.previousTimeProgress=Math.max(0,Math.min(100,Number(t.progress)||0));
      changed=true;
    }
  };
  for(const [id,rule] of Object.entries(RULES)){
    const t=byId.get(id),parent=byId.get(rule.parent);
    if(!t||Number(t.level)!==4||t.parent!==rule.parent||t.status==='已封存'||
       !parent||Number(parent.level)!==3||parent.parent!==ROOT||parent.status==='已封存')continue;
    // Respect user overrides and never silently coerce unrelated metric settings.
    if(t.progressMetric&&t.progressMetric!=='questions')continue;
    if(t.progressMetric!=='questions'){
      snapshot(id);snapshot(rule.parent);snapshot(ROOT);snapshot(direction.id);
      t.progressMetric='questions';t.weeklyTargetCount=rule.goal;changed=true;leaves++;
    }
    if(rule.old.includes(t.name)){t.name=rule.name;changed=true;}
  }
  return {changed,leaves,reason:changed?'outcome-migrated':'already-current'};
 }
 function dateKey(value){
   const d=value instanceof Date?value:new Date(value);
   if(!Number.isFinite(d.getTime()))return '';
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
   const v=x=>parts.find(p=>p.type===x)?.value||'';
   return [v('year'),v('month'),v('day')].join('-');
 }
 function monday(day){
   const d=new Date(String(day)+'T12:00:00+08:00');
   if(!Number.isFinite(d.getTime()))return '';
   d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
   return dateKey(d);
 }
 function sunday(day){
   const d=new Date(monday(day)+'T12:00:00+08:00');
   if(!Number.isFinite(d.getTime()))return '';
   d.setUTCDate(d.getUTCDate()+6);return dateKey(d);
 }
 function sessionIndex(trainer){
   if(!trainer||trainer.appId!=='toeic-trainer-standalone'||Number(trainer.schema)!==1||
      !Array.isArray(trainer.sessions)||trainer.sessions.length>2000)return new Map();
   const seen=new Set(),bad=new Set(),result=new Map();
   for(const event of trainer.sessions){
     const id=String(event?.id||'');
     if(!/^tt-[a-z0-9-]{8,70}$/i.test(id))continue;
     if(seen.has(id)){bad.add(id);result.delete(id);continue;}
     seen.add(id);
     if(event.appId===trainer.appId&&Number(event.schema)===1&&
       Array.isArray(event.questionIds)&&event.questionIds.length===Number(event.questionsAnswered)&&
       event.questionIds.length<=200&&event.questionIds.every(x=>typeof x==='string'&&x.length<=90)&&
       Number.isInteger(event.correct)&&event.correct>=0&&event.correct<=event.questionsAnswered){
       result.set(id,event);
     }
   }
   for(const id of bad)result.delete(id);
   return result;
 }

 const CATALOG_KEY='toeic-trainer:review-catalog-v1';
 const VALID_CATALOG_ID=/^[a-z0-9_-]{1,90}$/i;
 function catalogSignature(writtenIds,vocabIds){
   const data=writtenIds.join('\n')+'\n#\n'+vocabIds.join('\n');
   let h=2166136261;
   for(let i=0;i<data.length;i++){h^=data.charCodeAt(i);h=Math.imul(h,16777619)}
   return (h>>>0).toString(16).padStart(8,'0');
 }
 function reviewCatalogIds(catalog){
   if(!catalog||catalog.source!=='toeic-trainer-standalone'||catalog.schema!==1||
      catalog.version!==1||catalog.kind!=='active-audited-bank-ids')return null;
   const {writtenIds,writtenCount,vocabIds,vocabCount}=catalog;
   const good=ids=>Array.isArray(ids)&&ids.length>0&&ids.length<=1500&&
      ids.every(x=>typeof x==='string'&&VALID_CATALOG_ID.test(x))&&
      new Set(ids).size===ids.length&&ids.every((x,i)=>i===0||ids[i-1]<x);
   if(!good(writtenIds)||!good(vocabIds)||writtenCount!==writtenIds.length||
      vocabCount!==vocabIds.length||catalog.signature!==catalogSignature(writtenIds,vocabIds)||
      writtenIds.some(x=>vocabIds.includes(x)))return null;
   return {written:new Set(writtenIds),vocab:new Set(vocabIds)};
 }
 function validReviewCatalog(catalog){return !!reviewCatalogIds(catalog)}
 function pendingQueue(trainer,catalog,now=new Date()){
   const allowed=reviewCatalogIds(catalog);
   if(!allowed)return null; // Never show stale historical IDs as currently answerable.

   if(!trainer||trainer.appId!=='toeic-trainer-standalone'||Number(trainer.schema)!==1)return null;
   const time=now instanceof Date?now.getTime():new Date(now).getTime();
   if(!Number.isFinite(time))return null;
   const s=trainer.questionStats||{},v=trainer.review||{};
   const out={due:0,mastered:0,waiting:0,dueWords:0};
   for(const [id,rec] of Object.entries(s)){
     if(!allowed.written.has(id)||!rec||typeof rec!=='object'||!(Number(rec.wrong)>0))continue;
     if(rec.mastered===true){out.mastered++;continue;}
     const at=Date.parse(rec.dueAt||'');
     if(!Number.isFinite(at)||at<=time)out.due++;else out.waiting++;
   }
   for(const [id,rec] of Object.entries(v)){
     if(!allowed.vocab.has(id)||!rec||typeof rec!=='object'||!rec.dueAt||!(Number(rec.times)>0))continue;
     const at=Date.parse(rec.dueAt);
     if(Number.isFinite(at)&&at<=time)out.dueWords++;
   }
   return out;
 }
 function summary(tasks,logs,task,day,trainer){
   const rule=RULES[String(task?.id||'')],target=isOutcomeTask(task)?Number(task.weeklyTargetCount):0;
   const parent=list(tasks).find(x=>x.id===task?.parent),start=monday(day),end=sunday(day);
   const active=!!rule&&!!parent&&!!start&&!!end&&parent.start&&parent.due&&
     start<=parent.due&&end>=parent.start&&parent.status!=='已封存'&&task.status!=='已封存';
   const result={target,done:0,remaining:active?target:0,accuracy:null,actualAnswered:0,
     reviewAnswered:0,reviewCorrect:0,masteredThisWeek:0,
     evidenceMissing:0,active:!!active,kind:rule?.kind||'',unit:'題'};
   if(!active||!target)return result;
   const index=sessionIndex(trainer),ids=new Set(),events=new Set();
   let answered=0,correct=0,dueAttempts=0,dueCorrect=0;
   const masteredThisWeek=new Set();
   for(const log of list(logs)){
     if(log?.status==='已刪除'||log?.actual!==true||log?.source!=='toeic-trainer-v05'||
       String(log.taskId)!==String(task.id)||log.progressAlias===true)continue;
     const id=String(log.sourceEventId||'');
     if(events.has(id)||!id)continue;
     events.add(id);
     const e=index.get(id);
     if(!e||e.unit!==rule.kind||e.suggestedGoalTaskId!==task.id||
        e.date<start||e.date>end||e.date<parent.start||e.date>parent.due||
        String(log.sourceLearningUnit||'')!==e.unit||
        Number(log.sourceAnswered)!==e.questionsAnswered||Number(log.sourceCorrect)!==e.correct){
       result.evidenceMissing++;continue;
     }
     // Only real submitted sessions acknowledged by GM may generate progress.
     let items=e.questionIds;
     if(rule.kind==='review'){
       // Score ONLY original due items, never sibling variations/whole-paper accuracy.
       if(!Array.isArray(e.reviewDueIds)||!Array.isArray(e.reviewCorrectIds)){
         result.evidenceMissing++;continue;
       }
       const allowed=new Set(e.questionIds);
       const masteredRows=e.reviewMasteredIds===undefined?[]:e.reviewMasteredIds;
       if(!Array.isArray(masteredRows)){result.evidenceMissing++;continue;}
       const due=new Set(e.reviewDueIds),right=new Set(e.reviewCorrectIds);
       const mastered=new Set(masteredRows);
       if(due.size!==e.reviewDueIds.length||right.size!==e.reviewCorrectIds.length||
          ![...due].every(id=>allowed.has(id))||
          ![...right].every(id=>due.has(id))||
          mastered.size!==masteredRows.length||
          ![...mastered].every(id=>right.has(id))){
         result.evidenceMissing++;continue;
       }
       items=[...due];
       dueAttempts+=due.size;dueCorrect+=right.size;
       for(const id of mastered)masteredThisWeek.add(id);
     }
     for(const qid of items){if(!ids.has(qid))ids.add(qid);}
     answered+=e.questionsAnswered;correct+=e.correct;
   }
   result.done=ids.size;result.remaining=Math.max(0,target-ids.size);
   result.reviewAnswered=dueAttempts;result.reviewCorrect=dueCorrect;
   result.masteredThisWeek=masteredThisWeek.size;
   result.accuracy=rule.kind==='review'
     ?(dueAttempts?Math.round(dueCorrect*100/dueAttempts):null)
     :(answered?Math.round(correct*100/answered):null);
   result.actualAnswered=answered;
   return result;
 }
 function leafProgress(tasks,logs,task,trainer){
   if(!isOutcomeTask(task))return null;
   const parent=list(tasks).find(x=>x.id===task.parent);
   if(!parent?.start||!parent?.due||parent.start>parent.due)return 0;
   const target=Number(task.weeklyTargetCount);
   let start=monday(parent.start),value=0,weeks=0;
   while(start&&start<=parent.due&&weeks<120){
     const s=summary(tasks,logs,task,start,trainer);
     value+=Math.min(target,s.done);weeks++;
     const d=new Date(start+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+7);start=dateKey(d);
   }
   return weeks?Math.max(0,Math.min(100,Math.round(value/(weeks*target)*100))):0;
 }
 return Object.freeze({RULES,CATALOG_KEY,catalogSignature,validReviewCatalog,isOutcomeTask,migrate,dateKey,monday,sunday,pendingQueue,summary,leafProgress});
});
