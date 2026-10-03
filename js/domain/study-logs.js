/* Study log domain: classification, normalization and aggregation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.StudyLogDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const KIND=Object.freeze({
    GOAL:'goal-study',
    OTHER:'other-study',
    SYSTEM:'system'
  });

  function list(value){return Array.isArray(value)?value:[]}

  function normalizeLog(log){
    if(!log||typeof log!=='object')return null;
    const out={...log};

    if(out.kind===KIND.OTHER)out.kind=KIND.OTHER;
    else if(out.kind===KIND.SYSTEM||out.type==='auto')out.kind=KIND.SYSTEM;
    else out.kind=KIND.GOAL;

    out.minutes=Math.max(0,Number.isFinite(+out.minutes)?+out.minutes:0);

    if(out.taskId!==null&&out.taskId!==undefined){
      out.taskId=String(out.taskId);
    }

    if(out.kind===KIND.SYSTEM)out.actual=false;
    else if(out.actual===undefined)out.actual=true;

    return out;
  }

  function logDate(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function isCountableActualLog(log){
    return !!log&&
      log.actual!==false&&
      log.status!=='已刪除'&&
      log.kind!==KIND.SYSTEM&&
      log.type!=='auto';
  }

  function isOtherStudyLog(log){
    return !!log&&log.kind===KIND.OTHER;
  }

  function taskExists(tasks,id){
    return list(tasks).some(t=>String(t?.id)===String(id));
  }

  function isGoalActualLog(log,tasks){
    return isCountableActualLog(log)&&
      !isOtherStudyLog(log)&&
      taskExists(tasks,log?.taskId);
  }

  function countableLogs(logs){
    return list(logs).filter(isCountableActualLog);
  }

  function inDateRange(log,start,end){
    const day=logDate(log?.time);
    return !!day&&day>=start&&day<=end;
  }

  function sumMinutes(logs){
    return list(logs).reduce(
      (sum,log)=>sum+Math.max(0,+log?.minutes||0),
      0
    );
  }

  function otherStudyMinutesInRange(logs,start,end){
    return sumMinutes(
      list(logs).filter(log=>
        isCountableActualLog(log)&&
        isOtherStudyLog(log)&&
        inDateRange(log,start,end)
      )
    );
  }

  function goalStudyMinutesInRange(logs,tasks,start,end,taskId=null){
    return sumMinutes(
      list(logs).filter(log=>{
        if(!isGoalActualLog(log,tasks)||!inDateRange(log,start,end))return false;
        return taskId===null||
          taskId===undefined||
          String(log.taskId)===String(taskId);
      })
    );
  }

  function totalStudyMinutesInRange(logs,start,end){
    return sumMinutes(
      list(logs).filter(log=>
        isCountableActualLog(log)&&inDateRange(log,start,end)
      )
    );
  }

  return Object.freeze({
    KIND,
    normalizeLog,
    logDate,
    isCountableActualLog,
    isOtherStudyLog,
    isGoalActualLog,
    countableLogs,
    inDateRange,
    sumMinutes,
    otherStudyMinutesInRange,
    goalStudyMinutesInRange,
    totalStudyMinutesInRange
  });
});
