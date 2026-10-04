'use strict';

const assert=require('assert');
const AnalyticsDomain=require('../../js/domain/analytics.js');
const fixture=require('../fixtures/canonical-db.js');

const leaves=AnalyticsDomain.analysisValidLeafTasks(fixture.tasks);
assert.deepStrictEqual(leaves.map(x=>x.id),['action']);

const week=AnalyticsDomain.weeklyStudySummary({
  tasks:fixture.tasks,
  logs:fixture.logs,
  date:fixture.anchorDate
});

assert.strictEqual(week.target,420);
assert.strictEqual(week.goalActualMinutes,90);
assert.strictEqual(week.creditedGoalMinutes,90);
assert.strictEqual(week.overrunGoalMinutes,0);
assert.strictEqual(week.otherStudyMinutes,40);
assert.strictEqual(week.totalStudyMinutes,130);
assert.strictEqual(week.remaining,330);
assert.strictEqual(week.ratio,21);

const analysis=AnalyticsDomain.executionAnalysis({
  tasks:fixture.tasks,
  logs:fixture.logs,
  plans:fixture.executionPlans,
  timer:{running:false,planId:null,elapsed:0,start:0},
  date:fixture.anchorDate,
  nowMs:Date.parse('2026-10-01T22:00:00+08:00')
});

assert.strictEqual(analysis.plannedMinutes,120);
assert.strictEqual(analysis.actualMinutes,90);
assert.strictEqual(analysis.otherStudyMinutes,40);
assert.strictEqual(analysis.totalStudyMinutes,130);
assert.strictEqual(analysis.planActualMinutes,0);
assert.strictEqual(analysis.unplannedActualMinutes,90);
assert.strictEqual(analysis.cancelledPlans.length,0);


const overrunTasks=[
  {id:'r',name:'root',level:1,parent:null,status:'未開始',weeklyMinutes:0},
  {id:'s',name:'stage',level:2,parent:'r',status:'未開始',weeklyMinutes:0},
  {id:'p',name:'period',level:3,parent:'s',status:'未開始',weeklyMinutes:0,start:'2026-09-28',due:'2026-10-04'},
  {id:'a',name:'A',level:4,parent:'p',status:'未開始',weeklyMinutes:60},
  {id:'b',name:'B',level:4,parent:'p',status:'未開始',weeklyMinutes:60}
];
const overrunLogs=[{id:'oa',taskId:'a',name:'A',kind:'goal-study',actual:true,minutes:120,planId:'op1',time:'2026-10-01T09:00:00+08:00'}];
const overrunWeek=AnalyticsDomain.weeklyStudySummary({tasks:overrunTasks,logs:overrunLogs,date:'2026-10-01'});
assert.strictEqual(overrunWeek.target,120);
assert.strictEqual(overrunWeek.goalActualMinutes,120,'all real minutes remain study time');
assert.strictEqual(overrunWeek.creditedGoalMinutes,60,'one action cannot earn more than target');
assert.strictEqual(overrunWeek.overrunGoalMinutes,60);
assert.strictEqual(overrunWeek.remaining,60,'overrun must not pay another unfinished action');
assert.strictEqual(overrunWeek.ratio,50);
assert.strictEqual(overrunWeek.totalStudyMinutes,120,'overrun remains in total study time');

const overrunAnalysis=AnalyticsDomain.executionAnalysis({
  tasks:overrunTasks,
  logs:overrunLogs,
  plans:[
    {id:'op1',taskId:'a',date:'2026-10-01',minutes:60,status:'待執行'},
    {id:'op2',taskId:'b',date:'2026-10-01',minutes:60,status:'待執行'}
  ],
  timer:{running:false,planId:null,elapsed:0,start:0},
  date:'2026-10-01',
  nowMs:Date.parse('2026-10-01T22:00:00+08:00')
});
assert.strictEqual(overrunAnalysis.plannedMinutes,120);
assert.strictEqual(overrunAnalysis.planActualMinutes,120,'raw plan actual must not be capped');
assert.strictEqual(overrunAnalysis.creditedPlanMinutes,60);
assert.strictEqual(overrunAnalysis.overrunPlanMinutes,60);
assert.strictEqual(overrunAnalysis.remainingPlanMinutes,60);
assert.strictEqual(overrunAnalysis.timeRate,50,'overrun must not offset another plan');
assert.strictEqual(overrunAnalysis.totalStudyMinutes,120,'raw overrun remains in total study time');

const direction=AnalyticsDomain.weeklyDirectionSummary({tasks:overrunTasks,logs:overrunLogs,roots:[overrunTasks[0]],date:'2026-10-01'})[0];
assert.strictEqual(direction.target,120);assert.strictEqual(direction.actual,120);assert.strictEqual(direction.credited,60);assert.strictEqual(direction.overrun,60);assert.strictEqual(direction.remaining,60);assert.strictEqual(direction.ratio,50);

console.log('OK: AnalyticsDomain weekly study, direction and legacy plan aggregation');
