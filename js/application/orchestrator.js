/* Application render orchestration. No DOM or storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AppOrchestrator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function call(fn){
    if(typeof fn==='function')fn();
  }

  function renderAll(steps={}){
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

    order.forEach(name=>call(steps[name]));
    return order;
  }

  return Object.freeze({
    renderAll
  });
});
