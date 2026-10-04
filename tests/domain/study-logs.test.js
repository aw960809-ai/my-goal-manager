'use strict';

const assert=require('assert');
const StudyLogDomain=require('../../js/domain/study-logs.js');
const fixture=require('../fixtures/canonical-db.js');

const goal=fixture.logs.find(x=>x.id==='goal-1');
const other=fixture.logs.find(x=>x.id==='other-1');
const system=fixture.logs.find(x=>x.id==='system-1');

assert.strictEqual(StudyLogDomain.KIND.GOAL,'goal-study');
assert.strictEqual(StudyLogDomain.KIND.OTHER,'other-study');
assert.strictEqual(StudyLogDomain.KIND.SYSTEM,'system');

const legacy=StudyLogDomain.normalizeLog({
  id:'legacy',
  taskId:'action',
  type:'auto',
  minutes:-5
});

assert.strictEqual(legacy.kind,StudyLogDomain.KIND.SYSTEM);
assert.strictEqual(legacy.actual,false);
assert.strictEqual(legacy.minutes,0);

assert.strictEqual(StudyLogDomain.isCountableActualLog(goal),true);
assert.strictEqual(StudyLogDomain.isOtherStudyLog(goal),false);
assert.strictEqual(StudyLogDomain.isGoalActualLog(goal,fixture.tasks),true);

assert.strictEqual(StudyLogDomain.isCountableActualLog(other),true);
assert.strictEqual(StudyLogDomain.isOtherStudyLog(other),true);
assert.strictEqual(StudyLogDomain.isGoalActualLog(other,fixture.tasks),false);

assert.strictEqual(StudyLogDomain.isCountableActualLog(system),false);

assert.strictEqual(
  StudyLogDomain.goalStudyMinutesInRange(
    fixture.logs,
    fixture.tasks,
    '2026-09-28',
    '2026-10-04'
  ),
  fixture.expected.goalActualMinutes
);

assert.strictEqual(
  StudyLogDomain.otherStudyMinutesInRange(
    fixture.logs,
    '2026-09-28',
    '2026-10-04'
  ),
  fixture.expected.otherStudyMinutes
);

assert.strictEqual(
  StudyLogDomain.totalStudyMinutesInRange(
    fixture.logs,
    '2026-09-28',
    '2026-10-04'
  ),
  fixture.expected.totalStudyMinutes
);


const manualBackfill=StudyLogDomain.normalizeLog({
  id:'manual-backfill',
  taskId:'action',
  name:'行政法預習',
  time:'2026-10-01T12:00:00+08:00',
  minutes:30,
  actual:true,
  kind:'goal-study',
  source:'manual-backfill'
});

assert.strictEqual(manualBackfill.kind,StudyLogDomain.KIND.GOAL);
assert.strictEqual(StudyLogDomain.isCountableActualLog(manualBackfill),true);
assert.strictEqual(StudyLogDomain.isGoalActualLog(manualBackfill,fixture.tasks),true);
assert.strictEqual(
  StudyLogDomain.goalStudyMinutesInRange(
    [...fixture.logs,manualBackfill],
    fixture.tasks,
    '2026-09-28',
    '2026-10-04'
  ),
  fixture.expected.goalActualMinutes+30,
  'manual goal backfill must count exactly like timer-based goal study'
);

const deleted={...goal,id:'deleted',status:'已刪除',minutes:999};
assert.strictEqual(StudyLogDomain.isCountableActualLog(deleted),false);

const missing={...goal,id:'missing',taskId:'no-such-task'};
assert.strictEqual(
  StudyLogDomain.isGoalActualLog(missing,fixture.tasks),
  false
);

console.log('OK: StudyLogDomain classification, normalization and aggregation');
