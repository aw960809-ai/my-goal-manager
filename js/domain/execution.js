/* Execution domain: weekly targets, actual minutes and execution-plan state. */
(function(root,factory){
  const goal=typeof module==='object'&&module.exports
    ?require('./goals.js')
    :root.GoalDomain;
  const study=typeof module==='object'&&module.exports
    ?require('./study-logs.js')
    :root.StudyLogDomain;
  const api=factory(goal,study);

  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ExecutionDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GoalDomain,StudyLogDomain){
  'use strict';

  if(!GoalDomain)throw new Error('ExecutionDomain requires GoalDomain');
  if(!StudyLogDomain)throw new Error('ExecutionDomain requires StudyLogDomain');

  function list(value){return Array.isArray(value)?value:[]}

  function dateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function weekStartKey(date){
    const d=new Date(String(date)+'T00:00:00');
    d.setDate(d.getDate()-d.getDay()+(d.getDay()===0?-6:1));
    return dateKey(d);
  }

  function weekEndKey(date){
    const d=new Date(weekStartKey(date)+'T00:00:00');
    d.setDate(d.getDate()+6);
    return dateKey(d);
  }

  function inPeriod(date,period){
    return !!(
      date&&period?.start&&period?.due&&
      date>=period.start&&date<=period.due
    );
  }

  function activeWeekCount(tasks,task){
    const p=GoalDomain.periodForTask(tasks,task);
    if(!p?.start||!p?.due)return 0;

    let d=new Date(weekStartKey(p.start)+'T00:00:00');
    const end=new Date(weekStartKey(p.due)+'T00:00:00');
    let n=0;

    while(d<=end&&n<520){
      n++;
      d.setDate(d.getDate()+7);
    }

    return n;
  }

  function isProgressLogForTask(log,taskId){
    if(!log||log.status==='已刪除'||String(log?.taskId)!==String(taskId))return false;
    return StudyLogDomain.isCountableActualLog(log)||log.progressAlias===true;
  }

  function actualMinutesInRange(tasks,logs,task,start,end){
    if(!task||Number(task.level)!==4)return 0;

    const p=GoalDomain.periodForTask(tasks,task);

    return list(logs)
      .filter(log=>isProgressLogForTask(log,task.id))
      .reduce((sum,log)=>{
        const day=StudyLogDomain.logDate(log.time);
        if(!day||day<start||day>end)return sum;
        if(!inPeriod(day,p))return sum;
        return sum+Math.max(0,+log.minutes||0);
      },0);
  }

  function actualMinutes(tasks,logs,task){
    const p=GoalDomain.periodForTask(tasks,task);
    if(!p?.start||!p?.due)return 0;
    return actualMinutesInRange(tasks,logs,task,p.start,p.due);
  }

  function currentWeekSummary(tasks,logs,task,date){
    if(!task||Number(task.level)!==4){
      return {target:0,actual:0,remaining:0,start:'',end:'',active:false};
    }

    const p=GoalDomain.periodForTask(tasks,task);
    const ws=weekStartKey(date);
    const we=weekEndKey(date);
    const active=!!p&&(
      inPeriod(ws,p)||
      inPeriod(we,p)||
      (ws<=p.due&&we>=p.start)
    );

    if(!active){
      return {target:0,actual:0,remaining:0,start:ws,end:we,active:false};
    }

    const target=Math.max(0,+task.weeklyMinutes||0);
    const actual=actualMinutesInRange(tasks,logs,task,ws,we);

    return {
      target,
      actual,
      remaining:Math.max(0,target-actual),
      start:ws,
      end:we,
      active:true
    };
  }

  function leafProgress(tasks,logs,task){
    if(!task||Number(task.level)!==4)return 0;

    const weekly=Math.max(0,+task.weeklyMinutes||0);
    const weeks=activeWeekCount(tasks,task);
    const planned=weekly*weeks;

    if(planned<=0)return 0;

    return Math.max(
      0,
      Math.min(100,Math.round(actualMinutes(tasks,logs,task)/planned*100))
    );
  }

  function executionSummary(tasks,logs,task,date){
    const w=currentWeekSummary(tasks,logs,task,date);

    return {
      weeklyTarget:w.target,
      weeklyActual:w.actual,
      weeklyRemaining:w.remaining,
      totalActual:actualMinutes(tasks,logs,task),
      progress:leafProgress(tasks,logs,task),
      active:w.active
    };
  }

  function activeExecutionPlan(plan){
    return !!plan&&plan.status!=='已完成'&&plan.status!=='已取消';
  }

  function rebuildExecutionPlanActuals(plans,logs,tasks,nowIso){
    const sums=new Map();

    list(logs)
      .filter(log=>StudyLogDomain.isGoalActualLog(log,tasks))
      .forEach(log=>{
        if(!log.planId)return;
        const id=String(log.planId);
        sums.set(id,(sums.get(id)||0)+Math.max(0,+log.minutes||0));
      });

    return list(plans).map(plan=>{
      const next={...plan};
      const total=sums.get(String(plan?.id))||0;
      next.actualMinutes=total;

      if(next.status!=='已取消'){
        const target=Math.max(1,+next.minutes||0);
        next.status=total>=target
          ?'已完成'
          :total>0
            ?'已部分完成'
            :'待執行';

        if(next.status==='已完成'){
          if(!next.completedAt&&nowIso)next.completedAt=nowIso;
        }else{
          delete next.completedAt;
        }
      }

      return next;
    });
  }

  function descendants(tasks,id){
    const out=[];
    const stack=[id];

    while(stack.length){
      const current=stack.pop();

      GoalDomain.children(tasks,current).forEach(child=>{
        out.push(child);
        stack.push(child.id);
      });
    }

    return out;
  }

  function currentWeekTargetForRoot(tasks,logs,root,date){
    if(!root)return 0;

    return descendants(tasks,root.id)
      .filter(task=>Number(task.level)===4&&task.status!=='已封存')
      .reduce(
        (sum,task)=>sum+currentWeekSummary(tasks,logs,task,date).target,
        0
      );
  }

  function previousWeekRange(date){
    const ws=weekStartKey(date);
    const d=new Date(ws+'T00:00:00');
    d.setDate(d.getDate()-7);
    const start=dateKey(d);
    return {start,end:weekEndKey(start)};
  }

  function activeWeeklyTargetTotal(tasks,logs,date){
    return list(tasks)
      .filter(task=>Number(task.level)===4&&task.status!=='已封存')
      .reduce(
        (sum,task)=>sum+currentWeekSummary(tasks,logs,task,date).target,
        0
      );
  }

  return Object.freeze({
    weekStartKey,
    weekEndKey,
    inPeriod,
    activeWeekCount,
    isProgressLogForTask,
    actualMinutesInRange,
    actualMinutes,
    currentWeekSummary,
    leafProgress,
    executionSummary,
    activeExecutionPlan,
    rebuildExecutionPlanActuals,
    descendants,
    currentWeekTargetForRoot,
    previousWeekRange,
    activeWeeklyTargetTotal
  });
});
