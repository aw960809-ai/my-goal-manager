/* Application render orchestration with per-step fault isolation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AppOrchestrator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function errorEntry(name,error){
    return {
      name,
      error,
      message:String(error?.message||error||'unknown error')
    };
  }

  function invoke(name,fn,errors,onError){
    if(typeof fn!=='function')return;
    try{
      fn();
    }catch(error){
      const entry=errorEntry(name,error);
      errors.push(entry);
      if(typeof onError==='function'){
        try{onError(entry)}catch(_){}
      }else if(typeof console!=='undefined'&&typeof console.error==='function'){
        console.error(`[GoalManager:${name}] render failed`,error);
      }
    }
  }

  function renderAll(steps={},options={}){
    const order=[
      'normalizeState',
      'rebuildExecutionPlanActuals',
      'removeLegacyStandaloneToeicGoals',
      'ensureActivities',
      'ensureToeicPlan',
      'recalcAllStatuses',
      'renderGoalsPage',
      'dashboard',
      'today',
      'renderTimerState',
      'renderActivities',
      'renderScholarships',
      'renderCalendar',
      'stats',
      'bindInteractionFeedback',
      'bindActivitySearch'
    ];

    const errors=[];
    order.forEach(name=>invoke(name,steps[name],errors,options.onError));

    return {
      order,
      errors,
      ok:errors.length===0
    };
  }

  return Object.freeze({renderAll});
});
