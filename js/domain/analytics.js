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

  /** Count distinct valid Level 4 actions with real positive minutes this week. */
  function weeklyEngagedActionCount({tasks,logs,date}){
    const validIds=new Set(
      analysisValidLeafTasks(tasks)
        .filter(task=>task.id!==undefined&&task.id!==null)
        .map(task=>String(task.id))
    );
    if(validIds.size===0)return 0;
    const start=ExecutionDomain.weekStartKey(date);
    const end=ExecutionDomain.weekEndKey(date);
    const engaged=new Set();
    list(logs).forEach(log=>{
      const id=String(log?.taskId??'');
      const minutes=Number(log?.minutes);
      if(!validIds.has(id)||!Number.isFinite(minutes)||minutes<=0)return;
      if(!StudyLogDomain.isGoalActualLog(log,tasks))return;
      if(!StudyLogDomain.inDateRange(log,start,end))return;
      engaged.add(id);
    });
    return engaged.size;
  }

  function weeklyStudySummary({tasks,logs,date}){
    const ws=ExecutionDomain.weekStartKey(date);
    const we=ExecutionDomain.weekEndKey(date);
    const accounting=ExecutionDomain.activeWeeklyAccounting(tasks,logs,date);
    const target=accounting.target;
    const goalActualMinutes=StudyLogDomain.goalStudyMinutesInRange(logs,tasks,ws,we);
    const otherStudyMinutes=StudyLogDomain.otherStudyMinutesInRange(logs,ws,we);
    const totalStudyMinutes=goalActualMinutes+otherStudyMinutes;
    const creditedGoalMinutes=accounting.credited;
    const overrunGoalMinutes=accounting.overrun;

    return {
      ws,
      we,
      target,
      goalActualMinutes,
      creditedGoalMinutes,
      overrunGoalMinutes,
      otherStudyMinutes,
      totalStudyMinutes,
      remaining:accounting.remaining,
      ratio:target?Math.min(100,Math.round(creditedGoalMinutes/target*100)):0
    };
  }

  function descendantLeafTasks(tasks,rootId){
    const rows=list(tasks),out=[],stack=[String(rootId)];
    while(stack.length){
      const parentId=stack.pop();
      rows.filter(task=>String(task?.parent)===parentId).forEach(task=>{
        if(task.status==='已封存')return;
        if(Number(task.level)===4)out.push(task);else stack.push(String(task.id));
      });
    }
    return out;
  }

  function weeklyDirectionSummary({tasks,logs,roots,date}){
    return list(roots).map(root=>{
      const totals=descendantLeafTasks(tasks,root?.id).reduce((sum,task)=>{
        const row=ExecutionDomain.currentWeekSummary(tasks,logs,task,date);
        if(!row.active)return sum;
        sum.target+=Math.max(0,+row.target||0);sum.actual+=Math.max(0,+row.actual||0);
        sum.credited+=Math.max(0,+row.credited||0);sum.overrun+=Math.max(0,+row.overrun||0);
        sum.remaining+=Math.max(0,+row.remaining||0);return sum;
      },{target:0,actual:0,credited:0,overrun:0,remaining:0});
      return {rootId:String(root?.id||''),name:String(root?.name||''),...totals,ratio:totals.target?Math.min(100,Math.round(totals.credited/totals.target*100)):0};
    });
  }

  // 舊備份相容：executionAnalysis 保留純函式讀取舊 executionPlans；主要產品流程已不再使用。
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

    const planAccounting=scheduledPlans.reduce((sum,plan)=>{
      const accounting=ExecutionDomain.timeAccounting(
        Math.max(0,+plan.minutes||0),
        planActualMap.get(String(plan.id))||0
      );
      sum.credited+=accounting.credited;
      sum.overrun+=accounting.overrun;
      sum.remaining+=accounting.remaining;
      return sum;
    },{credited:0,overrun:0,remaining:0});

    const creditedPlanMinutes=planAccounting.credited;
    const overrunPlanMinutes=planAccounting.overrun;
    const remainingPlanMinutes=planAccounting.remaining;

    const timeRate=plannedMinutes
      ?Math.round(creditedPlanMinutes/plannedMinutes*1000)/10
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
      creditedPlanMinutes,
      overrunPlanMinutes,
      remainingPlanMinutes,
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
    weeklyEngagedActionCount,
    weeklyStudySummary,
    weeklyDirectionSummary,
    executionAnalysis
  });
});
