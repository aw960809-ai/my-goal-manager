const assert=require('assert');
const TimerService=require('../../js/services/timer-service.js');

const empty=TimerService.empty();
assert.strictEqual(TimerService.hasSelection(empty),false);

const goal=TimerService.selectGoal('task-1','plan-1');
assert.strictEqual(goal.id,'task-1');
assert.strictEqual(goal.planId,'plan-1');
assert.strictEqual(goal.kind,'goal');
assert.strictEqual(TimerService.hasSelection(goal),true);

const started=TimerService.start(goal,1000);
assert.strictEqual(started.running,true);
assert.strictEqual(started.start,1000);
assert.strictEqual(TimerService.elapsedMs(started,61000),60000);

const paused=TimerService.pause(started,61000);
assert.strictEqual(paused.running,false);
assert.strictEqual(paused.elapsed,60000);
assert.strictEqual(paused.start,0);

const finished=TimerService.finish(paused,61000);
assert.strictEqual(finished.minutes,1);

const other=TimerService.selectOther('行政法');
assert.strictEqual(other.kind,'other-study');
assert.strictEqual(other.label,'行政法');
assert.strictEqual(TimerService.hasSelection(other),true);

const restored=TimerService.normalize({
  id:'task-2',
  start:5000,
  elapsed:30000,
  running:true,
  kind:'goal'
});

assert.strictEqual(restored.id,'task-2');
assert.strictEqual(restored.elapsed,30000);
assert.strictEqual(restored.running,true);

console.log(
  'OK: TimerService selection, start, pause, restore and finish'
);
