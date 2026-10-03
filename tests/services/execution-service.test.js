const assert=require('assert');
const ExecutionService=require('../../js/services/execution-service.js');

const task={id:'action',name:'行政法預習'};

const plan=ExecutionService.createPlan({
  id:'plan-1',
  task,
  date:'2026-10-03',
  time:'19:00',
  minutes:60,
  nowIso:'2026-10-03T12:00:00.000Z'
});

assert.deepStrictEqual(plan,{
  id:'plan-1',
  taskId:'action',
  name:'行政法預習',
  date:'2026-10-03',
  time:'19:00',
  minutes:60,
  status:'待執行',
  createdAt:'2026-10-03T12:00:00.000Z'
});

const partial=ExecutionService.applyActualMinutes(
  plan,
  30,
  '2026-10-03T19:30:00.000Z'
);
assert.strictEqual(partial.actualMinutes,30);
assert.strictEqual(partial.status,'已部分完成');

const done=ExecutionService.applyActualMinutes(
  partial,
  30,
  '2026-10-03T20:00:00.000Z'
);
assert.strictEqual(done.actualMinutes,60);
assert.strictEqual(done.status,'已完成');
assert.strictEqual(done.completedAt,'2026-10-03T20:00:00.000Z');

const cancelled=ExecutionService.cancelPlan(
  plan,
  '2026-10-03T18:00:00.000Z'
);
assert.strictEqual(cancelled.status,'已取消');

const ignored=ExecutionService.applyActualMinutes(
  cancelled,
  999,
  '2026-10-03T20:00:00.000Z'
);
assert.strictEqual(ignored.status,'已取消');
assert.strictEqual(ignored.actualMinutes,undefined);

const found=ExecutionService.findActivePlanForDate(
  [plan,cancelled],
  'action',
  '2026-10-03'
);
assert.strictEqual(found.id,'plan-1');

console.log(
  'OK: ExecutionService create, cancel, actual-minutes and active-plan lookup'
);
