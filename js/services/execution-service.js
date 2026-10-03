/* Execution service: plan orchestration without DOM or storage access. */
(function(root,factory){
  const execution=typeof module==='object'&&module.exports
    ?require('../domain/execution.js')
    :root.ExecutionDomain;
  const api=factory(execution);

  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ExecutionService=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(ExecutionDomain){
  'use strict';

  if(!ExecutionDomain)throw new Error('ExecutionService requires ExecutionDomain');

  function list(value){return Array.isArray(value)?value:[]}

  function createPlan({id,task,date,time,minutes,nowIso}){
    if(!task?.id)throw new Error('task is required');
    if(!date||!time)throw new Error('date and time are required');

    const planned=Math.max(1,Math.round(+minutes||0));

    return {
      id:String(id),
      taskId:String(task.id),
      name:String(task.name||'未命名行動'),
      date:String(date),
      time:String(time),
      minutes:planned,
      status:'待執行',
      createdAt:String(nowIso||'')
    };
  }

  function cancelPlan(plan,nowIso){
    if(!plan)return null;
    if(plan.status==='已完成'||plan.status==='已取消')return {...plan};

    return {
      ...plan,
      status:'已取消',
      cancelledAt:String(nowIso||'')
    };
  }

  function applyActualMinutes(plan,minutes,nowIso){
    if(!plan)return null;
    if(plan.status==='已取消')return {...plan};

    const planned=Math.max(1,+plan.minutes||0);
    const previous=Math.max(0,+plan.actualMinutes||0);
    const total=previous+Math.max(0,+minutes||0);
    const done=total>=planned;

    const next={
      ...plan,
      actualMinutes:total,
      status:done?'已完成':'已部分完成'
    };

    if(done)next.completedAt=String(nowIso||plan.completedAt||'');
    else delete next.completedAt;

    return next;
  }

  function findActivePlanForDate(plans,taskId,date){
    return list(plans).find(plan=>
      String(plan?.taskId)===String(taskId)&&
      plan?.date===date&&
      ExecutionDomain.activeExecutionPlan(plan)
    )||null;
  }

  return Object.freeze({
    createPlan,
    cancelPlan,
    applyActualMinutes,
    findActivePlanForDate
  });
});
