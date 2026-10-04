'use strict';

const assert=require('assert');
const ExecutionDomain=require('../../js/domain/execution.js');
const fixture=require('../fixtures/canonical-db.js');

const action=fixture.tasks.find(x=>x.id==='action');
const root=fixture.tasks.find(x=>x.id==='root');

assert(action);
assert(root);

assert.strictEqual(
  ExecutionDomain.weekStartKey('2026-10-01'),
  '2026-09-28'
);

assert.strictEqual(
  ExecutionDomain.weekEndKey('2026-10-01'),
  '2026-10-04'
);

const week=ExecutionDomain.currentWeekSummary(
  fixture.tasks,
  fixture.logs,
  action,
  fixture.anchorDate
);

assert.deepStrictEqual(week,{
  target:420,
  actual:90,
  credited:90,
  overrun:0,
  remaining:330,
  start:'2026-09-28',
  end:'2026-10-04',
  active:true
});

assert.deepStrictEqual(ExecutionDomain.timeAccounting(60,85),{
  planned:60,actual:85,credited:60,overrun:25,remaining:0,progress:100
});
assert.deepStrictEqual(ExecutionDomain.timeAccounting(0,85),{
  planned:0,actual:85,credited:0,overrun:0,remaining:0,progress:0
});

const before=ExecutionDomain.currentWeekSummary(
  fixture.tasks,
  fixture.logs,
  action,
  '2026-09-20'
);

assert.strictEqual(before.active,false);
assert.strictEqual(before.target,0);
assert.strictEqual(before.actual,0);

assert.strictEqual(
  ExecutionDomain.currentWeekTargetForRoot(
    fixture.tasks,
    fixture.logs,
    root,
    fixture.anchorDate
  ),
  fixture.expected.weeklyTargetMinutes
);

assert.strictEqual(
  ExecutionDomain.activeWeeklyTargetTotal(
    fixture.tasks,
    fixture.logs,
    fixture.anchorDate
  ),
  fixture.expected.weeklyTargetMinutes
);

assert.deepStrictEqual(
  ExecutionDomain.activeWeeklyAccounting(fixture.tasks,fixture.logs,fixture.anchorDate),
  {target:420,actual:90,credited:90,overrun:0,remaining:330}
);

assert.deepStrictEqual(
  ExecutionDomain.previousWeekRange('2026-10-01'),
  {start:'2026-09-21',end:'2026-09-27'}
);

const plans=[
  {id:'p1',taskId:'action',minutes:60,status:'待執行'},
  {id:'p2',taskId:'action',minutes:120,status:'已取消'}
];

const logs=[
  {
    id:'p1-log',
    taskId:'action',
    kind:'goal-study',
    actual:true,
    minutes:60,
    planId:'p1',
    time:'2026-10-01T09:00:00+08:00'
  },
  {
    id:'p2-log',
    taskId:'action',
    kind:'goal-study',
    actual:true,
    minutes:30,
    planId:'p2',
    time:'2026-10-01T10:00:00+08:00'
  }
];

const rebuilt=ExecutionDomain.rebuildExecutionPlanActuals(
  plans,
  logs,
  fixture.tasks,
  '2026-10-01T12:00:00.000Z'
);

assert.strictEqual(rebuilt[0].actualMinutes,60);
assert.strictEqual(rebuilt[0].status,'已完成');
assert.strictEqual(rebuilt[0].completedAt,'2026-10-01T12:00:00.000Z');

assert.strictEqual(rebuilt[1].actualMinutes,30);
assert.strictEqual(rebuilt[1].status,'已取消');

assert.strictEqual(plans[0].status,'待執行','domain must not mutate input');

console.log('OK: ExecutionDomain weekly targets, actuals and plan state');
