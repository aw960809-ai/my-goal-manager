'use strict';
/* Synthetic fixtures only. This test NEVER opens a personal backup. */
const assert=require('assert');
const AnalyticsDomain=require('../../js/domain/analytics.js');
const fixture=require('../fixtures/canonical-db.js');

const count=(tasks,logs,date='2026-10-01')=>
  AnalyticsDomain.weeklyEngagedActionCount({tasks,logs,date});

// Two real sessions on one action should count one engaged action.
assert.strictEqual(count(fixture.tasks,fixture.logs,fixture.anchorDate),1);
assert.strictEqual(count(fixture.tasks,[],fixture.anchorDate),0);

const sibling={...fixture.tasks.find(t=>t.id==='action'),id:'second-action',name:'第二具體行動'};
const archived={...sibling,id:'archived-action',status:'已封存'};
const invalid={...sibling,id:'broken-action',parent:'non-existing'};
const tasks=[...fixture.tasks,sibling,archived,invalid];
const time='2026-10-01T08:00:00+08:00';
const row=(id,taskId,minutes=15,extra={})=>({
  id,taskId,minutes,time,kind:'goal-study',actual:true,...extra
});
const logs=[
  ...fixture.logs,
  row('second-1','second-action'),
  row('second-2','second-action',30),
  row('archived-1','archived-action',20),
  row('broken-1','broken-action',20),
  row('unknown-1','missing-action',40),
  row('deleted-1','second-action',25,{status:'已刪除'}),
  row('system-2','second-action',45,{kind:'system',actual:false}),
  row('legacy-auto','second-action',30,{type:'auto'}),
  row('other-2','second-action',45,{kind:'other-study'}),
  row('not-actual','second-action',45,{actual:false}),
  row('zero-1','action',0),
  row('bad-number','action','invalid'),
  row('off-week','action',15,{time:'2026-10-05T01:00:00+08:00'})
];
assert.strictEqual(count(tasks,logs),2,'two different valid actions count once each');
assert.strictEqual(count(tasks,logs,'2026-10-05'),1,'Monday starts a fresh week');

// Taiwan-local date governs the boundary. UTC Oct 4 16:00 is Oct 5 00:00.
assert.strictEqual(count(tasks,[row('taiwan-boundary','action',10,{time:'2026-10-04T16:00:00Z'})],'2026-10-01'),0);
assert.strictEqual(count(tasks,[row('taiwan-boundary','action',10,{time:'2026-10-04T16:00:00Z'})],'2026-10-05'),1);

// Ignore all invalid or deleted records even when the action exists.
assert.strictEqual(count(fixture.tasks,[
  row('deleted','action',30,{status:'已刪除'}),
  row('zero','action',0),
  row('auto','action',5,{type:'auto'}),
  row('other','action',10,{kind:'other-study'})
]),0);

const after=AnalyticsDomain.weeklyStudySummary({tasks:fixture.tasks,logs:fixture.logs,date:fixture.anchorDate});
assert.strictEqual(after.goalActualMinutes,90,'existing weekly goal minutes must remain unchanged');
assert.strictEqual(after.creditedGoalMinutes,90,'existing credited time must remain unchanged');
assert.strictEqual(after.totalStudyMinutes,130,'existing study totals must remain unchanged');
console.log('OK: weekly distinct engaged actions, exclusions, Taiwan week boundary and no change to minutes');
