/* Analytics domain: pure aggregation over goals, logs and execution plans. */
(function(root,factory){
  const goal=typeof module==='object'&&module.exports
    ?require('./goals.js')
    :root.GoalDomain;
  const study=typeof module==='object'&&module.exports
    ?require('./study-logs.js')
    :root.StudyLogDomain;
  const execution=typeof module==='object'&&module.exports
    ?require('./execution.js')
    :root.ExecutionDomain;
  const api=factory(goal,study,execution);

  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AnalyticsDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(
  GoalDomain,
  StudyLogDomain,
  ExecutionDomain
){
  'use strict';

  if(!GoalDomain)throw new Error('AnalyticsDomain requires GoalDomain');
  if(!StudyLogDomain)throw new Error('AnalyticsDomain requires StudyLogDomain');
  if(!ExecutionDomain)throw new Error('AnalyticsDomain requires ExecutionDomain');

  function list(value){return Array.isArray(value)?value:[]}

  function analysisValidLeafTasks(tasks){
    return list(tasks).filter(task=>{
      if(!task||Number(task.level)!==4||task.status==='已封存')return false;

      const parent=GoalDomain.getTask(tasks,task.parent);
      if(!parent||Number(parent.level)!==3||parent.status==='已封存')return false;

      const p=GoalDomain.periodForTask(tasks,task);
      return !!(p?.start&&p?.due&&p.start<=p.due);
    });
  }

  function weeklyStudySummary({tasks,logs,date}){
    const ws=ExecutionDomain.weekStartKey(date);
    const we=ExecutionDomain.weekEndKey(date);
    const target=ExecutionDomain.activeWeeklyTargetTotal(tasks,logs,date);

    const goalActualMinutes=StudyLogDomain.goalStudyMinutesInRange(
      logs,tasks,ws,we
    );

    const otherStudyMinutes=StudyLogDomain.otherStudyMinutesInRange(
      logs,ws,we
    );

    const totalStudyMinutes=goalActualMinutes+otherStudyMinutes;

    return {
      ws,
      we,
      target,
      goalActualMinutes,
      otherStudyMinutes,
      totalStudyMinutes,
      remaining:Math.max(0,target-goalActualMinutes),
      ratio:target
        ?Math.min(100,Math.round(goalActualMinutes/target*100))
        :0
    };
  }

  function executionAnalysis({
    tasks,
    logs,
    plans,
    timer,
    date,
    nowMs=Date.now()
  }){
    const ws=ExecutionDomain.weekStartKey(date);
    const we=ExecutionDomain.weekEndKey(ws);

    const weekPlans=list(plans).filter(plan=>
      plan&&plan.date>=ws&&plan.date<=we
    );

    const scheduledPlans=weekPlans.filter(plan=>plan.status!=='已取消');
    const activePlans=weekPlans.filter(ExecutionDomain.activeExecutionPlan);
    const cancelledPlans=weekPlans.filter(plan=>plan.status==='已取消');

    const actualLogs=list(logs).filter(log=>
      StudyLogDomain.isGoalActualLog(log,tasks)&&
      StudyLogDomain.logDate(log.time)>=ws&&
      StudyLogDomain.logDate(log.time)<=we
    );

    const actualMinutes=StudyLogDomain.sumMinutes(actualLogs);

    const otherStudyLogs=list(logs).filter(log=>
      StudyLogDomain.isCountableActualLog(log)&&
      StudyLogDomain.isOtherStudyLog(log)&&
      StudyLogDomain.logDate(log.time)>=ws&&
      StudyLogDomain.logDate(log.time)<=we
    );

    const otherStudyMinutes=StudyLogDomain.sumMinutes(otherStudyLogs);
    const totalStudyMinutes=actualMinutes+otherStudyMinutes;

    const scheduledMap=new Map(
      scheduledPlans.map(plan=>[String(plan.id),plan])
    );

    const historicalPlanMap=new Map(
      weekPlans.map(plan=>[String(plan.id),plan])
    );

    const cancelledPlanIds=new Set(
      cancelledPlans.map(plan=>String(plan.id))
    );

    const planActualMap=new Map();
    const historicalPlanActualMap=new Map();
    let unplannedActualMinutes=0;

    actualLogs.forEach(log=>{
      const mins=Math.max(0,+log.minutes||0);
      const planId=String(log?.planId||'');

      if(!planId||!historicalPlanMap.has(planId)){
        unplannedActualMinutes+=mins;
        return;
      }

      historicalPlanActualMap.set(
        planId,
        (historicalPlanActualMap.get(planId)||0)+mins
      );

      if(scheduledMap.has(planId)){
        planActualMap.set(
          planId,
          (planActualMap.get(planId)||0)+mins
        );
      }
    });

    let livePlanActualMinutes=0;
    planActualMap.forEach(value=>{livePlanActualMinutes+=value});

    if(timer?.running&&timer?.planId&&scheduledMap.has(String(timer.planId))){
      const live=Math.max(
        0,
        Math.floor(
          ((+timer.elapsed||0)+(nowMs-(+timer.start||0)))/60000
        )
      );

      livePlanActualMinutes+=live;

      planActualMap.set(
        String(timer.planId),
        (planActualMap.get(String(timer.planId))||0)+live
      );
    }

    const plannedMinutes=scheduledPlans.reduce(
      (sum,plan)=>sum+Math.max(0,+plan.minutes||0),
      0
    );

    const fulfilledPlans=scheduledPlans.filter(plan=>
      (planActualMap.get(String(plan.id))||0)>=Math.max(1,+plan.minutes||0)
    );

    const startedPlans=scheduledPlans.filter(plan=>
      (planActualMap.get(String(plan.id))||0)>0
    );

    const expiredPlans=scheduledPlans.filter(plan=>
      plan.date<date&&
      (planActualMap.get(String(plan.id))||0)<Math.max(1,+plan.minutes||0)
    );

    const timeRate=plannedMinutes
      ?Math.round(Math.min(100,livePlanActualMinutes/plannedMinutes*100)*10)/10
      :null;

    const executionRate=scheduledPlans.length
      ?Math.round(startedPlans.length/scheduledPlans.length*1000)/10
      :null;

    const completionRate=scheduledPlans.length
      ?Math.round(fulfilledPlans.length/scheduledPlans.length*1000)/10
      :null;

    const completedForEstimate=fulfilledPlans.filter(plan=>
      planActualMap.has(String(plan.id))
    );

    const estimateAccuracy=completedForEstimate.length
      ?Math.round(
        completedForEstimate.reduce((sum,plan)=>{
          const planned=Math.max(1,+plan.minutes||0);
          const actual=Math.max(0,planActualMap.get(String(plan.id))||0);

          return sum+Math.max(
            0,
            100-Math.abs(actual-planned)/planned*100
          );
        },0)/completedForEstimate.length*10
      )/10
      :null;

    const historicalPlanActualMinutes=[
      ...historicalPlanActualMap.values()
    ].reduce((sum,value)=>sum+value,0);

    const cancelledPlanActualMinutes=[
      ...historicalPlanActualMap.entries()
    ].reduce(
      (sum,[id,value])=>
        sum+(
          cancelledPlanIds.has(String(id))
            ?Math.max(0,+value||0)
            :0
        ),
      0
    );

    return {
      ws,
      we,
      plans:weekPlans,
      scheduledPlans,
      activePlans,
      cancelledPlans,
      fulfilledPlans,
      startedPlans,
      expiredPlans,
      plannedMinutes,
      actualMinutes,
      otherStudyMinutes,
      totalStudyMinutes,
      planActualMinutes:livePlanActualMinutes,
      historicalPlanActualMinutes,
      cancelledPlanActualMinutes,
      unplannedActualMinutes,
      timeRate,
      executionRate,
      completionRate,
      estimateAccuracy,
      planActualMap,
      historicalPlanActualMap,
      completedForEstimate
    };
  }

  return Object.freeze({
    analysisValidLeafTasks,
    weeklyStudySummary,
    executionAnalysis
  });
});
