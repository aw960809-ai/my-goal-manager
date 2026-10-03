/* TOEIC 2026 Q4 integrated learning plan: pure task/routing/progress policy. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicPlanDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ROOT_ID='g3-2026-integrated';
  const UNITS=Object.freeze({
    ARTICLE:'article',
    REVIEW:'review',
    PRACTICE:'practice',
    MOCK:'mock'
  });

  const PHASES=Object.freeze([
    Object.freeze({
      id:'g3-2026-10',
      name:'10 月｜低負擔整合學習',
      start:'2026-10-01',
      due:'2026-11-01',
      units:Object.freeze([
        Object.freeze({id:'g3-2026-10-article',unit:UNITS.ARTICLE,name:'新聞／文章整合',weeklyMinutes:40}),
        Object.freeze({id:'g3-2026-10-review',unit:UNITS.REVIEW,name:'短時間複習',weeklyMinutes:30}),
        Object.freeze({id:'g3-2026-10-practice',unit:UNITS.PRACTICE,name:'題目＋檢討',weeklyMinutes:30})
      ])
    }),
    Object.freeze({
      id:'g3-2026-11',
      name:'11 月｜題目應用',
      start:'2026-11-02',
      due:'2026-11-29',
      units:Object.freeze([
        Object.freeze({id:'g3-2026-11-article',unit:UNITS.ARTICLE,name:'新聞／文章整合',weeklyMinutes:30}),
        Object.freeze({id:'g3-2026-11-review',unit:UNITS.REVIEW,name:'短時間複習',weeklyMinutes:30}),
        Object.freeze({id:'g3-2026-11-practice',unit:UNITS.PRACTICE,name:'題目＋檢討',weeklyMinutes:60})
      ])
    }),
    Object.freeze({
      id:'g3-2026-12',
      name:'12 月｜考前整合',
      start:'2026-11-30',
      due:'2026-12-19',
      units:Object.freeze([
        Object.freeze({id:'g3-2026-12-review',unit:UNITS.REVIEW,name:'弱點快速複習',weeklyMinutes:30}),
        Object.freeze({id:'g3-2026-12-practice',unit:UNITS.PRACTICE,name:'題目＋檢討',weeklyMinutes:60}),
        Object.freeze({id:'g3-2026-12-mock',unit:UNITS.MOCK,name:'模考／考試適應',weeklyMinutes:60})
      ])
    })
  ]);

  // Legacy preparation branches only. The official 12/20 exam branch (g3-6) remains active.
  const LEGACY_IDS=Object.freeze([
    'g3-1','g3-1-1','g3-1-1-1','g3-1-1-2',
    'g3-2','g3-2-1','g3-2-1-1','g3-2-1-2','g3-2-2','g3-2-2-1','g3-2-2-2',
    'g3-3','g3-3-1','g3-3-1-1','g3-3-1-2',
    'g3-4','g3-4-1','g3-4-1-1','g3-4-1-2','g3-4-1-3',
    'g3-5','g3-5-1','g3-5-1-1','g3-5-1-2','g3-5-1-3'
  ]);

  function list(value){return Array.isArray(value)?value:[]}
  function getTask(tasks,id){return list(tasks).find(t=>String(t?.id)===String(id))||null}

  function taskSpecs(){
    const specs=[{
      id:ROOT_ID,
      name:'TOEIC｜10–12 月整合準備',
      level:2,
      parent:'g3',
      weeklyMinutes:0,
      start:'',
      due:''
    }];

    PHASES.forEach(phase=>{
      specs.push({
        id:phase.id,
        name:phase.name,
        level:3,
        parent:ROOT_ID,
        weeklyMinutes:0,
        start:phase.start,
        due:phase.due
      });
      phase.units.forEach(unit=>{
        specs.push({
          id:unit.id,
          name:unit.name,
          level:4,
          parent:phase.id,
          weeklyMinutes:unit.weeklyMinutes,
          start:'',
          due:''
        });
      });
    });

    return specs;
  }

  function apply(tasks){
    const rows=list(tasks);
    if(!getTask(rows,'g3')){
      return {applied:false,reason:'language-root-missing',added:0,repaired:0,archived:0};
    }

    let changed=false,added=0,repaired=0,archived=0;
    const set=(task,key,value)=>{
      if(task[key]!==value){task[key]=value;changed=true;return true}
      return false;
    };

    taskSpecs().forEach(spec=>{
      let task=getTask(rows,spec.id);
      if(!task){
        task={...spec,status:'未開始',progress:0};
        rows.push(task);changed=true;added++;return;
      }
      let touched=false;
      touched=set(task,'name',spec.name)||touched;
      touched=set(task,'level',spec.level)||touched;
      touched=set(task,'parent',spec.parent)||touched;
      touched=set(task,'weeklyMinutes',spec.weeklyMinutes)||touched;
      touched=set(task,'start',spec.start)||touched;
      touched=set(task,'due',spec.due)||touched;
      if(touched)repaired++;
    });

    const archiveIds=new Set(LEGACY_IDS);
    let expanded=true;
    while(expanded){
      expanded=false;
      rows.forEach(task=>{
        if(task?.parent&&archiveIds.has(String(task.parent))&&!archiveIds.has(String(task.id))){
          archiveIds.add(String(task.id));expanded=true;
        }
      });
    }

    archiveIds.forEach(id=>{
      const task=getTask(rows,id);
      if(task&&task.status!=='已封存'){task.status='已封存';changed=true;archived++}
    });

    return {
      applied:changed,
      reason:changed?'integrated-plan-applied':'already-current',
      added,repaired,archived,
      weeklyTargets:PHASES.map(phase=>({
        phaseId:phase.id,
        minutes:phase.units.reduce((sum,unit)=>sum+unit.weeklyMinutes,0)
      }))
    };
  }

  function phaseForDate(date){
    const day=String(date||'').slice(0,10);
    return PHASES.find(phase=>day>=phase.start&&day<=phase.due)||null;
  }

  function localDateKey(value){
    const raw=String(value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function normalizeUnit(value){
    const unit=String(value||'').toLowerCase();
    return Object.values(UNITS).includes(unit)?unit:UNITS.PRACTICE;
  }

  function inferUnit(record){
    const row=record&&typeof record==='object'?record:{};
    const explicit=String(row.learningUnit||row.sourceLearningUnit||'').toLowerCase();
    if(Object.values(UNITS).includes(explicit))return explicit;
    const title=String(row.articleTitle||row.sourceArticleTitle||row.name||'');
    const activity=String(row.activity||row.sourceActivity||'');
    const eventId=String(row.eventId||row.sourceEventId||'');
    const taskId=String(row.taskId||'');
    if(/模考|mock/i.test(title)||taskId==='g3-5-1-1')return UNITS.MOCK;
    if(activity==='toeic-vocabulary-training'||eventId.startsWith('toeic-vocab-'))return UNITS.REVIEW;
    if(['g3-1-1-1','g3-1-1-2','g3-3-1-1','g3-3-1-2'].includes(taskId))return UNITS.REVIEW;
    if(Number(row.articlesCompleted||0)>0||String(row.articleId||row.sourceArticleId||''))return UNITS.ARTICLE;
    return UNITS.PRACTICE;
  }

  function targetTaskId(date,unit){
    const phase=phaseForDate(date);
    if(!phase)return null;
    const wanted=normalizeUnit(unit);
    const exact=phase.units.find(x=>x.unit===wanted);
    if(exact)return exact.id;
    const fallback=phase.units.find(x=>x.unit===UNITS.PRACTICE)||
      phase.units.find(x=>x.unit===UNITS.REVIEW)||phase.units[0];
    return fallback?.id||null;
  }

  function isManagedTask(tasks,taskOrId){
    let task=typeof taskOrId==='object'&&taskOrId?taskOrId:getTask(tasks,taskOrId);
    let guard=0;
    while(task&&guard++<12){
      if(String(task.id)===ROOT_ID)return true;
      task=task.parent?getTask(tasks,task.parent):null;
    }
    return false;
  }

  function plannedMinutes(tasks,taskOrId,activeWeekCount,seen=new Set()){
    const task=typeof taskOrId==='object'&&taskOrId?taskOrId:getTask(tasks,taskOrId);
    if(!task||task.status==='已封存'||seen.has(String(task.id)))return 0;
    seen.add(String(task.id));
    if(Number(task.level)===4){
      const weeks=typeof activeWeekCount==='function'?Math.max(0,Number(activeWeekCount(task))||0):1;
      return Math.max(0,Number(task.weeklyMinutes)||0)*weeks;
    }
    return list(tasks)
      .filter(x=>String(x?.parent)===String(task.id)&&x.status!=='已封存')
      .reduce((sum,child)=>sum+plannedMinutes(tasks,child,activeWeekCount,new Set(seen)),0);
  }

  function aggregateProgress(tasks,parent,childRows,activeWeekCount){
    if(!isManagedTask(tasks,parent))return null;
    const rows=list(childRows).filter(x=>x?.task&&x.task.status!=='已封存');
    if(!rows.length)return 0;
    const weighted=rows.map(row=>({
      progress:Math.max(0,Math.min(100,Number(row.progress)||0)),
      weight:plannedMinutes(tasks,row.task,activeWeekCount)
    }));
    const totalWeight=weighted.reduce((sum,row)=>sum+row.weight,0);
    if(totalWeight<=0)return Math.round(weighted.reduce((sum,row)=>sum+row.progress,0)/weighted.length);
    return Math.round(weighted.reduce((sum,row)=>sum+row.progress*row.weight,0)/totalWeight);
  }

  function isToeicHistoricalLog(tasks,log){
    if(!log||log.progressAlias===true||log.actual===false||!(Number(log.minutes)>0))return false;
    if(isManagedTask(tasks,log.taskId))return false;
    const source=String(log.source||'');
    const activity=String(log.sourceActivity||log.activity||'');
    const eventId=String(log.sourceEventId||log.eventId||'');
    if(source.includes('toeic')||activity.startsWith('toeic-')||eventId.startsWith('toeic-'))return true;
    return LEGACY_IDS.includes(String(log.taskId||''));
  }

  function progressAliases(tasks,logs){
    const rows=list(logs),existing=new Set(rows.map(x=>String(x?.id||''))),aliases=[];
    rows.forEach(log=>{
      if(!isToeicHistoricalLog(tasks,log))return;
      const sourceId=String(log.id||'').trim();if(!sourceId)return;
      const date=localDateKey(log.sourceDate||log.time),unit=inferUnit(log);
      const targetId=targetTaskId(date,unit),target=targetId?getTask(tasks,targetId):null;
      if(!target||target.status==='已封存')return;
      const aliasId=`toeic-plan-progress-${sourceId.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
      if(existing.has(aliasId))return;
      aliases.push({
        id:aliasId,taskId:target.id,name:target.name,time:log.time,
        minutes:Math.max(0,Number(log.minutes)||0),actual:false,type:'progress-alias',progressAlias:true,
        source:'toeic-plan-migration',sourceLegacyLogId:sourceId,sourceEventId:log.sourceEventId||'',
        sourceDate:log.sourceDate||date,sourceAllocationKey:log.sourceAllocationKey||'',sourceLearningUnit:unit
      });
      existing.add(aliasId);
    });
    return aliases;
  }

  return Object.freeze({
    ROOT_ID,UNITS,PHASES,LEGACY_IDS,taskSpecs,apply,phaseForDate,localDateKey,
    inferUnit,targetTaskId,isManagedTask,plannedMinutes,aggregateProgress,progressAliases
  });
});
