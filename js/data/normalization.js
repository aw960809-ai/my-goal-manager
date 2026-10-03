/* Data normalization: pure canonicalization of persisted core records. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DataNormalization=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function normalizeTask(task){
    const t=task&&typeof task==='object'?task:{};
    const level=Math.max(1,Math.min(4,+t.level||1));
    let weekly=0;

    if(level===4){
      if(Number.isFinite(+t.weeklyMinutes)){
        weekly=Math.max(0,+t.weeklyMinutes||0);
      }else{
        const mins=Math.max(0,+t.minutes||0);
        const mode=t.mode;
        const cycle=t.cycle;

        if(mode==='single'||cycle==='單次')weekly=mins;
        else if(cycle==='日')weekly=mins*7;
        else if(cycle==='月')weekly=Math.round(mins/4.345);
        else weekly=mins;
      }
    }

    return {
      id:String(t.id),
      name:String(t.name||'未命名目標'),
      level,
      parent:t.parent?String(t.parent):null,
      status:['未開始','進行中','已完成','已封存'].includes(t.status)
        ?t.status
        :'未開始',
      weeklyMinutes:weekly,
      start:level===3?(t.start||''):'',
      due:level===3?(t.due||''):'',
      progress:Math.max(0,Math.min(100,+t.progress||0))
    };
  }

  function normalizeTasks(tasks){
    return (Array.isArray(tasks)?tasks:[]).map(normalizeTask);
  }

  function normalizeWeekReviews(value){
    return (Array.isArray(value)?value:[])
      .filter(x=>x&&x.weekStart&&x.taskId&&x.reason);
  }

  return Object.freeze({
    normalizeTask,
    normalizeTasks,
    normalizeWeekReviews
  });
});
